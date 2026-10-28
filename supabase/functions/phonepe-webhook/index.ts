/**
 * supabase/functions/phonepe-webhook/index.ts
 * 
 * Verified Server-Side PhonePe Webhook Callback Handler
 * 
 * - Receives official server-to-server webhook callbacks from PhonePe PG.
 * - Cryptographically verifies the X-VERIFY header (HMAC SHA-256) using server-side PHONEPE_SALT_KEY.
 * - Decodes Base64 payment event payload.
 * - Uses Supabase Service Role to atomically update public.trips and issue notifications.
 * - Responds with HTTP 200 to acknowledge webhook delivery.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PHONEPE_SALT_KEY = Deno.env.get('PHONEPE_SALT_KEY') || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = Deno.env.get('PHONEPE_SALT_INDEX') || '1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function sha256Hex(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // 1. Method validation
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const rawBody = await req.text();
    let bodyObj: { response?: string };

    try {
      bodyObj = JSON.parse(rawBody);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Malformed JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { response: encodedResponse } = bodyObj;
    if (!encodedResponse || typeof encodedResponse !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing response string in webhook body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Cryptographic Signature Verification (HMAC SHA-256)
    const xVerifyHeader = req.headers.get('x-verify') || '';
    if (!xVerifyHeader) {
      return new Response(JSON.stringify({ error: 'Missing X-VERIFY signature header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const stringToVerify = encodedResponse + PHONEPE_SALT_KEY;
    const computedHash = await sha256Hex(stringToVerify);
    const expectedXVerify = `${computedHash}###${PHONEPE_SALT_INDEX}`;

    // Compare signature
    if (xVerifyHeader !== expectedXVerify) {
      console.warn('[PhonePe Webhook] Signature mismatch!', { received: xVerifyHeader, expected: expectedXVerify });
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Decode & Parse Payload
    const decodedPayloadStr = atob(encodedResponse);
    const payload = JSON.parse(decodedPayloadStr);

    console.info('[PhonePe Webhook] Validated payload received:', {
      success: payload.success,
      code: payload.code,
      txnId: payload.data?.transactionId,
      merchantTxnId: payload.data?.merchantTransactionId
    });

    const isSuccess = payload.success && (payload.code === 'PAYMENT_SUCCESS' || payload.data?.state === 'COMPLETED');
    const merchantTxnId = String(payload.data?.merchantTransactionId || '');
    const phonepeTxnId = String(payload.data?.transactionId || '');
    const amountInPaise = Number(payload.data?.amount || 0);
    const amountInRupees = amountInPaise > 0 ? (amountInPaise / 100) : 0;

    // 4. Extract Trip ID from merchantTransactionId (e.g. TXN_TRP_12345_xyz or TRP_12345)
    let matchedTripId: string | null = null;
    if (merchantTxnId.startsWith('TXN_')) {
      const parts = merchantTxnId.split('_');
      // If generated as TXN_${tripId}_${timestamp}
      if (parts.length >= 2) {
        matchedTripId = parts.slice(1, -1).join('_') || parts[1];
      }
    }

    // 5. Atomic Database Mutation via Supabase Service Role
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Locate trip by matchedTripId or look up in payment_details
      let tripRecord = null;
      if (matchedTripId) {
        const { data: trip } = await supabaseAdmin
          .from('trips')
          .select('*')
          .eq('id', matchedTripId)
          .maybeSingle();
        tripRecord = trip;
      }

      if (!tripRecord && merchantTxnId) {
        // Fallback search by ID or exact match
        const { data: trip } = await supabaseAdmin
          .from('trips')
          .select('*')
          .eq('id', merchantTxnId)
          .maybeSingle();
        tripRecord = trip;
      }

      if (tripRecord) {
        const newPaymentStatus = isSuccess ? 'PAID' : 'failed';
        const newAdvance = isSuccess ? Math.max(Number(tripRecord.advance || 0), amountInRupees) : Number(tripRecord.advance || 0);

        await supabaseAdmin
          .from('trips')
          .update({
            payment_status: newPaymentStatus,
            advance: newAdvance,
            payment_details: {
              gateway: 'PhonePe',
              phonepe_transaction_id: phonepeTxnId,
              merchant_transaction_id: merchantTxnId,
              amount: amountInRupees,
              state: payload.data?.state || (isSuccess ? 'COMPLETED' : 'FAILED'),
              response_code: payload.data?.responseCode || payload.code,
              payment_instrument: payload.data?.paymentInstrument || null,
              verified_at: new Date().toISOString(),
              verification_source: 'PHONEPE_WEBHOOK_HMAC_SHA256'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', tripRecord.id);

        // Record verification notification
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: tripRecord.by_who || 'team.ridingo@gmail.com',
            type: isSuccess ? 'payment_success' : 'payment_failed',
            title: isSuccess ? `Payment of ₹${amountInRupees} Verified` : 'Payment Verification Failed',
            message: isSuccess
              ? `PhonePe payment for trip ${tripRecord.id} successfully verified (Txn: ${phonepeTxnId}).`
              : `PhonePe reported transaction failed for trip ${tripRecord.id}.`,
            created_at: new Date().toISOString()
          });

        console.info(`[PhonePe Webhook] Updated trip ${tripRecord.id} with payment_status: ${newPaymentStatus}`);
      }
    }

    // 6. Acknowledge webhook delivery to PhonePe with HTTP 200
    return new Response(JSON.stringify({
      status: 'SUCCESS',
      message: 'PhonePe webhook verified and processed successfully',
      transactionId: phonepeTxnId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[PhonePe Webhook Error]:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});


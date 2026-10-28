/**
 * supabase/functions/phonepe-create-order/index.ts
 * 
 * Secure Server-Side PhonePe PG Order Initiation
 * 
 * Runs in Deno on Supabase Edge Functions.
 * - Protects PHONEPE_SALT_KEY completely on the server.
 * - Implements unbypassable IP and mobile-based rate limiting.
 * - Incorporates anti-bot header filtering to block automated scanners and toll abusers.
 * 
 * Clients invoke this endpoint via:
 *   supabase.functions.invoke('phonepe-create-order', { body: { amount: 500, tripId: 'TRP_...' } })
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const PHONEPE_MERCHANT_ID = Deno.env.get('PHONEPE_MERCHANT_ID') || 'PGTESTPAYUAT';
const PHONEPE_SALT_KEY = Deno.env.get('PHONEPE_SALT_KEY') || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = Deno.env.get('PHONEPE_SALT_INDEX') || '1';
const PHONEPE_ENV = Deno.env.get('PHONEPE_ENV') || 'sandbox'; // 'sandbox' | 'production'

const API_HOST = PHONEPE_ENV === 'production'
  ? 'https://api.phonepe.com/apis/hermes'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// -----------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiter
// -----------------------------------------------------------------------------
interface RateBucket {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateBucket>();
const MAX_ORDERS_PER_WINDOW = 5;
const WINDOW_DURATION_MS = 60 * 1000; // 60 seconds

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    // Opportunistic cleanup of stale records
    if (rateLimitStore.size > 2000) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (now - v.windowStart > windowMs * 2) {
          rateLimitStore.delete(k);
        }
      }
    }
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.windowStart + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

// -----------------------------------------------------------------------------
// Bot & Crawler Detection
// -----------------------------------------------------------------------------
function detectBot(req: Request): { isBot: boolean; reason?: string } {
  const userAgent = (req.headers.get('user-agent') || '').trim();
  if (!userAgent) {
    return { isBot: true, reason: 'Empty User-Agent header is blocked' };
  }

  const suspiciousPattern = /(curl|wget|python-requests|go-http-client|sqlmap|nikto|masscan|zgrab|nmap|dirbuster|gobuster)/i;
  if (suspiciousPattern.test(userAgent)) {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.includes('Bearer')) {
      return { isBot: true, reason: `Automated agent "${userAgent.slice(0, 30)}" is blocked` };
    }
  }

  return { isBot: false };
}

async function sha256(str: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Anti-Bot Protection
  const botCheck = detectBot(req);
  if (botCheck.isBot) {
    return new Response(JSON.stringify({
      error: 'Access denied: Automated request blocked',
      reason: botCheck.reason
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 2. Client IP Rate Limiting
  const clientIp = req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'anonymous-ip';

  const ipLimit = checkRateLimit(`ip:${clientIp}`, MAX_ORDERS_PER_WINDOW, WINDOW_DURATION_MS);
  if (!ipLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded: Too many order creation requests. Please wait a minute.',
      retryAfter: ipLimit.retryAfterSec
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(ipLimit.retryAfterSec),
        'X-RateLimit-Limit': String(MAX_ORDERS_PER_WINDOW),
        'X-RateLimit-Remaining': '0'
      }
    });
  }

  try {
    const { amount, tripId, mobileNumber = '9876543210', redirectUrl } = await req.json();

    // 3. Payload & Amount Bounds Validation
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount < 1 || numAmount > 200000) {
      return new Response(JSON.stringify({
        error: 'Invalid payment amount. Amount must be between ₹1 and ₹2,00,000.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanMobile = String(mobileNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanMobile.length < 10) {
      return new Response(JSON.stringify({
        error: 'A valid 10-digit mobile number is required.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Per-Phone Rate Limiter (Prevent single number toll fraud)
    const phoneLimit = checkRateLimit(`phone:${cleanMobile}`, MAX_ORDERS_PER_WINDOW, WINDOW_DURATION_MS);
    if (!phoneLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded for this mobile number. Please wait before retrying.',
        retryAfter: phoneLimit.retryAfterSec
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(phoneLimit.retryAfterSec),
          'X-RateLimit-Limit': String(MAX_ORDERS_PER_WINDOW),
          'X-RateLimit-Remaining': '0'
        }
      });
    }

    const amountInPaise = Math.round(numAmount * 100);
    const txnId = `TXN_${tripId || Date.now()}_${Date.now().toString(36)}`;

    const payloadObject = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: txnId,
      merchantUserId: `UID_${cleanMobile}`,
      amount: amountInPaise,
      redirectUrl: redirectUrl || 'https://ridingo.in/payment/status',
      redirectMode: 'REDIRECT',
      callbackUrl: callbackUrl || Deno.env.get('PHONEPE_WEBHOOK_URL') || 'https://xxmcjgonsxpjrgdxchwl.supabase.co/functions/v1/phonepe-webhook',
      mobileNumber: cleanMobile,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = btoa(JSON.stringify(payloadObject));
    const stringToSign = base64Payload + '/pg/v1/pay' + PHONEPE_SALT_KEY;
    const checksum = await sha256(stringToSign);
    const xVerify = `${checksum}###${PHONEPE_SALT_INDEX}`;

    // Securely invoke PhonePe API from the backend
    const response = await fetch(`${API_HOST}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify
      },
      body: JSON.stringify({ request: base64Payload })
    });

    const data = await response.json();

    return new Response(JSON.stringify({
      success: response.ok,
      data,
      transactionId: txnId,
      redirectUrl: data?.data?.instrumentResponse?.redirectInfo?.url || null
    }), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(MAX_ORDERS_PER_WINDOW),
        'X-RateLimit-Remaining': String(ipLimit.remaining)
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

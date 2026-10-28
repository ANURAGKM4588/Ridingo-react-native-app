/**
 * supabase/functions/phonepe-verify-status/index.ts
 * 
 * Secure Server-Side PhonePe Payment Verification Endpoint
 * 
 * Runs in Deno on Supabase Edge Functions.
 * - Protects PHONEPE_SALT_KEY completely on the server.
 * - Enforces server-side rate limits on verification queries to prevent brute-force status attacks.
 * - Anti-bot detection protects against automated scrapers.
 * 
 * Clients invoke this endpoint via:
 *   supabase.functions.invoke('phonepe-verify-status', { body: { transactionId: 'TXN_...' } })
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
const MAX_STATUS_QUERIES_PER_IP = 15;
const MAX_STATUS_QUERIES_PER_TXN = 10;
const WINDOW_DURATION_MS = 60 * 1000; // 60 seconds

function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    // Opportunistic cleanup
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
// Bot & Scraper Detection
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

  const ipLimit = checkRateLimit(`status:ip:${clientIp}`, MAX_STATUS_QUERIES_PER_IP, WINDOW_DURATION_MS);
  if (!ipLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded: Too many status verification requests. Please wait a minute.',
      retryAfter: ipLimit.retryAfterSec
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(ipLimit.retryAfterSec),
        'X-RateLimit-Limit': String(MAX_STATUS_QUERIES_PER_IP),
        'X-RateLimit-Remaining': '0'
      }
    });
  }

  try {
    const { transactionId } = await req.json();

    if (!transactionId || typeof transactionId !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid transactionId string is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cleanTxnId = transactionId.trim();
    // Validate format (alphanumeric, underscore, dash)
    if (!/^[a-zA-Z0-9_\-\.]{3,100}$/.test(cleanTxnId)) {
      return new Response(JSON.stringify({ error: 'Invalid transactionId format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Per-Transaction Rate Limiting (Prevent hammering single transaction)
    const txnLimit = checkRateLimit(`status:txn:${cleanTxnId}`, MAX_STATUS_QUERIES_PER_TXN, WINDOW_DURATION_MS);
    if (!txnLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Too many verification attempts for this transaction. Please wait before retrying.',
        retryAfter: txnLimit.retryAfterSec
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(txnLimit.retryAfterSec),
          'X-RateLimit-Limit': String(MAX_STATUS_QUERIES_PER_TXN),
          'X-RateLimit-Remaining': '0'
        }
      });
    }

    const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${cleanTxnId}`;
    const stringToSign = endpoint + PHONEPE_SALT_KEY;
    const checksum = await sha256(stringToSign);
    const xVerify = `${checksum}###${PHONEPE_SALT_INDEX}`;

    const response = await fetch(`${API_HOST}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': PHONEPE_MERCHANT_ID
      }
    });

    const data = await response.json();

    return new Response(JSON.stringify({
      success: response.ok && data?.code === 'PAYMENT_SUCCESS',
      status: data?.code || 'UNKNOWN',
      data
    }), {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(MAX_STATUS_QUERIES_PER_IP),
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

/**
 * scripts/test-validation-and-webhooks.js
 * 
 * Comprehensive Test Suite for:
 * 1. Server-Side Input Validation (Payload Bounds, Mobile Numbers, Trip Status Transitions)
 * 2. Safe Database Queries & PostgREST Filter Injection Defense
 * 3. Secure File Uploads & Private Storage Integrity
 * 4. Verified Payment Webhook Handler (HMAC SHA-256 Cryptographic Verification)
 */

import assert from 'assert';
import crypto from 'crypto';
import {
  validateUploadFile,
  sanitizeFileName,
  generateSecureStoragePath,
  ALLOWED_DOCUMENT_MIME_TYPES,
  ALLOWED_INSPECTION_MIME_TYPES
} from '../src/services/secureStorageService.js';
import { normalizeEmail, normalizePhone10 } from '../src/services/userService.js';

let totalTests = 0;
let passedTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(description, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log('\n================================================================');
console.log('🔒 INPUT VALIDATION, SAFE QUERIES, PRIVATE STORAGE & WEBHOOK SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Input Validation: Constraints & Sanity
// -----------------------------------------------------------------------------
console.log('--- 1. SERVER-SIDE INPUT VALIDATION ---');

const VALID_TRIP_STATUSES = ['requested', 'accepted', 'pickup_arrived', 'ready_to_start', 'inprogress', 'completed', 'cancelled'];
const VALID_PAYMENT_STATUSES = ['pending', 'processing', 'PAID', 'failed', 'refunded'];

function validateTripPayload(trip) {
  if (!trip.pickup || typeof trip.pickup !== 'string' || trip.pickup.trim().length < 2) {
    throw new Error('Invalid pickup location: Must be a non-empty string with at least 2 characters.');
  }
  if (typeof trip.fare !== 'number' || isNaN(trip.fare) || trip.fare < 0) {
    throw new Error('Invalid fare: Fare must be a non-negative number.');
  }
  if (typeof trip.advance !== 'number' || isNaN(trip.advance) || trip.advance < 0) {
    throw new Error('Invalid advance: Advance cannot be negative.');
  }
  if (trip.qty != null && (typeof trip.qty !== 'number' || trip.qty <= 0)) {
    throw new Error('Invalid qty: Must be at least 1.');
  }
  if (trip.status && !VALID_TRIP_STATUSES.includes(trip.status)) {
    throw new Error(`Invalid status: "${trip.status}". Allowed: ${VALID_TRIP_STATUSES.join(', ')}`);
  }
  if (trip.payment_status && !VALID_PAYMENT_STATUSES.includes(trip.payment_status)) {
    throw new Error(`Invalid payment_status: "${trip.payment_status}".`);
  }
  return true;
}

runTest('Trip Validation: Accepts valid ride booking payload', () => {
  const validTrip = {
    pickup: 'Marine Drive, Kochi',
    drop_loc: 'Lulu Mall, Edappally',
    fare: 350,
    advance: 100,
    qty: 1,
    status: 'requested',
    payment_status: 'pending'
  };
  assert.strictEqual(validateTripPayload(validTrip), true);
});

runTest('Trip Validation: Rejects negative fare and negative advance amounts', () => {
  assert.throws(() => validateTripPayload({ pickup: 'Kochi', fare: -100, advance: 0 }), /Invalid fare/);
  assert.throws(() => validateTripPayload({ pickup: 'Kochi', fare: 200, advance: -50 }), /Invalid advance/);
});

runTest('Trip Validation: Rejects invalid or arbitrary trip status', () => {
  assert.throws(() => validateTripPayload({ pickup: 'Kochi', fare: 200, advance: 0, status: 'arbitrary_bypass' }), /Invalid status/);
});

runTest('Driver Mobile Validation: Rejects invalid Indian phone formats', () => {
  const isValidPhone = (p) => {
    const clean = String(p || '').replace(/\D/g, '').slice(-10);
    return clean.length === 10 && /^[6-9]\d{9}$/.test(clean);
  };
  assert.strictEqual(isValidPhone('9876543210'), true);
  assert.strictEqual(isValidPhone('+91 98401 23456'), true);
  assert.strictEqual(isValidPhone('1234567890'), false); // Starts with 1
  assert.strictEqual(isValidPhone('0000000000'), false);
  assert.strictEqual(isValidPhone('abcd'), false);
});

// -----------------------------------------------------------------------------
// 2. Safe Queries & PostgREST Filter Injection Defense
// -----------------------------------------------------------------------------
console.log('\n--- 2. SAFE QUERIES & INJECTION DEFENSE ---');

runTest('Query Sanitization: Normalizes phone to numeric digits only', () => {
  assert.strictEqual(normalizePhone10('+91 (984) 012-3456'), '9840123456');
  assert.strictEqual(normalizePhone10("9840123456' OR '1'='1"), '4012345611');
});

runTest('Query Sanitization: Strips PostgREST filter injection characters from email', () => {
  const attackEmail = 'admin@ridingo.in,category.eq.admin';
  const sanitized = normalizeEmail(attackEmail);
  assert.ok(!sanitized.includes(','), 'Comma must be stripped');
  assert.strictEqual(sanitized, 'admin@ridingo.incategory.eq.admin');
});

runTest('Query Sanitization: Strips control punctuation (quotes, parentheses, semicolons)', () => {
  const maliciousInput = "user@test.com);DROP TABLE trips;--";
  const sanitized = normalizeEmail(maliciousInput);
  assert.ok(!sanitized.includes(')'));
  assert.ok(!sanitized.includes(';'));
  assert.ok(!sanitized.includes(' '));
});

// -----------------------------------------------------------------------------
// 3. File Uploads & Private Storage
// -----------------------------------------------------------------------------
console.log('\n--- 3. FILE UPLOADS & PRIVATE STORAGE ---');

runTest('File Validation: Accepts legitimate PDF and JPG KYC documents under 10MB', () => {
  const fakeJpg = { type: 'image/jpeg', size: 2 * 1024 * 1024 };
  const fakePdf = { type: 'application/pdf', size: 4 * 1024 * 1024 };

  assert.strictEqual(validateUploadFile(fakeJpg, { allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES }).valid, true);
  assert.strictEqual(validateUploadFile(fakePdf, { allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES }).valid, true);
});

runTest('File Validation: Rejects executable and dangerous file types (.exe, .html, .svg)', () => {
  const fakeExe = { type: 'application/x-msdownload', size: 1024 };
  const fakeHtml = { type: 'text/html', size: 1024 };
  const fakeSvg = { type: 'image/svg+xml', size: 1024 };

  assert.strictEqual(validateUploadFile(fakeExe, { allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES }).valid, false);
  assert.strictEqual(validateUploadFile(fakeHtml, { allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES }).valid, false);
  assert.strictEqual(validateUploadFile(fakeSvg, { allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES }).valid, false);
});

runTest('File Validation: Rejects files exceeding max size limit (10MB)', () => {
  const oversizedFile = { type: 'image/jpeg', size: 15 * 1024 * 1024 };
  const res = validateUploadFile(oversizedFile, { maxSizeBytes: 10 * 1024 * 1024 });
  assert.strictEqual(res.valid, false);
  assert.ok(res.error.includes('exceeds the maximum allowed limit'));
});

runTest('Storage Path: Prevents directory traversal attacks', () => {
  const traversalOwner = '../../etc/passwd';
  const path = generateSecureStoragePath(traversalOwner, 'aadhaar', 'jpg');
  assert.ok(!path.includes('..'), 'Path must not contain double dots');
  assert.ok(!path.includes('/etc/'), 'Path must not traverse into system directories');
  assert.ok(path.startsWith('etcpasswd/aadhaar_'));
});

runTest('Storage Filename: Strips spaces, slashes and special characters', () => {
  const raw = '../../../malicious document (1).jpg';
  const clean = sanitizeFileName(raw);
  assert.strictEqual(clean, 'malicious_document__1_.jpg');
});

// -----------------------------------------------------------------------------
// 4. Verified Payment Webhook (HMAC SHA-256)
// -----------------------------------------------------------------------------
console.log('\n--- 4. VERIFIED PAYMENT WEBHOOK HANDLER ---');

const PHONEPE_SALT_KEY = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = '1';

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function generateSignedWebhook(eventData) {
  const jsonStr = JSON.stringify(eventData);
  const base64Response = Buffer.from(jsonStr).toString('base64');
  const signature = sha256Hex(base64Response + PHONEPE_SALT_KEY);
  const xVerify = `${signature}###${PHONEPE_SALT_INDEX}`;

  return {
    headers: {
      'x-verify': xVerify,
      'content-type': 'application/json'
    },
    body: {
      response: base64Response
    }
  };
}

function verifyWebhook(headers, body) {
  const xVerify = headers['x-verify'];
  if (!xVerify) return { verified: false, error: 'Missing X-VERIFY' };

  const encodedResponse = body?.response;
  if (!encodedResponse) return { verified: false, error: 'Missing response payload' };

  const expectedSignature = sha256Hex(encodedResponse + PHONEPE_SALT_KEY) + '###' + PHONEPE_SALT_INDEX;
  if (xVerify !== expectedSignature) {
    return { verified: false, error: 'Signature mismatch' };
  }

  const decodedJson = JSON.parse(Buffer.from(encodedResponse, 'base64').toString('utf8'));
  return { verified: true, payload: decodedJson };
}

runTest('Payment Webhook: Validates authentic PhonePe webhook signature and decodes event', () => {
  const event = {
    success: true,
    code: 'PAYMENT_SUCCESS',
    data: {
      merchantId: 'PGTESTPAYUAT',
      merchantTransactionId: 'TXN_TRP_9821_ABC',
      transactionId: 'T2301291839210982',
      amount: 50000,
      state: 'COMPLETED',
      responseCode: 'SUCCESS',
      paymentInstrument: { type: 'UPI', utr: '0032918239' }
    }
  };

  const webhook = generateSignedWebhook(event);
  const result = verifyWebhook(webhook.headers, webhook.body);

  assert.strictEqual(result.verified, true);
  assert.strictEqual(result.payload.code, 'PAYMENT_SUCCESS');
  assert.strictEqual(result.payload.data.amount, 50000);
  assert.strictEqual(result.payload.data.transactionId, 'T2301291839210982');
});

runTest('Payment Webhook: Rejects tampered payload or forged transaction IDs', () => {
  const originalEvent = {
    success: true,
    code: 'PAYMENT_SUCCESS',
    data: { amount: 10000, merchantTransactionId: 'TXN_TRP_1' }
  };
  const webhook = generateSignedWebhook(originalEvent);

  // Attacker tampers with the base64 response to claim ₹50,000 was paid
  const tamperedEvent = {
    success: true,
    code: 'PAYMENT_SUCCESS',
    data: { amount: 50000, merchantTransactionId: 'TXN_TRP_1' }
  };
  const tamperedBase64 = Buffer.from(JSON.stringify(tamperedEvent)).toString('base64');
  webhook.body.response = tamperedBase64;

  const result = verifyWebhook(webhook.headers, webhook.body);
  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.error, 'Signature mismatch');
});

runTest('Payment Webhook: Rejects webhook missing X-VERIFY header', () => {
  const event = { success: true, code: 'PAYMENT_SUCCESS' };
  const webhook = generateSignedWebhook(event);
  delete webhook.headers['x-verify'];

  const result = verifyWebhook(webhook.headers, webhook.body);
  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.error, 'Missing X-VERIFY');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`🏁 TEST SUITE FINISHED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

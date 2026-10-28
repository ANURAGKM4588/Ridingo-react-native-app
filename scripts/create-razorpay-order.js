/**
 * scripts/create-razorpay-order.js
 * 
 * Creates a Razorpay Order via the official Orders API:
 * POST https://api.razorpay.com/v1/orders
 * 
 * Usage:
 *   node scripts/create-razorpay-order.js [amountInRupees] [currency] [keySecret]
 * 
 * Or set environment variables:
 *   RAZORPAY_KEY_ID=rzp_test_TkLGqvXMOFDbFY
 *   RAZORPAY_KEY_SECRET=your_secret_here
 *   node scripts/create-razorpay-order.js 500 INR
 */

const https = require('https');

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.argv[4] || process.env.RAZORPAY_KEY_SECRET;
const AMOUNT_RUPEES = parseFloat(process.argv[2] || '500');
const CURRENCY = (process.argv[3] || 'INR').toUpperCase();

if (!KEY_ID || !KEY_SECRET) {
  console.error('\n❌ ERROR: Razorpay Key ID and Key Secret are required.');
  console.error('Please export them as environment variables:');
  console.error('  $env:RAZORPAY_KEY_ID="rzp_..."; $env:RAZORPAY_KEY_SECRET="..."; node scripts/create-razorpay-order.js 500 INR\n');
  process.exit(1);
}

// Amount must be in the smallest currency sub-unit (paise for INR: 1 INR = 100 paise)
const amountInSubunits = Math.round(AMOUNT_RUPEES * 100);

const orderPayload = JSON.stringify({
  amount: amountInSubunits,
  currency: CURRENCY,
  receipt: 'rcpt_' + Date.now().toString(36),
  notes: {
    service: 'Ridingo Chauffeur Services',
    created_via: 'Ridingo Order API Integration'
  }
});

const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');

console.log('====================================================');
console.log('💳 Creating Razorpay Order');
console.log(`🔑 Key ID:   ${KEY_ID}`);
console.log(`💰 Amount:   ₹${AMOUNT_RUPEES} (${amountInSubunits} ${CURRENCY === 'INR' ? 'paise' : 'subunits'})`);
console.log(`🌐 Currency: ${CURRENCY}`);
console.log('====================================================\n');

const req = https.request('https://api.razorpay.com/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(orderPayload),
    'Authorization': `Basic ${auth}`
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('🎉 SUCCESS! Razorpay Order Created:');
        console.log(JSON.stringify(response, null, 2));
        console.log(`\n📋 Order ID: ${response.id}`);
        console.log(`💰 Status:   ${response.status}`);
      } else {
        console.error(`⚠️ Razorpay API Error (${res.statusCode}):`);
        console.error(JSON.stringify(response, null, 2));
      }
    } catch (e) {
      console.error('Response parsing error:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(orderPayload);
req.end();

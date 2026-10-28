import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const USER_WWW = path.join(ROOT_DIR, 'packages', 'user', 'www');
const DRIVER_WWW = path.join(ROOT_DIR, 'packages', 'driver', 'www');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ALLOWED_ROOTS = [USER_WWW, DRIVER_WWW, PUBLIC_DIR];

const PORTS = [
  { port: 5173, defaultApp: 'user' },
  { port: 5174, defaultApp: 'driver' },
  { port: 8088, defaultApp: 'user' }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

// ============================================================================
// Server-Side Rate Limiting & Anti-Bot Protection Middleware
// ============================================================================
const ipRateBuckets = new Map();
const MALICIOUS_BOT_UA = /(nikto|sqlmap|acunetix|masscan|zgrab|nmap|dirbuster|gobuster|wprecon|havij)/i;
const MALICIOUS_PROBE_PATHS = /(\.(php|asp|aspx|jsp|cgi|env|git|sql|bak|swp|sh|bash)$)|(\/(wp-login|wp-admin|phpmyadmin|cgi-bin|\.aws|\.ssh|\/etc\/passwd))/i;
const SENSITIVE_EXTS = ['.env', '.sql', '.key', '.pem', '.cert', '.secret', '.config.js', '.config.ts'];

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip, isAsset) {
  const now = Date.now();
  const windowMs = 10000; // 10-second sliding window
  const limit = isAsset ? 150 : 35; // 150 assets / 10s, 35 HTML/nav pages / 10s

  const key = `${ip}:${isAsset ? 'asset' : 'page'}`;
  let bucket = ipRateBuckets.get(key);

  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 1, windowStart: now };
    ipRateBuckets.set(key, bucket);

    // Opportunistic cleanup of stale entries
    if (ipRateBuckets.size > 2000) {
      for (const [k, b] of ipRateBuckets.entries()) {
        if (now - b.windowStart > windowMs * 2) {
          ipRateBuckets.delete(k);
        }
      }
    }
    return { allowed: true, remaining: limit - 1, limit };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, limit, retryAfterSec: 10 };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, limit };
}


// ============================================================================
// Server-Side Realtime Dispatch Bus & Trips Data Store
// ============================================================================
const TRIPS_STORE_FILE = path.join(ROOT_DIR, '.server_trips_store.json');
let serverTrips = new Map();
const sseClients = new Set();

// Load initial trips from store file if exists
try {
  if (fs.existsSync(TRIPS_STORE_FILE)) {
    const raw = fs.readFileSync(TRIPS_STORE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach(t => serverTrips.set(String(t.id), t));
    }
  }
} catch (_) {}

function persistTripsToDisk() {
  try {
    const list = Array.from(serverTrips.values());
    fs.writeFileSync(TRIPS_STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (_) {}
}

function broadcastSse(type, payload, senderId) {
  const msg = JSON.stringify({ type, payload, senderId, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${msg}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Keep SSE connections alive with comment ping every 15s
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': keepalive\n\n');
    } catch (_) {
      sseClients.delete(client);
    }
  }
}, 15000);

function createRequestHandler(defaultApp) {
  return function requestHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const clientIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] || '').trim();

    const rawUrl = req.url || '/';
    const [pathPart, queryPart] = rawUrl.split('?');
    const reqPath = decodeURI(pathPart);
    const search = (queryPart || '').toLowerCase();
    const referer = (req.headers.referer || '').toLowerCase();
    const ext = path.extname(reqPath).toLowerCase();
    const isAsset = Boolean(ext && ext !== '.html');

    // 1. Anti-Bot Header Inspection
    if (MALICIOUS_BOT_UA.test(userAgent)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access Denied: Automated attack scanner detected' }));
      return;
    }

    // 2. Malicious Vulnerability Probe Blocking
    if (MALICIOUS_PROBE_PATHS.test(reqPath)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access Denied: Restricted probe path' }));
      return;
    }

    // 3. Security: Reject path traversal attempts and dotfiles/secrets
    if (reqPath.includes('..') || reqPath.includes('\0') || /(?:^|\/)\.[a-zA-Z0-9_-]/.test(reqPath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied: Forbidden request path');
      return;
    }

    // 4. Security: Block access to sensitive file extensions
    if (SENSITIVE_EXTS.some(e => reqPath.toLowerCase().endsWith(e))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied: Restricted file type');
      return;
    }

    // 5. Server-Side Rate Limiting (exempt /api/ endpoints for realtime events)
    const rateCheck = reqPath.startsWith('/api/') ? { allowed: true, limit: 1000, remaining: 999 } : checkRateLimit(clientIp, isAsset);
    res.setHeader('X-RateLimit-Limit', String(rateCheck.limit));
    res.setHeader('X-RateLimit-Remaining', String(rateCheck.remaining));

    if (!rateCheck.allowed) {
      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfterSec || 10)
      });
      res.end(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please wait a few seconds before retrying.',
        retryAfter: rateCheck.retryAfterSec || 10
      }));
      return;
    }

    // Determine target app (driver vs user)
    const isDriverReq =
      defaultApp === 'driver' ||
      reqPath.startsWith('/driver') ||
      reqPath.startsWith('/packages/driver') ||
      search.includes('app=driver') ||
      search.includes('view=driver') ||
      referer.includes('/driver') ||
      referer.includes(':5174') ||
      referer.includes('app=driver');

    const primaryDir = isDriverReq ? DRIVER_WWW : USER_WWW;
    const secondaryDir = isDriverReq ? USER_WWW : DRIVER_WWW;


    // Handle CORS preflight options
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    // 1. Server-Sent Events stream: /api/events or /api/realtime
    if (reqPath === '/api/events' || reqPath === '/api/realtime') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 2. Realtime dispatch broadcast: POST /api/dispatch
    if (reqPath === '/api/dispatch' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const type = body.type || 'dispatch';
          const payload = body.payload || body.data || body;
          const senderId = body.senderId || 'anon';

          if (type === 'TRIP_REQUESTED' && payload && payload.id) {
            serverTrips.set(String(payload.id), payload);
            persistTripsToDisk();
          } else if (type === 'TRIP_ACCEPTED' && payload && (payload.tripId || payload.id)) {
            const tId = String(payload.tripId || payload.id);
            if (serverTrips.has(tId)) {
              const existing = serverTrips.get(tId);
              serverTrips.set(tId, { ...existing, status: 'accepted', driver: payload.driver, otp: payload.startOtp });
              persistTripsToDisk();
            }
          }

          broadcastSse(type, payload, senderId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, clients: sseClients.size }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // 3. Trips query: GET /api/trips
    if (reqPath === '/api/trips' && req.method === 'GET') {
      const list = Array.from(serverTrips.values()).sort((a, b) => (b.when_ts || 0) - (a.when_ts || 0));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(list));
      return;
    }

    // 4. Create trip: POST /api/trips
    if (reqPath === '/api/trips' && req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const trip = JSON.parse(bodyStr || '{}');
          if (!trip.id) {
            trip.id = 'TRP-' + Math.floor(1000 + Math.random() * 9000);
          }
          if (!trip.status) trip.status = 'requested';
          if (!trip.when_ts) trip.when_ts = Date.now();

          serverTrips.set(String(trip.id), trip);
          persistTripsToDisk();

          broadcastSse('TRIP_REQUESTED', trip, trip.by_who || 'user');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, trip }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid trip payload' }));
        }
      });
      return;
    }

    // 5. Update trip: POST /api/trips/:id or PATCH /api/trips/:id
    if (reqPath.startsWith('/api/trips/') && (req.method === 'PATCH' || req.method === 'POST')) {
      const tripId = reqPath.split('/api/trips/')[1].split('/')[0].split('?')[0];
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const updates = JSON.parse(bodyStr || '{}');
          const existing = serverTrips.get(String(tripId)) || { id: tripId };
          const updatedTrip = { ...existing, ...updates, updated_at: new Date().toISOString() };
          serverTrips.set(String(tripId), updatedTrip);
          persistTripsToDisk();

          if (updates.status === 'accepted') {
            broadcastSse('TRIP_ACCEPTED', updatedTrip, updates.driver_id || 'driver');
          } else if (updates.status === 'cancelled') {
            broadcastSse('TRIP_CANCELLED', { tripId, ...updates }, 'system');
          } else if (updates.status === 'completed') {
            broadcastSse('TRIP_COMPLETED', updatedTrip, 'system');
          } else {
            broadcastSse('TRIP_UPDATED', updatedTrip, 'system');
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, trip: updatedTrip }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to update trip' }));
        }
      });
      return;
    }

    // Handle HTML routes
    if (reqPath === '/' || reqPath === '' || reqPath === '/user' || reqPath === '/driver') {
      const targetHtml = (reqPath === '/driver' || (reqPath === '/' && isDriverReq))
        ? path.join(DRIVER_WWW, 'index.html')
        : path.join(USER_WWW, 'index.html');

      return serveFile(targetHtml, res);
    }

    if (reqPath === '/admin' || reqPath === '/admin.html') {
      return serveFile(path.join(USER_WWW, 'admin.html'), res);
    }

    // Strip leading /driver or /user prefix for asset lookup if present
    let cleanAssetPath = reqPath;
    if (cleanAssetPath.startsWith('/driver/')) {
      cleanAssetPath = cleanAssetPath.slice(7);
    } else if (cleanAssetPath.startsWith('/user/')) {
      cleanAssetPath = cleanAssetPath.slice(5);
    }

    // Potential file locations to try in order (strictly inside allowed web directories)
    const candidates = [
      path.join(primaryDir, cleanAssetPath),
      path.join(secondaryDir, cleanAssetPath),
      path.join(PUBLIC_DIR, cleanAssetPath),
      path.join(primaryDir, reqPath),
      path.join(secondaryDir, reqPath)
    ];

    let foundFile = null;
    for (const cand of candidates) {
      try {
        const resolved = path.resolve(cand);
        // Verify resolved path stays within allowed web root directories
        const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root + path.sep) || resolved === root);
        if (isAllowed && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          foundFile = resolved;
          break;
        }
      } catch (_) {}
    }

    if (foundFile) {
      return serveFile(foundFile, res);
    }

    // SPA fallback: if it's a navigation request without a file extension, fallback to index.html
    if (!path.extname(reqPath)) {
      const fallbackHtml = isDriverReq
        ? path.join(DRIVER_WWW, 'index.html')
        : path.join(USER_WWW, 'index.html');
      if (fs.existsSync(fallbackHtml)) {
        return serveFile(fallbackHtml, res);
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`File Not Found: ${reqPath}`);
  };
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (readErr, content) => {
    if (readErr) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Server Error: ${readErr.code}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

PORTS.forEach(({ port, defaultApp }) => {
  const server = http.createServer(createRequestHandler(defaultApp));
  server.listen(port, '0.0.0.0', () => {
    const label = defaultApp === 'driver' ? 'Ridingo Driver App' : 'Ridingo User App';
    console.log(`🚀 ${label} running at: http://localhost:${port}/`);
  });
  server.on('error', (err) => {
    console.warn(`Port ${port} notice:`, err.message);
  });
});

const http = require('http');
const fs = require('fs');
const path = require('path');
const { checkFirstRecharge } = require('./first_recharge');
const { rateLimit } = require('./rate_limit');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'sha256-WZRJfWvsnNCPcxzZwvyhovnZGqhZaC+8gPGPRbx6wTk='; " +
    "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, url) {
  if (url.pathname !== '/api/check') return sendJson(res, 404, { status: 'error', error: 'Not found' });
  if (req.method !== 'GET') return sendJson(res, 405, { status: 'error', error: 'Method not allowed' });

  if (!rateLimit(req)) {
    res.setHeader('retry-after', '60');
    return sendJson(res, 429, { status: 'error', error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
  }

  const userId = (url.searchParams.get('userId') || '').trim();
  const serverId = (url.searchParams.get('serverId') || '').trim();

  try {
    const data = await checkFirstRecharge(userId, serverId);
    sendJson(res, 200, data);
  } catch (err) {
    sendJson(res, 400, { status: 'error', error: err.message });
  }
}

function serveStatic(res, url) {
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache'
    });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain' });
      return res.end('Bad request');
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, res, url).catch(() => {
        sendJson(res, 500, { status: 'error', error: 'Internal server error' });
      });
    }
    serveStatic(res, url);
  })
  .listen(PORT, () => {
    console.log(`Diamond Ganda running at http://localhost:${PORT}`);
  });

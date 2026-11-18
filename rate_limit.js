const WINDOW_MS = 60_000;
const LIMIT = 20;
const MAX_IPS = 5000;
const hits = new Map();
let lastPrune = 0;

function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimit(req) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return false;
  }

  recent.push(now);
  hits.set(ip, recent);

  if (now - lastPrune > 300_000) {
    lastPrune = now;
    for (const [key, times] of hits) {
      const fresh = times.filter((t) => now - t < WINDOW_MS);
      if (fresh.length) hits.set(key, fresh);
      else hits.delete(key);
    }
    for (const key of hits.keys()) {
      if (hits.size <= MAX_IPS) break;
      hits.delete(key);
    }
  }

  return true;
}

module.exports = { rateLimit };

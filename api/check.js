const { checkFirstRecharge } = require('../first_recharge');
const { rateLimit } = require('../rate_limit');

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { status: 'error', error: 'Method not allowed' });
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { status: 'error', error: 'Bad request' });
  }

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
};

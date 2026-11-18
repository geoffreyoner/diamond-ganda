const fs = require('fs');

const APP_ID = 100000;
const COUNTRY = 'ID';
const LANGUAGE = 'id';
const API_BASE = process.env.MOBAPAY_API_BASE || 'https://api.mobapay.com';
const MAX_CACHE = 200;
const cache = new Map();

function formatRp(value) {
  const n = Number(String(value).replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  return 'Rp. ' + n.toLocaleString('id-ID').replace(/,/g, '.');
}

function discountPercent(original, sell) {
  const o = Number(original);
  const s = Number(sell);
  if (!o || !s || o <= 0) return null;
  const pct = Math.round((1 - s / o) * 100);
  return pct > 0 ? `-${pct}%` : '0%';
}

async function apiGet(path, userId, serverId, extraParams = {}) {
  const params = new URLSearchParams({
    app_id: String(APP_ID),
    country: COUNTRY,
    language: LANGUAGE,
    game_user_key: userId,
    game_server_key: serverId,
    ...extraParams
  });

  const url = `${API_BASE}/${path}?${params}`;
  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: 'application/json, text/plain, */*',
          origin: 'https://www.mobapay.com',
          referer: 'https://www.mobapay.com/mlbb',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${path}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  throw lastError;
}

function cacheResult(key, data) {
  cache.delete(key);
  cache.set(key, { data, at: Date.now() });
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

function pickCheapestChannel(good) {
  const channels = (good.pay_channel_sub || []).filter(
    (c) => c && c.active === 1 && c.price_local_sell != null
  );
  if (!channels.length) return null;
  return channels.reduce((best, cur) =>
    Number(cur.price_local_sell) < Number(best.price_local_sell) ? cur : best
  );
}

function parseDiamondGanda(shopData) {
  const shopInfo = shopData && shopData.data && shopData.data.shop_info;
  if (!shopInfo) {
    throw new Error('shop_info tidak ditemukan di response API');
  }

  const shelves = shopInfo.shelf_location || [];
  const shelf = shelves.find(
    (s) => s.title && /diamond ganda|double diamond|first recharge/i.test(s.title)
  );

  if (!shelf || !Array.isArray(shelf.goods) || !shelf.goods.length) {
    throw new Error('Section Diamond Ganda tidak ditemukan');
  }

  const items = shelf.goods.map((good) => {
    const [baseRaw, bonusRaw] = String(good.title || '').split('+');
    const base = Number(baseRaw) || 0;
    const bonus = Number(bonusRaw) || 0;
    const limit = good.goods_limit || {};
    const reached = Boolean(limit.reached_limit);
    const channel = pickCheapestChannel(good);
    const original = (channel && channel.price_local_precision) || good.price_local_show;
    const sell = (channel && channel.price_local_sell_precision) || original;

    return {
      id: good.id,
      sku: good.sku || null,
      title: good.title,
      tier: `${base} + ${bonus} Diamond`,
      base_diamonds: base,
      bonus_diamonds: bonus,
      total_diamonds: base + bonus,
      status: reached ? 'Batas pembelian tercapai' : 'Tersedia',
      is_available: !reached,
      original_price: formatRp(original),
      discount_price: formatRp(sell),
      discount_percent: discountPercent(original, sell)
    };
  });

  return {
    title: shelf.title,
    description: shelf.description || '',
    items
  };
}

async function checkFirstRecharge(USER_ID, SERVER_ID) {
  if (!/^\d{4,20}$/.test(String(USER_ID)) || !/^\d{3,20}$/.test(String(SERVER_ID))) {
    throw new Error('User ID dan Server ID harus berupa angka yang valid');
  }

  const key = `${USER_ID}:${SERVER_ID}`;

  try {
    const [userRes, shopRes] = await Promise.all([
      apiGet('api/userinfo', USER_ID, SERVER_ID),
      apiGet('api/app_shop', USER_ID, SERVER_ID)
    ]);

    if (shopRes.code !== 0) {
      throw new Error(shopRes.message || 'Gagal fetch api/app_shop');
    }

    const playerName =
      (userRes.code === 0 && userRes.data && userRes.data.user_name) ||
      (shopRes.data && shopRes.data.user_info && shopRes.data.user_info.user_name) ||
      'Unknown';

    const event = parseDiamondGanda(shopRes);

    const output = {
      status: 'success',
      game: 'Mobile Legends: Bang Bang',
      player: {
        userId: String(USER_ID),
        serverId: String(SERVER_ID),
        name: playerName
      },
      event: {
        title: event.title,
        description: event.description,
        active: true
      },
      diamond_ganda_items: event.items,
      author: 'Goomys',
      source: 'mobapay'
    };

    cacheResult(key, output);
    return output;
  } catch (err) {
    const hit = cache.get(key);
    if (hit) {
      return {
        ...hit.data,
        source: 'cache',
        cached: true,
        cached_at: new Date(hit.at).toISOString()
      };
    }

    throw err;
  }
}

async function main() {
  const userId = process.argv[2] || '12345678';
  const serverId = process.argv[3] || '12345';

  try {
    const output = await checkFirstRecharge(userId, serverId);
    fs.writeFileSync('output.json', JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    const fail = {
      status: 'error',
      error: err.message,
      player: { userId, serverId },
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(fail, null, 2));
    process.exitCode = 1;
  }
}

module.exports = { checkFirstRecharge };

if (require.main === module) main();

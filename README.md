# Diamond Ganda Checker

Web sederhana untuk mengecek paket Diamond Ganda (first recharge) Mobile Legends: Bang Bang berdasarkan User ID dan Server ID.

Frontend statis + satu serverless function untuk Vercel.

## Struktur

- `public/` — landing page, styles, dan script frontend
- `api/check.js` — endpoint serverless `/api/check`
- `first_recharge.js` — logic ambil data dari Mobapay + cache + retry
- `server.js` — server lokal (tanpa dependency)
- `rate_limit.js` — pembatas request per IP

## Jalankan lokal

```bash
npm start
```

Buka `http://localhost:3000`.

## CLI

```bash
npm run cli -- 12345678 12345
```

## API

```
GET /api/check?userId=12345678&serverId=12345
```

Response sukses berisi data player dan `diamond_ganda_items`. Jika Mobapay gagal dan ada cache, response ditandai `cached: true`.

## Deploy ke Vercel

1. Push repo ke GitHub.
2. Import repo di Vercel.
3. Tidak perlu build command; output statis sudah diatur ke `public` lewat `vercel.json`.

## Catatan

- Bukan situs resmi dan tidak berafiliasi dengan Moonton atau Mobile Legends.
- Data diambil dari endpoint publik Mobapay, jadi bisa berubah atau diblokir kapan saja.
- Rate limit 20 request per menit per IP (best-effort).

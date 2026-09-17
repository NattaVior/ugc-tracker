# UGC Tracker

Serverless Roblox Free UGC tracker dengan PostgreSQL, Prisma, Discord Webhook, dan Vercel Cron.

## Environment

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
DISCORD_WEBHOOK_URL=""
CRON_SECRET=""
ADMIN_TOKEN=""
FREE_UGC_PROVIDER="mock"
ROLIMONS_API_URL=""
ROLIMONS_API_TOKEN=""
TRACK_INTERVAL_MINUTES="10"
TRACKER_LOCK_TTL_SECONDS="300"
```

Secret tidak dikirim ke browser. `DISCORD_WEBHOOK` lama tetap dibaca sebagai compatibility fallback, tetapi gunakan `DISCORD_WEBHOOK_URL` baru.

## Install dan database

```bash
npm install
npx prisma generate
npx prisma migrate dev --name initial_tracker
npm run dev
```

Migration harus di-commit. Untuk Vercel/production gunakan:

```bash
npx prisma migrate deploy
npm run build
```

`prisma/migrations` tidak di-ignore.

## Provider

Default:

```env
FREE_UGC_PROVIDER="mock"
```

Mock provider memiliki asset ID `123456789`, `123456790`, dan `123456791`. Scan kedua tidak mengirim ulang item yang sudah memiliki `notifiedAt`.

Untuk authorized provider:

```env
FREE_UGC_PROVIDER="rolimons"
ROLIMONS_API_URL=""
ROLIMONS_API_TOKEN=""
```

Project tidak mengarang endpoint Rolimon's. Jika URL kosong, log:

```text
[ROLIMONS] No authorized endpoint configured.
```

Tidak ada CAPTCHA bypass, Cloudflare bypass, proxy rotation, stealth browser, fingerprint spoofing, atau rate-limit bypass. `rolimonsUrl` hanya digunakan bila benar-benar diberikan oleh provider; tidak ditebak dari asset ID.

## API

Cron:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/scraper
```

Manual:

```bash
curl -X POST -H "x-admin-token: YOUR_ADMIN_TOKEN" https://YOUR_DOMAIN/api/scraper
curl -X POST -H "x-admin-token: YOUR_ADMIN_TOKEN" https://YOUR_DOMAIN/api/test
```

Tanpa token semua endpoint protected mengembalikan HTTP 401. Cron tidak memiliki fallback query-string secret.

## Lock dan deduplication

PostgreSQL memakai conditional atomic `updateMany` untuk mengubah `IDLE` menjadi `RUNNING`. Lock memiliki `lockId` dan `lockExpiresAt`. Lock stale dapat diambil kembali setelah lease kedaluwarsa, dan release hanya berlaku bila `lockId` pemilik masih sama.

`assetId` adalah `@unique`. Selain global lock, setiap item memiliki notification claim singkat sehingga invocation stale tidak mengirim notifikasi yang sama secara bersamaan.

Jika Discord gagal, item tetap disimpan, `notifiedAt` tetap null, dan `notificationError` disimpan. Scan berikutnya akan mencoba kembali.

## Discord retry

HTTP 429 menghormati `Retry-After`. HTTP 5xx dan network error diulang maksimal dua kali dengan exponential backoff. Permanent 4xx tidak diulang tanpa batas.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Vercel

Import repository ke Vercel, masukkan semua environment variable, dan deploy. `vercel.json` menjalankan `/api/scraper` setiap 10 menit. Vercel Cron tidak menjalankan persistent process.

## Limitasi

Data Rolimon's tidak akan muncul otomatis sampai authorized provider endpoint tersedia. Exactly-once delivery webhook tidak dapat dijamin jika proses crash setelah Discord menerima request tetapi sebelum database menyimpan `notifiedAt`; database lock dan notification claim meminimalkan duplicate concurrent delivery.

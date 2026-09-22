# Sistem Absensi QR

Aplikasi absensi kegiatan berbasis React, Vite, dan Supabase.

## Menjalankan secara lokal

1. Salin `.env.example` menjadi `.env`.
2. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari project Supabase.
3. Jalankan `npm install`, lalu `npm run dev`.

Jangan menaruh `service_role` key atau secret Supabase di frontend. File `.env` diabaikan oleh Git.

## Supabase

Jalankan migration di `supabase/migrations` pada project Supabase. Participant tidak memerlukan login; akses publik attendance hanya melalui RPC yang disediakan. Halaman admin menggunakan Supabase Auth dan route admin dilindungi di frontend, dengan RLS tetap menjadi kontrol keamanan database.

Deploy function `supabase/functions/admin-management` sebagai Supabase Edge Function. Function tersebut membutuhkan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` di environment server Supabase. `SUPABASE_SERVICE_ROLE_KEY` hanya digunakan di Edge Function dan tidak boleh dimasukkan ke Vercel atau source frontend.

Migration terakhir otomatis membuat profil aktif dari user Auth yang sudah ada. Setelah itu, akun admin baru hanya dapat dibuat melalui halaman `/admins` oleh admin aktif. Pastikan minimal satu admin aktif tetap tersedia.

## Deploy ke Vercel

1. Push repository ke GitHub.
2. Import repository tersebut ke Vercel.
3. Tambahkan environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada environment yang digunakan.
4. Gunakan build command `npm run build`.

`vercel.json` menyediakan SPA rewrite agar route React dapat di-refresh langsung.

## Validasi

```sh
npm run typecheck
npm run lint
npm run build
```

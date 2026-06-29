# PT KOIN — Induction & Badge Control (Web)

Versi web dari sistem Excel/VBA `Program Man Power Analyst`. MVP ini mencakup:

- Login admin (Supabase Auth)
- Dashboard ringkasan (total peserta, badge, deposit)
- Database Peserta: lihat, cari/filter, input baru dengan validasi
- Summary Deposit: lihat & tambah batch pengajuan kartu

Belum termasuk di MVP (menyusul): Rekonsiliasi otomatis, Analisa Badge Belum
Input per rentang nomor, Cari Peserta multi-kriteria lanjutan.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, database & auth di
Supabase Postgres, hosting di Vercel.

## Setup Supabase (sekali saja)

1. Buka Supabase Dashboard project ini → **SQL Editor**.
2. Copy seluruh isi `supabase/schema.sql`, paste, klik **Run**. Ini membuat
   tabel `peserta` dan `deposit_batch` + Row Level Security.
3. Buat akun admin: **Authentication → Users → Add user** (email + password).
   Akun ini yang dipakai login di halaman web.

## Setup lokal

1. Install dependency: `npm install`
2. Salin `.env.local.example` ke `.env.local`, isi dengan kredensial dari
   Supabase Dashboard → Project Settings → API.
3. Jalankan: `npm run dev`, buka `http://localhost:3000`.

## Migrasi data riil dari Excel (sekali saja)

Data 521 peserta & 27 batch deposit yang sudah ada di
`Workbook/induction-control-system.xlsm` dipindahkan lewat
`scripts/migrate_data.py` (Python), **bukan** lewat file yang ikut di-commit,
karena berisi data pribadi karyawan.

```bash
pip install openpyxl requests python-dotenv
python scripts/migrate_data.py
```

Jalankan dari folder `major_overhaul_2026/` dengan `.env.local` sudah terisi
`SUPABASE_SERVICE_ROLE_KEY`. Script ini idempoten secara longgar (tidak ada
unique constraint di `legacy_record_id`/`legacy_no`), jadi jangan dijalankan
dua kali tanpa mengecek dulu — kalau perlu rerun, kosongkan tabel dulu dari
SQL Editor (`truncate peserta, deposit_batch;`).

## Deploy ke Vercel

Project Vercel sudah dibuat dan terhubung ke GitHub repo ini. Setiap push ke
branch `main` otomatis deploy. Environment variables yang wajib di-set di
Vercel (Project Settings → Environment Variables), sama seperti `.env.local`
tapi **tanpa** `SUPABASE_SERVICE_ROLE_KEY` (tidak pernah dipakai di app/Vercel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Struktur

```
app/
  login/            halaman & action login
  (app)/
    layout.tsx       sidebar + shell setelah login
    dashboard/       ringkasan
    peserta/         list, filter, form input baru
    deposit/         list & form batch deposit
lib/
  supabase/          client browser & server (cookie-based auth)
  constants.ts       daftar dropdown (departemen, kategori, status)
supabase/
  schema.sql         skema tabel + RLS, jalankan manual di SQL Editor
scripts/
  migrate_data.py    migrasi data Excel -> Supabase, dijalankan lokal sekali
```

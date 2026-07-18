-- PT KOIN - Ledger Pengembalian Dana Deposit dari CPS
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).
-- Spec: docs/superpowers/specs/2026-07-17-cps-deposit-refund-ledger-design.md

create table if not exists cps_deposit_refund (
  id bigint generated always as identity primary key,
  tanggal date not null,
  departemen text not null check (departemen in ('ONE PLANT', 'INDIRECT', 'TBN-BOP', 'BOILER', 'SUPPORTING')),
  jumlah_kartu integer not null check (jumlah_kartu > 0),
  jumlah_uang numeric not null check (jumlah_uang >= 0),
  no_referensi text,
  petugas text,
  keterangan text,
  created_at timestamptz not null default now()
);

create index if not exists cps_deposit_refund_departemen_idx on cps_deposit_refund (departemen);

alter table cps_deposit_refund enable row level security;

create policy "admin penuh akses cps_deposit_refund" on cps_deposit_refund
  for all to authenticated using (true) with check (true);

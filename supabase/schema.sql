-- PT KOIN - Sistem Induction & Badge Control
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja saat setup awal).

create table if not exists peserta (
  id bigint generated always as identity primary key,
  legacy_record_id integer,
  no_badge text,
  no_erp text,
  tanggal_induction date not null,
  nama text not null,
  job_no text,
  departemen text not null check (departemen in ('ONE PLANT', 'INDIRECT', 'TBN-BOP', 'BOILER', 'SUPPORTING')),
  kategori text check (kategori in ('KARYAWAN', 'KONTRAKTOR', 'VISITOR')),
  jabatan_deskripsi text,
  leader text,
  ktp boolean,
  sks boolean,
  sertifikat boolean,
  status_badge text not null check (status_badge in ('PENDING', 'ACTIVE', 'RETURNED', 'HANGUS')),
  due_date date,
  remarks text,
  created_at timestamptz not null default now(),
  constraint badge_wajib_kecuali_pending check (status_badge = 'PENDING' or no_badge is not null)
);

create unique index if not exists peserta_no_badge_aktif_uniq
  on peserta (no_badge)
  where no_badge is not null and status_badge <> 'PENDING';

create index if not exists peserta_nama_idx on peserta using gin (nama gin_trgm_ops);
create index if not exists peserta_departemen_idx on peserta (departemen);
create index if not exists peserta_status_badge_idx on peserta (status_badge);

create table if not exists deposit_batch (
  id bigint generated always as identity primary key,
  legacy_no integer,
  tanggal date not null,
  departemen_section text not null check (departemen_section in ('ONE PLANT', 'INDIRECT', 'TBN-BOP', 'BOILER', 'SUPPORTING')),
  keterangan text,
  rentang_no_id text,
  jumlah_kartu integer not null check (jumlah_kartu > 0),
  tarif_kartu numeric not null default 50000,
  total_deposit numeric generated always as (jumlah_kartu * tarif_kartu) stored,
  due_date date,
  status_batch text not null default 'PENDING' check (status_batch in ('DONE', 'PENDING', 'PARTIAL')),
  remarks text,
  created_at timestamptz not null default now()
);

create extension if not exists pg_trgm;

alter table peserta enable row level security;
alter table deposit_batch enable row level security;

create policy "admin penuh akses peserta" on peserta
  for all
  to authenticated
  using (true)
  with check (true);

create policy "admin penuh akses deposit" on deposit_batch
  for all
  to authenticated
  using (true)
  with check (true);

-- PT KOIN - Modul Pengembalian ID Card & APD
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).
-- Spec: docs/superpowers/specs/2026-07-12-pengembalian-id-card-apd-design.md

create table if not exists tarif_potongan (
  item text primary key check (item in ('KARTU','VEST','HELM','INNER','KACAMATA')),
  tarif_hilang numeric not null default 0 check (tarif_hilang >= 0),
  updated_at timestamptz not null default now()
);

insert into tarif_potongan (item, tarif_hilang) values
  ('KARTU', 50000), ('VEST', 0), ('HELM', 0), ('INNER', 0), ('KACAMATA', 0)
on conflict (item) do nothing;

create table if not exists pengembalian (
  id bigint generated always as identity primary key,
  peserta_id bigint not null references peserta(id) on delete cascade,
  tanggal date not null default current_date,
  petugas text,
  catatan text,
  is_migrasi boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pengembalian_peserta_idx on pengembalian (peserta_id);

create table if not exists pengembalian_detail (
  id bigint generated always as identity primary key,
  pengembalian_id bigint not null references pengembalian(id) on delete cascade,
  item text not null check (item in ('KARTU','VEST','HELM','INNER','KACAMATA')),
  kondisi text not null check (kondisi in ('KEMBALI','RUSAK','HILANG')),
  potongan numeric not null default 0 check (potongan >= 0),
  unique (pengembalian_id, item)
);

create index if not exists pengembalian_detail_pid_idx on pengembalian_detail (pengembalian_id);

alter table tarif_potongan enable row level security;
alter table pengembalian enable row level security;
alter table pengembalian_detail enable row level security;

create policy "admin penuh akses tarif" on tarif_potongan
  for all to authenticated using (true) with check (true);
create policy "admin penuh akses pengembalian" on pengembalian
  for all to authenticated using (true) with check (true);
create policy "admin penuh akses pengembalian_detail" on pengembalian_detail
  for all to authenticated using (true) with check (true);

-- Backfill: peserta RETURNED lama yang belum punya kejadian KARTU
with target as (
  select p.id from peserta p
  where p.status_badge = 'RETURNED'
    and not exists (
      select 1 from pengembalian g
      join pengembalian_detail d on d.pengembalian_id = g.id
      where g.peserta_id = p.id and d.item = 'KARTU'
    )
), ins as (
  insert into pengembalian (peserta_id, tanggal, petugas, catatan, is_migrasi)
  select id, current_date, 'migrasi', 'Migrasi dari status RETURNED lama', true
  from target
  returning id
)
insert into pengembalian_detail (pengembalian_id, item, kondisi, potongan)
select id, 'KARTU', 'KEMBALI', 0 from ins;

-- PT KOIN - Lampiran kwitansi untuk cps_deposit_refund
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).

alter table cps_deposit_refund add column if not exists lampiran_url text;

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true)
on conflict (id) do nothing;

create policy "admin penuh akses receipts bucket" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts')
  with check (bucket_id = 'receipts');

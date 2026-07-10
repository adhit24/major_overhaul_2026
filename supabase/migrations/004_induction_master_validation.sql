-- Reconciliation terhadap master HRD "SUMMARY_INDUCTION&APD.xlsx" (sheet INDUCTION,
-- 1065 baris valid = jumlah kartu fisik yang dipinjam dari Cirebon Power).
-- no_urut_induction menyimpan kolom "No." di file Excel tsb sebagai referensi silang.
-- tervalidasi_induction = true berarti baris peserta ini sudah dicocokkan 1:1 dengan
-- satu baris di master Excel (lewat No ERP atau kombinasi ID Badge + Nama).
-- Baris lama yang tidak match (duplikat/typo/usang) TIDAK dihapus, cukup dibiarkan
-- tervalidasi_induction = false supaya HRD bisa review manual sebelum diputuskan.

alter table peserta add column if not exists no_urut_induction integer;
alter table peserta add column if not exists tervalidasi_induction boolean not null default false;

create unique index if not exists peserta_no_urut_induction_uniq on peserta (no_urut_induction) where no_urut_induction is not null;
create index if not exists peserta_tervalidasi_induction_idx on peserta (tervalidasi_induction);

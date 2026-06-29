-- Longgarkan constraint NOT NULL untuk departemen & tanggal_induction.
-- Alasan: 183 dari 1216 data riil tidak punya Departemen pasti (sumber scan
-- dokumen lama ambigu, butuh verifikasi manual) - data ini tetap dimigrasikan
-- dan ditandai "Perlu Verifikasi" di tampilan, bukan dihilangkan/ditolak.

alter table peserta alter column departemen drop not null;
alter table peserta alter column tanggal_induction drop not null;
alter table deposit_batch alter column departemen_section drop not null;

-- Data riil punya banyak No_Badge yang terpakai 2x secara historis (temuan
-- rekonsiliasi, bukan bug) - lihat Docs/build-notes-induction-control-system.md.
-- Sistem asli menandai ini di Dashboard_Error, bukan menolak datanya.
-- Index unique terlalu strict untuk data historis; cek duplikat untuk entri
-- BARU tetap dilakukan di app (lib createPeserta action), jadi index biasa
-- cukup di sini untuk kecepatan query.

drop index if exists peserta_no_badge_aktif_uniq;
create index if not exists peserta_no_badge_idx on peserta (no_badge);

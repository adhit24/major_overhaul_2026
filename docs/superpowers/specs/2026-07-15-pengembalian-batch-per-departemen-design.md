# Batch & Nomor Urut Per Departemen untuk Pengembalian ID Card

## Latar belakang

Modul Pengembalian ID Card sudah punya konsep batch (Batch 1 = 160 pengembalian KARTU yang dikunci per 15 Juli 2026, Batch 2 = pengembalian baru mulai 18 Juli 2026), dengan nomor urut (`urutan`) yang global lintas departemen dan tidak pernah di-renumber.

User ingin nomor urut & batch itu di-scope **per departemen**, supaya laporan/cetak lebih rapi per divisi — mengikuti format `DEPOSIT_TEMPORARY_ID CARD_ACCONT.xlsx` yang sudah dipakai untuk rekapitulasi deposit: tiap departemen jadi SECTION sendiri dengan tabel bernomor mulai dari 1, diakhiri baris SUBTOTAL, dan GRAND TOTAL di akhir dokumen.

Data saat ini (160 kartu terkunci Batch 1): TBN-BOP 120, BOILER 40. Tidak ada departemen lain yang sudah punya data pengembalian KARTU.

## Keputusan desain

1. **`urutan` dan `batch` di-scope per departemen**, bukan global. Setiap departemen (bukan cuma TBN-BOP/BOILER — mekanismenya generik untuk semua 5 departemen) punya hitungan `urutan` sendiri mulai dari 1, dan `batch` sendiri.
2. **Migrasi satu kali**: 160 record yang sekarang bernomor global 1–160 (batch 1) di-renumber ulang per departemen, tetap urut badge kecil→besar seperti sekarang: TBN-BOP jadi urutan 1–120, BOILER jadi urutan 1–40. `batch` tetap 1 untuk semuanya.
3. **Pengembalian baru**: `catatPengembalian` menghitung `urutan` = MAX(urutan) + 1 **dalam departemen peserta itu saja**, dan `batch` = 2 (nilai default kolom, tidak berubah dari sebelumnya — cuma scope query MAX-nya yang berubah jadi per departemen).
4. **Kolom `departemen` didenormalisasi ke tabel `pengembalian`** (diisi dari `peserta.departemen` saat insert) supaya query MAX(urutan) per departemen tidak perlu join ke `peserta` tiap kali dan cepat.
5. **Kolom Batch tetap ditampilkan sebagai kolom biasa** per baris (bukan sub-section terpisah) — data Batch 1 & 2 tercampur dalam satu tabel per departemen, `No` (urutan) jalan terus tanpa putus.

## Cakupan perubahan tampilan

- **Halaman layar `/pengembalian`** (list "Daftar ID Card Dikembalikan"): TIDAK direstruktur jadi section. Tetap list datar dengan search/filter seperti sekarang. Perubahan minimal:
  - Kolom "No" menampilkan `urutan` yang sekarang sudah per-departemen.
  - Header pengelompokan baris kembali ke **Departemen** (bukan Batch lagi), karena `urutan` kini bermakna per departemen.
  - Tambah badge/kolom kecil "Batch" per baris supaya tetap kelihatan Batch 1/2-nya.
- **Halaman cetak `/pengembalian/cetak/kembali`**: direstruktur total mengikuti format `DEPOSIT_TEMPORARY_ID CARD_ACCONT.xlsx`:
  - Judul dokumen + subjudul (tanggal cetak, filter aktif kalau ada).
  - Satu **SECTION per departemen** (urutan departemen mengikuti `DEPARTEMEN` — ONE PLANT, INDIRECT, TBN-BOP, BOILER, SUPPORTING), masing-masing:
    - Judul "SECTION N: [DEPARTEMEN]"
    - Tabel: No, Tanggal, Nama, No Badge, PIN, Jabatan, Kondisi, Batch, Petugas
    - Baris "SUBTOTAL [DEPARTEMEN]" (jumlah kartu)
  - Baris "GRAND TOTAL" di akhir seluruh section.
  - Blok "Catatan" di bawah: definisi Batch 1 (dikunci per 15 Juli 2026) dan Batch 2 (mulai 18 Juli 2026, nomor lanjut otomatis per departemen).
  - Section yang departemennya tidak punya data KARTU-return dilewati (tidak ditampilkan kosong).
- **Export PDF**: struktur sama persis dengan halaman cetak (section per departemen + subtotal + grand total), dibangun dengan `jspdf-autotable` multi-tabel berurutan dalam satu dokumen.

## Yang TIDAK berubah

- Backfill APD lain (Vest/Helm/Inner/Kacamata) tidak ikut skema batch/urutan ini — itu tetap seperti sekarang (tanpa nomor urut).
- Aturan "Batch 1 dikunci, tidak pernah di-renumber lagi setelah migrasi ini" tetap berlaku — migrasi per-departemen ini adalah migrasi ulang yang terakhir kalinya sebelum benar-benar dikunci permanen.
- `batalkanPengembalianDetail` tetap melepas slot `urutan` (jadi celah kosong) saat KARTU dibatalkan, bukan menggeser nomor lain.

# Desain Proses: Pengembalian ID Card Manpower (Demobilisasi Bertahap)

**Tanggal:** 2026-07-03
**Konteks:** Mulai 15 Juli 2026, manpower project major overhaul (BOILER, TBN-BOP, ONE PLANT — total ~1.216 peserta di tabel `peserta`) menyelesaikan pekerjaannya secara bertahap. Diperlukan proses pengembalian ID card yang simple tapi rapi dan tercatat pada administrasi, mengingat riwayat 28 kartu return sebelumnya sempat menghasilkan 6 kasus mismatch nama/badge yang belum tuntas (lihat memory `project_pending_issues.md`).

## Prinsip Desain

- **Simple**: tidak menambah kolom/tabel database baru. Semua state tambahan (mismatch, tidak-kembali) memakai kolom `remarks` yang sudah ada di tabel `peserta`, dengan tag konvensi.
- **Rapi & tercatat**: setiap kartu fisik yang masuk punya jejak — logbook fisik bertanda tangan → status di app → (untuk kartu clean) BAST serah terima ke penerbit.
- **Traceable untuk potong gaji**: kartu yang tidak dikembalikan harus punya bukti tertulis yang bisa dipertanggungjawabkan ke bendahara, karena akan memotong gaji pekerja bersangkutan.
- Penanggung jawab tunggal proses: HSE admin (Anda), yang menerima kartu langsung di satu pos.

## 1. Persiapan Sebelum Sesi Pengembalian

Setiap kali leader/vendor mengabari sejumlah pekerja akan selesai dalam periode tertentu:

- Export/print **roster** dari `/manpower`: No Badge, Nama, Departemen, Status — diurutkan by No Badge.
- Siapkan **logbook fisik** dengan kolom: No, Tanggal, No Badge, Nama, Departemen, Kondisi Kartu (Baik/Rusak), Cocok Roster (Y/N), Catatan, Tanda Tangan Pekerja, Paraf HSE Admin.

## 2. Alur Intake Harian di Pos

1. Pekerja serahkan kartu.
2. HSE admin cari nama/badge di roster cetak.
3. **Cocok** → catat di logbook, minta tanda tangan pekerja, centang di roster.
4. **Tidak cocok** (badge tidak ada di roster, atau nama beda dari yang tercatat) → kartu **tetap diterima** (jangan ditolak — pekerja akan pulang dan sulit dihubungi lagi). Isi kolom "Cocok Roster" = N, catat detail perbedaan di kolom Catatan. Coba klarifikasi ke pekerja/leader selagi masih di lokasi.

## 3. Digitisasi Akhir Hari

- Semua kartu yang **fisiknya** sudah diterima hari itu → `status_badge` diubah jadi **RETURNED** di app (fakta fisik kartu sudah kembali, tidak perlu ditunda oleh urusan verifikasi identitas).
- Untuk baris dengan Cocok=N, tambahkan tag di `remarks`: `[CEK ULANG] lihat logbook dd/mm`.
- Baris bertag `[CEK ULANG]` dikumpulkan jadi **Exception List** mingguan untuk ditelusuri sampai identitasnya jelas — ini SOP untuk mencegah berulangnya kasus mismatch (badge 456/511/219/220/258/RAFTIKA) yang tertunda penyelesaiannya.

## 4. Kartu yang Tidak Kembali (Tracing untuk Potong Gaji)

- Saat leader mengabari "N orang selesai hari ini", HSE admin tandai N nama tersebut sebagai "diharapkan kembali hari ini" (ceklist manual di roster cetak hari itu).
- Akhir hari, siapa saja di daftar itu yang **tidak** menyerahkan kartu → tambahkan tag di `remarks`: `[TIDAK KEMBALI dd/mm]`, status tetap `PENDING`.
- Daftar bertag ini diteruskan ke bendahara sebagai dasar potong gaji, dan menjadi bukti tertulis HSE admin jika ada yang dispute di kemudian hari.

## 5. Serah Terima Kartu ke Penerbit (Cirebon Power) untuk Void

- Kartu fisik yang sudah `RETURNED` dan bersih dari tag `[CEK ULANG]` dikumpulkan per periode (disarankan mingguan).
- Dibuat **Berita Acara Serah Terima (BAST)**: daftar No Badge + Nama + Tanggal + Jumlah total.
- Ditandatangani HSE PT KOIN & petugas Cirebon Power. Copy BAST disimpan HSE sebagai bukti terakhir sebelum kartu di-void oleh penerbit.
- Kartu bertag `[CEK ULANG]` ditahan dulu, tidak ikut diserahkan, sampai statusnya jelas.

## 6. Laporan Mingguan ke HRD/Manajemen

Setiap Senin pagi, rekap minggu sebelumnya via fitur export baru di `/manpower` (lihat bagian 7).

## 7. Fitur Baru: Export Laporan Mingguan (app `/manpower`)

Tombol "Export Laporan Mingguan" dengan dua opsi output:

- **PDF**: kop logo Cirebon Power Service (`PT_KOIN_ASSET/logo_CPS_Transparant.png`) dan KOIN One Plant (`PT_KOIN_ASSET/logo_koin_oneplant_transparant.png`), judul "Laporan Mingguan Pengembalian ID Card", periode tanggal, ringkasan per departemen (RETURNED/PENDING/ACTIVE), Exception List, daftar Tidak Kembali. Siap print/kirim ke HRD.
- **Excel**: raw data + summary sheet untuk kerja internal.

**Sumber data laporan** (tanpa perlu kolom/tabel baru):

| Kategori Laporan | Kondisi |
|---|---|
| Returned (clean) | `status_badge = RETURNED` dan `remarks` tidak mengandung `[CEK ULANG]` |
| Exception List | `status_badge = RETURNED` dan `remarks` mengandung `[CEK ULANG]` |
| Tidak Kembali (potong gaji) | `status_badge = PENDING` dan `remarks` mengandung `[TIDAK KEMBALI` |
| Masih Aktif | `status_badge = ACTIVE` |

## Di Luar Cakupan

- Perubahan skema database (`peserta` table) — sengaja dihindari demi kesederhanaan.
- Digitalisasi real-time di pos (form HP/tablet) — saat ini pos hanya punya logbook fisik; jika ke depan tersedia device di pos, ini bisa jadi peningkatan lanjutan.
- Tanda terima rangkap (carbon copy) per pekerja — tanda tangan di logbook dinilai cukup sebagai bukti untuk kebutuhan saat ini.

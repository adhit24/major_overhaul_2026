# Desain: Modul Pengembalian ID Card & APD

Tanggal: 2026-07-12
Status: Disetujui user (chat 12 Jul 2026)
Aplikasi: major_overhaul_2026 (Next.js App Router + Supabase, deploy Vercel)

## Tujuan

Mencatat pengembalian ID card dan APD (vest, helm, inner helm, kacamata) per pekerja,
sehingga admin HSE bisa menjawab dengan cepat: "orang X sudah mengembalikan apa saja,
apa yang masih kurang, dan berapa potongan depositnya kalau ada yang hilang/rusak."

Keputusan produk (sudah dikonfirmasi user):
1. Riwayat disimpan di tabel terpisah (bukan kolom di `peserta`).
2. Pengembalian BOLEH bertahap (kartu hari ini, helm besok).
3. Kondisi per item dicatat (KEMBALI/RUSAK/HILANG) DAN potongan deposit dihitung.
4. Tarif potongan diatur di aplikasi (master tarif, editable admin, tanpa coding).
5. Ada cetak bukti serah terima dari aplikasi (print-friendly page → PDF via browser).

## Skema Database (migration SQL baru)

### Tabel `tarif_potongan`
| kolom | tipe | keterangan |
|---|---|---|
| item | text PK | 'KARTU' \| 'VEST' \| 'HELM' \| 'INNER' \| 'KACAMATA' |
| tarif_hilang | numeric not null default 0 | potongan saat HILANG |
| updated_at | timestamptz default now() | |

Seed awal: KARTU=50000 (mengikuti deposit_batch), VEST/HELM/INNER/KACAMATA=0.

### Tabel `pengembalian` (kejadian serah terima)
| kolom | tipe | keterangan |
|---|---|---|
| id | bigint identity PK | |
| peserta_id | bigint not null FK -> peserta(id) on delete cascade | |
| tanggal | date not null default current_date | |
| petugas | text | email user login yang mencatat |
| catatan | text | |
| is_migrasi | boolean not null default false | true utk backfill status RETURNED lama |
| created_at | timestamptz default now() | |

### Tabel `pengembalian_detail`
| kolom | tipe | keterangan |
|---|---|---|
| id | bigint identity PK | |
| pengembalian_id | bigint not null FK -> pengembalian(id) on delete cascade | |
| item | text not null check in ('KARTU','VEST','HELM','INNER','KACAMATA') |
| kondisi | text not null check in ('KEMBALI','RUSAK','HILANG') |
| potongan | numeric not null default 0 | auto dari tarif saat HILANG, editable |
| unique (pengembalian_id, item) | | 1 item max 1x per kejadian |

Constraint logis tambahan (di app, bukan DB): satu peserta tidak boleh mencatat item
yang sama dua kali lintas kejadian (kecuali kejadian lama dihapus dulu).

RLS: sama seperti tabel lain — policy "authenticated full access".

### Efek samping ke `peserta.status_badge`
- Saat detail KARTU kondisi KEMBALI/RUSAK tersimpan → `peserta.status_badge = 'RETURNED'`.
- Saat detail KARTU kondisi HILANG tersimpan → `peserta.status_badge = 'HANGUS'`.
- Dilakukan di server action (bukan trigger DB) agar mudah di-debug dan konsisten
  dengan pola actions.ts yang sudah ada.
- Catatan constraint: `badge_wajib_kecuali_pending` menuntut no_badge tetap terisi
  untuk RETURNED/HANGUS — tidak ada perubahan pada no_badge saat pengembalian.

### Backfill (satu kali, bagian dari migration/seed script)
Untuk setiap peserta ber-status RETURNED yang belum punya kejadian pengembalian:
insert 1 kejadian `pengembalian` (tanggal = current_date, petugas = 'migrasi',
catatan = 'Migrasi dari status RETURNED lama', is_migrasi = true) + 1 detail
(KARTU, KEMBALI, potongan 0). APD TIDAK di-backfill (tidak ada datanya).

## Status Turunan per Orang (computed, bukan kolom)

Dihitung di query/page dari akumulasi `pengembalian_detail` milik peserta:
- **LENGKAP**: kelima item sudah tercatat (kondisi apa pun).
- **KURANG**: minimal 1 item tercatat tapi belum 5 — tampilkan item yang belum.
- **BELUM**: tidak ada kejadian sama sekali.

Peserta yang relevan untuk halaman ini: status_badge ACTIVE / RETURNED / HANGUS
(PENDING belum pegang kartu, tidak ikut daftar).

## UI (Next.js App Router, mengikuti pola halaman existing)

### Menu sidebar baru: "Pengembalian" (`/pengembalian`)
1. **Stat strip**: Lengkap X · Kurang Y · Belum Z · Total potongan Rp N.
2. **Kartu pengaturan tarif** (collapsible/kecil): 5 baris item + input nominal, tombol simpan
   (server action update `tarif_potongan`).
3. **Tabel daftar orang**: kolom No Badge, Nama, Dept, Status Badge, Status Pengembalian
   (badge warna LENGKAP hijau / KURANG amber + daftar item kurang / BELUM abu),
   Potongan (jumlah), aksi **Catat**. Search nama/badge (client filter) + filter dept.
4. **Form Catat Pengembalian** (modal, pola EditPesertaModal existing): checklist 5 item;
   item yang dicentang memunculkan pilihan kondisi (default KEMBALI) dan input potongan
   (auto terisi tarif bila HILANG, editable); tanggal (default hari ini); catatan.
   Item yang SUDAH tercatat di kejadian sebelumnya tampil disabled dengan label tanggalnya.
5. **Riwayat per orang** (`/pengembalian/[pesertaId]`): data orang + daftar kejadian +
   detail item + tombol hapus kejadian (guard konfirmasi; menghapus kejadian KARTU
   mengembalikan status_badge ke ACTIVE) + tombol **Cetak Bukti** per kejadian.

### Halaman cetak (`/pengembalian/[pesertaId]/bukti/[pengembalianId]`)
- Layout print-friendly (A4, tanpa sidebar/topbar, `@media print` sembunyikan tombol).
- Isi: 2 logo (public/logos/logo_cps_transparent.png + logo_koin_transparent.png),
  judul "BUKTI SERAH TERIMA PENGEMBALIAN ID CARD & APD", data pekerja
  (nama, badge, dept, PIN), tabel item+kondisi+potongan, total potongan,
  tanggal & petugas, dua kolom tanda tangan (Yang Menyerahkan / Penerima HSE).
- Tombol "Cetak / Simpan PDF" memanggil `window.print()`.

### Integrasi halaman lain
- **Dashboard**: 1 StatCard baru "Pengembalian Lengkap" (X / Y orang) link ke /pengembalian.
- **Summary Deposit**: baris ringkasan "Total Potongan Tercatat" (sum pengembalian_detail.potongan).

## Konstanta & Tipe
- `lib/constants.ts`: tambah `APD_ITEMS = ["KARTU","VEST","HELM","INNER","KACAMATA"]`,
  `KONDISI_ITEM = ["KEMBALI","RUSAK","HILANG"]`, label tampilan per item
  (KARTU="ID Card", INNER="Inner Helm", dst).

## Error handling
- Server action memvalidasi: peserta ada, item belum pernah tercatat utk peserta tsb,
  kondisi valid, potongan >= 0. Error dikembalikan sebagai pesan form (pola actions.ts existing).
- Penghapusan kejadian: konfirmasi di UI; setelah hapus, hitung ulang status_badge
  (kalau tidak ada lagi detail KARTU → kembalikan ke ACTIVE).

## Pengujian & verifikasi
- `npx tsc --noEmit` harus lolos.
- Uji manual alur: catat pengembalian penuh, catat bertahap (2 kejadian), item hilang
  (potongan otomatis), cetak bukti, hapus kejadian, cek status_badge ikut berubah,
  cek stat dashboard & summary deposit.
- Backfill: jumlah kejadian migrasi = jumlah RETURNED existing (45 saat spec ditulis).

## Di luar scope (fase berikutnya, TIDAK dikerjakan sekarang)
- Foto bukti serah terima / lampiran file.
- Notifikasi/reminder due date pengembalian.
- Integrasi potongan otomatis mengurangi nilai `deposit_batch` (sekarang hanya ringkasan).

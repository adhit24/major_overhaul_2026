# Ledger Pengembalian Dana Deposit dari CPS

## Latar belakang

JO KOIN menitipkan dana deposit ke PT Cirebon Power Services (CPS) sejumlah `Rp 50.000 x jumlah kartu` untuk tiap ID Card temporary yang diajukan (tercatat di `deposit_batch`, saat ini total 1065 kartu = Rp 53.250.000). Saat pekerja mengembalikan kartunya, CPS secara bertahap mencairkan kembali sebagian dana itu ke JO KOIN — tidak sekaligus, dan jumlah uang yang cair tidak selalu 1:1 dengan jumlah kartu yang sudah benar-benar dikembalikan (ada jeda waktu antara kartu kembali secara fisik dengan dana cair dari CPS).

Contoh nyata: per 14 Juli 2026, 60 kartu sudah kembali, tapi CPS baru mencairkan Rp 8.000.000 (bukan `60 x 50.000 = 3.000.000` — nominal pencairan CPS tidak dihitung otomatis dari jumlah kartu, melainkan angka yang benar-benar mereka transfer/serahkan, dicatat manual dari kwitansi/bukti dari CPS).

User butuh modul akuntansi sederhana untuk melacak **standing balance**: berapa dana deposit yang masih "nyangkut"/di-hold oleh CPS dan belum dikembalikan, per departemen maupun total keseluruhan. Ini bukan pencatatan otomatis dari `pengembalian` — nominal & jumlah kartu dasar tiap pencairan CPS diinput manual berdasarkan bukti/kwitansi fisik dari CPS, karena pencairan CPS tidak selalu proporsional/real-time terhadap kartu yang sudah kembali.

## Keputusan desain

1. **Tabel baru `cps_deposit_refund`** sebagai ledger (bukan satu angka statis) — tiap baris = satu transaksi pencairan dana dari CPS, karena pencairan terjadi bertahap dengan jumlah yang bisa berbeda-beda tiap kali.
2. **Departemen wajib diisi per transaksi** (enum sama dengan `deposit_batch.departemen_section`), supaya standing balance bisa dilihat per departemen maupun digabung total. Ini karena CPS mencairkan dana per kwitansi yang biasanya sudah per departemen (mengikuti pola kwitansi kartu yang sudah ada).
3. **`jumlah_kartu` dicatat manual per transaksi** (bukan dihitung otomatis dari tabel `pengembalian`) — merepresentasikan jumlah kartu yang CPS sebut sebagai dasar pencairan itu, dipakai untuk rekonsiliasi/audit terhadap jumlah kartu yang benar-benar kembali secara fisik (modul Pengembalian). Bisa berbeda dari jumlah kartu real yang sudah kembali — itu justru variance yang mau ditangkap.
4. **Field referensi**: `no_referensi` (nomor kwitansi/bukti dari CPS, opsional) dan `petugas` (siapa yang mencatat, opsional) untuk audit trail, mengikuti pola field serupa di tabel lain (`pengembalian.petugas`).
5. **Hapus via PIN admin** — pola sama persis dengan `HapusPengembalianButton`, tidak ada edit penuh (kalau salah input, hapus lalu catat ulang).
6. **Standing balance dihitung on-the-fly** di halaman (bukan kolom tersimpan), sama seperti stat card lain di `/deposit` sekarang:
   - Total Deposit (per dept & total) = `SUM(deposit_batch.total_deposit)`
   - Total Dikembalikan CPS (per dept & total) = `SUM(cps_deposit_refund.jumlah_uang)`
   - Standing Balance = Total Deposit − Total Dikembalikan CPS
   - Kartu Sudah Kembali (pekerja) = dari data `pengembalian_detail` yang sudah dipakai section "Summary Pengembalian ID Card" existing (item=KARTU, kondisi != HILANG)
   - Kartu Sudah Dicairkan CPS (per dept & total) = `SUM(cps_deposit_refund.jumlah_kartu)`
   - Selisih Kartu = Kartu Sudah Kembali − Kartu Sudah Dicairkan CPS (bisa negatif → sinyal CPS mengklaim lebih banyak dari yang benar-benar kembali, perlu dicek manual)

## Skema tabel

```sql
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

alter table cps_deposit_refund enable row level security;
create policy "admin penuh akses cps_deposit_refund" on cps_deposit_refund
  for all to authenticated using (true) with check (true);
```

## Cakupan perubahan tampilan

Section baru **"Standing Dana Deposit di CPS"** di halaman `/deposit`, ditempatkan setelah section "Summary Pengembalian ID Card" yang sudah ada. Isi:

1. **4 kartu ringkasan** (pola stat card existing, grid `grid-cols-2 sm:grid-cols-4`): Total Deposit, Total Dikembalikan CPS, Standing Balance, Selisih Kartu.
2. **Tabel breakdown per departemen** — dual-render mobile card / desktop table (pola yang sudah dipakai di seluruh redesign mobile-first sesi ini): Departemen | Total Deposit | Sudah Dikembalikan CPS | Standing Balance | Kartu Kembali (pekerja) | Kartu Dicairkan CPS | Selisih Kartu.
3. **Form "Catat Pengembalian Dana CPS"**: Tanggal\*, Departemen\* (select), Jumlah Kartu\*, Jumlah Uang (Rp)\*, No. Referensi, Petugas, Keterangan — layout `grid-cols-1 sm:grid-cols-6` mengikuti pola form "Tambah Batch Deposit" yang sudah ada.
4. **Riwayat transaksi** (ledger, urut tanggal terbaru dulu) — dual-render mobile card / desktop table, tiap baris ada tombol Hapus berpassword PIN admin.

## File yang disentuh

- `supabase/cps_refund.sql` — migration baru (tabel + RLS), mengikuti pola `supabase/pengembalian.sql`.
- `app/(app)/deposit/actions.ts` — tambah `createCpsRefund` dan `hapusCpsRefund` (server actions).
- `app/(app)/deposit/page.tsx` — tambah query `cps_deposit_refund`, hitung breakdown per departemen, tambah section baru di JSX.
- `components/HapusCpsRefundButton.tsx` — komponen baru, copy pola dari `components/HapusPengembalianButton.tsx`.

## Yang TIDAK berubah

- Tabel `deposit_batch`, `pengembalian`, `pengembalian_detail` tidak diubah skemanya — modul ini murni membaca dari `deposit_batch` dan data pengembalian KARTU yang sudah ada, plus tabel baru `cps_deposit_refund`.
- Tidak ada edit penuh untuk entri `cps_deposit_refund` — hanya tambah dan hapus.
- Tidak ada perhitungan otomatis `jumlah_uang` dari `jumlah_kartu x tarif` — nominal pencairan CPS diinput manual apa adanya dari bukti/kwitansi mereka, karena tidak proporsional.

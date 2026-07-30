# Redesign Visual — Design System Modern untuk PT KOIN Induction & Badge Control

## Latar belakang

Web ini (dulu MVP hasil migrasi dari Excel/VBA) sudah stabil secara fungsional —
semua modul inti (Dashboard, Database Peserta, Manpower, Deposit, Pengembalian,
cetak dokumen) berjalan dan datanya benar. Tampilannya masih terasa polos:
palet `brand` biru generik, kartu/tabel flat tanpa hierarki visual kuat, hampir
tidak ada animasi meski `framer-motion` sudah terpasang sebagai dependency.

User ingin overhaul visual menyeluruh — tampilan lebih modern, konsisten, dan
"dipoles" — karena project overhaul besar ini akan selesai dalam waktu dekat
dan **web ini akan terus dipakai untuk project sejenis di tahun berikutnya**.
Artinya desain yang dibangun sekarang harus jadi fondasi jangka panjang, bukan
tambalan sekali pakai.

Alat yang diminta user untuk desain: skill `ui-ux-pro-max` (design system +
guideline UX), skill `motion-framer` (animasi), dan skill "impeccable" untuk
margin/alignment. Skill "impeccable" ternyata tidak terpasang di mesin ini,
begitu juga tidak ada koneksi MCP ke 21st.dev yang bisa dipakai key API yang
diberikan user (key saja tidak cukup tanpa server MCP yang dikonfigurasi).
Setelah dikonfirmasi ke user, disepakati: pakai `ui-ux-pro-max` sepenuhnya
(sudah mencakup aturan spacing 8px grid, alignment, dan touch-target yang
setara dengan yang "impeccable" akan berikan), dan key 21st.dev tidak dipakai
sama sekali.

## Keputusan desain

### 1. Arah visual: Industrial slate + brand green

Dipilih dari dua opsi yang digenerate `ui-ux-pro-max --design-system` untuk
konteks HSE/industrial (vs opsi generik "blue/amber analytics SaaS"). Alasan:
selaras dengan warna hijau di logo (`JO. KOIN-ONE PLANT`) dan nuansa industrial
plant, sekaligus kontras tinggi yang tetap terbaca baik di layar maupun cetak.

| Token | Hex | Peran |
|---|---|---|
| `primary` (slate) | `#334155` (scale ke `#0F172A`) | header, nav aktif, teks utama |
| `accent` (green) | `#059669` | tombol utama, sukses, aksen brand |
| `warning` (amber) | `#D97706` | status pending/perlu verifikasi (lanjutan warna oranye yang sudah dipakai) |
| `danger` | `#DC2626` | HANGUS, hilang, aksi destruktif |
| `background` | `#F8FAFC` | latar halaman (tidak berubah) |

Font: **Plus Jakarta Sans** (ganti `Inter`) — modern, angka tabular rapi untuk
tabel data padat. Radius kartu naik dari `rounded-lg` ke `rounded-xl`/`2xl`
untuk kesan lebih lembut. Spacing tetap grid 8px (`ui-ux-pro-max` §5).

Mode gelap **tidak** dibangun di versi ini (keputusan user: light-only, lebih
cepat dipoles, bisa ditambah nanti tanpa merombak design system karena token
warna sudah semantic, bukan hardcode).

### 2. Shell & navigasi

- **Sidebar**: indikator item aktif jadi pill yang bergeser mulus antar item
  pakai Motion `layoutId` (shared layout transition), bukan sekadar ganti
  background class seperti sekarang.
- **TopBar**: elevasi halus saat halaman discroll; retint ke token baru.
  Command Palette (sudah pakai `framer-motion`) dipertahankan, hanya
  restyle warna.
- **BottomNav** (mobile): treatment indikator aktif yang sama dengan Sidebar,
  padding aman untuk safe-area.
- **Login**: **di luar cakupan** — koreksi dari draf awal. `app/login/LoginCard.tsx`
  ternyata sudah berupa hero glassmorphism penuh (background foto PLTU dari
  Supabase Storage, kartu blur, animasi spring Motion di tiap elemen, toggle
  show/hide password, badge "BETA") — bukan halaman polos seperti dugaan awal
  (draf pertama salah baca file ini karena satu baris berisi logo base64
  raksasa yang memotong pembacaan). Halaman ini sudah memenuhi standar modern
  yang diinginkan dan tidak memakai token `brand-*` sama sekali (pakai
  `orange-*` langsung, konsisten dengan warna oranye logo), jadi tidak
  terpengaruh oleh perubahan token di bagian 1. Tidak disentuh sama sekali.

### 3. Komponen bersama

- `StatCard` — tambah slot ikon kecil, entrance stagger (~30ms antar kartu)
  saat halaman load, tone warna dipetakan ulang ke token baru.
- `StatusBadge` — bentuk pill dipertahankan, tambah dot/ikon kecil supaya
  status tidak hanya dibedakan oleh warna (aturan aksesibilitas
  `ui-ux-pro-max` §1 `color-not-only`).
- Tabel desktop vs data-card mobile — pola responsive yang sudah ada
  dipertahankan (sudah baik), hanya restyle border/spacing/tipografi.
- Modal (`EditPesertaModal`, `CatatPengembalianModal`, dll.) — dibungkus
  `AnimatePresence`, scale+fade dari sumber trigger, scrim gelap di belakang.
- Button/input — ukuran sentuh 44px yang sudah benar dipertahankan, warna
  diganti ke token baru. **Revisi dari draf awal**: feedback tekan TETAP
  pakai `active:scale-[0.98]` CSS yang sekarang, tidak dimigrasikan ke Motion
  `whileTap`. Alasan: tombol `.btn-primary`/`.btn-secondary`/`.btn-ghost`
  dipakai sebagai `<button>` maupun `<Link>` polos di ~15 file server
  component — migrasi ke Motion berarti mengubah semuanya jadi client
  component, refactor besar untuk manfaat marginal karena `active:scale`
  CSS sudah memenuhi guideline `press-feedback`/`scale-feedback` di
  `ui-ux-pro-max` §7 tanpa risiko/biaya tambahan itu.

### 4. Halaman cetak (surat kehilangan, tanda terima kembali, refund CPS)

Tetap ink-friendly (latar putih, tabel padat, tanpa shadow/gradient/warna
tebal) — tapi ikut dipoles ringan sesuai brand baru: header `slate-800` yang
sekarang diganti aksen hijau brand, tipografi dirapikan. Logo yang sudah
dipasang (`logo_cps_transparent.png`, `logo_koin_transparent.png`) tetap
dipertahankan posisinya.

### 5. Motion (`motion-framer`)

Dipakai untuk makna, bukan dekorasi (mengikuti anti-pattern skill: jangan
animasikan >1-2 elemen kunci per view, jangan animasikan width/height):

- Transisi halaman: fade+slide-up ringan (masuk saja, tanpa animasi keluar)
  di-*key* oleh pathname. **Revisi dari draf awal**: bukan
  `AnimatePresence mode="wait"` penuh dengan animasi keluar — untuk halaman
  Server Component yang mengambil data async, exit-then-enter penuh
  berisiko terasa lebih lambat/berkedip (konten lama sempat memudar
  sebelum konten baru muncul) dan berpotensi konflik dengan Suspense/
  streaming Next.js. Versi masuk-saja tetap memberi kesan "halaman baru"
  tanpa risiko itu, dan tidak ikut ter-trigger saat hanya query string yang
  berubah (mis. mengetik di filter/search) karena key-nya cuma pathname.
- Entrance list/baris tabel: stagger ringan (30–50ms per item).
- Modal enter/exit: `AnimatePresence` + scale/fade.
- Sidebar/BottomNav: shared-layout pill indicator.
- Tombol: `whileTap` spring feedback.
- Semua menghormati `prefers-reduced-motion` (`useReducedMotion` hook).

### 6. Urutan pengerjaan

1. Fondasi design system: token Tailwind (`tailwind.config.ts`), utility
   class di `globals.css` (`.btn-primary`, `.card`, dll direstyle di tempat
   yang sama), font Plus Jakarta Sans.
2. Komponen bersama: Sidebar, TopBar, BottomNav, StatCard, StatusBadge,
   tombol/input, modal wrapper.
3. Halaman satu per satu mengikuti urutan yang paling sering dilihat:
   Shell → Dashboard → Peserta → Deposit → Pengembalian (+ cetak) → Manpower.
   (Login dikecualikan — lihat bagian 2.)

Pendekatan ini dipilih dibanding dua alternatif: (a) restyle halaman
ramai-dulu (Dashboard/Peserta) baru menyusul sisanya — ditolak karena
berisiko tampilan tidak konsisten di tengah rollout; (b) rombak total
arsitektur komponen — ditolak karena struktur kode saat ini sudah bersih,
yang berubah cuma lapisan visual/interaksi, bukan cara data diambil/diolah.

## Cakupan perubahan

- `tailwind.config.ts` — token warna & font baru.
- `app/globals.css` — semua utility class (`btn-primary`, `card`,
  `data-card`, `badge-pill`, dst.) direstyle ke token baru.
- `app/layout.tsx` — ganti font `Inter` → `Plus Jakarta Sans`.
- Semua file di `components/` — restyle + animasi Motion sesuai bagian 3 & 5.
- Semua halaman di `app/(app)/**/page.tsx` — restyle memakai class/komponen
  yang sudah diperbarui. `app/login/**` TIDAK termasuk (lihat bagian 2).
- Halaman cetak di `app/(app)/deposit/cetak/**` dan
  `app/(app)/pengembalian/cetak/**` — restyle ringan sesuai bagian 4.

## Yang TIDAK berubah

- Tidak ada perubahan skema database, query Supabase, Server Action, atau
  logic perhitungan apa pun — murni lapisan visual & interaksi.
- Tidak ada rute baru, tidak ada fitur baru.
- Tidak ada mode gelap di versi ini.
- Tidak ada halaman yang dihapus/digabung; struktur navigasi tetap sama.
- Data cetak/isi dokumen resmi tidak berubah, hanya gaya visualnya (warna
  header, tipografi) — tata letak kolom/isi tabel tetap sama persis.
- `app/login/LoginCard.tsx` — tidak disentuh (sudah modern, lihat bagian 2).
  `public/background_pltu.png` (file lokal) tetap tidak terpakai — halaman
  Login memakai salinannya di Supabase Storage, bukan file lokal ini; ini
  bukan bug baru, hanya dicatat supaya tidak dikira aset yang hilang.

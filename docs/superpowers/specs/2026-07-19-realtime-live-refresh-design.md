# Realtime Live-Refresh for Dashboard, Manpower, Peserta, Pengembalian

## Latar belakang

Semua halaman utama sudah `dynamic = "force-dynamic"`, jadi data selalu segar setiap kali halaman dibuka atau di-refresh manual. User ingin lebih dari itu: halaman yang dibiarkan terbuka (mis. ditampilkan di layar kantor) harus otomatis menampilkan data terbaru begitu ada perubahan di database — instan, bukan lewat polling berkala — tanpa perlu refresh manual.

User secara eksplisit mengecualikan data akuntansi/uang dari cakupan ini: nominal Standing Dana Deposit CPS (di halaman Deposit) hanya boleh berubah lewat input manual kwitansi, tidak boleh "ikut hidup" karena trigger dari tabel lain. Karena halaman Deposit mencampur data ini dengan data hitungan kartu/batch dalam satu halaman, dan Next.js App Router tidak bisa me-refresh sebagian pohon Server Component sementara bagian lain dibiarkan diam, keputusannya adalah: seluruh halaman Deposit dikecualikan dari fitur ini, tetap seperti sekarang (refresh manual/navigasi). Kartu "Total Deposit Tercatat" di Dashboard aman untuk ikut live karena berasal dari `deposit_batch` (aksi sengaja tambah batch), bukan dari alur kwitansi CPS refund.

## Keputusan desain

1. **Mekanisme: Supabase Realtime (postgres_changes) + `router.refresh()`**, bukan polling berkala. Begitu ada INSERT/UPDATE/DELETE di tabel yang didengarkan, semua tab yang terbuka di halaman terkait langsung memanggil ulang data server (logic perhitungan yang sudah ada sekarang dipakai apa adanya, tidak ditulis ulang) dan React merender ulang halaman tanpa reload penuh.
2. **Komponen baru `components/LiveRefresh.tsx`** — client component generik, `return null` (tidak ada tampilan visual), menerima prop `tables: string[]`. Dipasang sekali per halaman yang perlu live, dengan daftar tabel yang relevan untuk halaman itu.
3. **Cakupan halaman:**
   - **Dashboard** → dengar `peserta`, `deposit_batch`, `pengembalian`, `pengembalian_detail`
   - **Manpower Divisi** → dengar `peserta`
   - **Database Peserta** → dengar `peserta`
   - **Pengembalian** → dengar `peserta`, `pengembalian`, `pengembalian_detail`
   - **Deposit** → TIDAK dipasang sama sekali, sengaja dikecualikan penuh.
4. **Debounce 400ms**: perubahan yang datang beruntun (mis. insert banyak baris sekaligus) digabung jadi satu panggilan `router.refresh()`, bukan satu panggilan per event, supaya tidak ada flicker/refresh berulang dalam waktu singkat.
5. **Setup Supabase sekali jalan**: aktifkan replikasi Realtime untuk `peserta`, `deposit_batch`, `pengembalian`, `pengembalian_detail` lewat `ALTER PUBLICATION supabase_realtime ADD TABLE ...`. RLS pada tabel-tabel ini sudah `for all to authenticated using (true)`, jadi tidak perlu policy tambahan — event akan diterima oleh siapa pun yang login, konsisten dengan akses REST API yang sudah ada.
6. **Reconnect**: ditangani otomatis oleh `@supabase/realtime-js` (dipakai internal oleh `supabase-js`), tidak perlu logic reconnect manual.

## Spesifikasi `LiveRefresh`

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-refresh-${tables.join("-")}`);

    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => router.refresh(), 400);
        }
      );
    }

    channel.subscribe();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  return null;
}
```

Dipasang di tiap halaman, contoh untuk Dashboard (`app/(app)/dashboard/page.tsx`), diletakkan langsung setelah `<TopBar .../>`:

```tsx
<LiveRefresh tables={["peserta", "deposit_batch", "pengembalian", "pengembalian_detail"]} />
```

## Cakupan perubahan

- **File baru:** `components/LiveRefresh.tsx`
- **Modifikasi (tambah 1 import + 1 baris JSX masing-masing):** `app/(app)/dashboard/page.tsx`, `app/(app)/manpower/page.tsx`, `app/(app)/peserta/page.tsx`, `app/(app)/pengembalian/page.tsx`
- **Migration Supabase baru:** `supabase/realtime_publication.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE peserta, deposit_batch, pengembalian, pengembalian_detail;`
- **Halaman Deposit (`app/(app)/deposit/page.tsx`)**: TIDAK disentuh sama sekali.

## Yang TIDAK berubah

- Tidak ada perubahan pada logic perhitungan/query yang sudah ada di halaman manapun — `LiveRefresh` murni memicu `router.refresh()`, semua fetching & kalkulasi tetap jalan di server exactly seperti sekarang.
- Tidak ada perubahan RLS — kebijakan `for all to authenticated` yang sudah ada di keempat tabel sudah cukup untuk Realtime.
- Halaman Deposit dan modul Standing Dana Deposit CPS tidak disentuh oleh fitur ini sama sekali.

# Modul Pengembalian ID Card & APD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modul pencatatan pengembalian ID card + APD (vest, helm, inner, kacamata) per pekerja dengan kondisi item, potongan deposit, status LENGKAP/KURANG/BELUM, dan cetak bukti serah terima.

**Architecture:** 3 tabel Supabase baru (`tarif_potongan`, `pengembalian`, `pengembalian_detail`) + status per orang dihitung on-the-fly di server component. Semua mutasi lewat server actions (pola `app/(app)/peserta/actions.ts`). Form catat = modal client component (pola `EditPesertaModal`). Bukti serah terima = halaman print-friendly + `window.print()`.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase JS (`@/lib/supabase/server`), Tailwind. TIDAK ada framework test di repo ini — verifikasi per task = `npx tsc --noEmit` + cek perilaku manual yang disebut eksplisit.

**Spec:** `docs/superpowers/specs/2026-07-12-pengembalian-id-card-apd-design.md`

## Global Constraints

- Nilai item: `'KARTU' | 'VEST' | 'HELM' | 'INNER' | 'KACAMATA'`; kondisi: `'KEMBALI' | 'RUSAK' | 'HILANG'` — persis string ini di DB, constants, dan UI.
- Seed tarif: KARTU=50000, lainnya 0.
- Sinkron `peserta.status_badge`: KARTU KEMBALI/RUSAK → `RETURNED`; KARTU HILANG → `HANGUS`; hapus kejadian yang memuat KARTU → kembali `ACTIVE`. `no_badge` TIDAK PERNAH diubah modul ini.
- Peserta yang tampil di modul: `status_badge in ('ACTIVE','RETURNED','HANGUS')`.
- 1 item hanya boleh tercatat 1x per peserta (validasi di server action, lintas kejadian).
- Supabase membatasi 1000 baris/request → semua fetch daftar pakai 2 batch `range(0,999)` + `range(1000,1999)` (pola `manpower/page.tsx`).
- DDL tidak bisa lewat REST: SQL dijalankan manual di Supabase Dashboard > SQL Editor (pola `supabase/schema.sql`). Task 1 menghasilkan file SQL + langkah manual yang ditandai jelas.
- PIN admin utk aksi destruktif: `242424` (pola EditPesertaModal).
- Bahasa UI: Indonesia. Commit message ringkas bahasa Indonesia + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Setiap task diakhiri `npx tsc --noEmit` (harus exit 0) sebelum commit.

---

### Task 1: SQL — tabel, RLS, seed tarif, backfill

**Files:**
- Create: `supabase/pengembalian.sql`

**Interfaces:**
- Produces: tabel `tarif_potongan(item pk, tarif_hilang, updated_at)`, `pengembalian(id, peserta_id, tanggal, petugas, catatan, is_migrasi, created_at)`, `pengembalian_detail(id, pengembalian_id, item, kondisi, potongan)` — dipakai semua task berikutnya.

- [ ] **Step 1: Tulis file SQL**

```sql
-- PT KOIN - Modul Pengembalian ID Card & APD
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).
-- Spec: docs/superpowers/specs/2026-07-12-pengembalian-id-card-apd-design.md

create table if not exists tarif_potongan (
  item text primary key check (item in ('KARTU','VEST','HELM','INNER','KACAMATA')),
  tarif_hilang numeric not null default 0 check (tarif_hilang >= 0),
  updated_at timestamptz not null default now()
);

insert into tarif_potongan (item, tarif_hilang) values
  ('KARTU', 50000), ('VEST', 0), ('HELM', 0), ('INNER', 0), ('KACAMATA', 0)
on conflict (item) do nothing;

create table if not exists pengembalian (
  id bigint generated always as identity primary key,
  peserta_id bigint not null references peserta(id) on delete cascade,
  tanggal date not null default current_date,
  petugas text,
  catatan text,
  is_migrasi boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pengembalian_peserta_idx on pengembalian (peserta_id);

create table if not exists pengembalian_detail (
  id bigint generated always as identity primary key,
  pengembalian_id bigint not null references pengembalian(id) on delete cascade,
  item text not null check (item in ('KARTU','VEST','HELM','INNER','KACAMATA')),
  kondisi text not null check (kondisi in ('KEMBALI','RUSAK','HILANG')),
  potongan numeric not null default 0 check (potongan >= 0),
  unique (pengembalian_id, item)
);

create index if not exists pengembalian_detail_pid_idx on pengembalian_detail (pengembalian_id);

alter table tarif_potongan enable row level security;
alter table pengembalian enable row level security;
alter table pengembalian_detail enable row level security;

create policy "admin penuh akses tarif" on tarif_potongan
  for all to authenticated using (true) with check (true);
create policy "admin penuh akses pengembalian" on pengembalian
  for all to authenticated using (true) with check (true);
create policy "admin penuh akses pengembalian_detail" on pengembalian_detail
  for all to authenticated using (true) with check (true);

-- Backfill: peserta RETURNED lama yang belum punya kejadian KARTU
with target as (
  select p.id from peserta p
  where p.status_badge = 'RETURNED'
    and not exists (
      select 1 from pengembalian g
      join pengembalian_detail d on d.pengembalian_id = g.id
      where g.peserta_id = p.id and d.item = 'KARTU'
    )
), ins as (
  insert into pengembalian (peserta_id, tanggal, petugas, catatan, is_migrasi)
  select id, current_date, 'migrasi', 'Migrasi dari status RETURNED lama', true
  from target
  returning id
)
insert into pengembalian_detail (pengembalian_id, item, kondisi, potongan)
select id, 'KARTU', 'KEMBALI', 0 from ins;
```

- [ ] **Step 2 (MANUAL — minta user / pemegang dashboard):** buka Supabase Dashboard > SQL Editor > paste isi `supabase/pengembalian.sql` > Run. Verifikasi output query berikut mengembalikan angka:

```sql
select
  (select count(*) from tarif_potongan)          as tarif_rows,        -- harus 5
  (select count(*) from pengembalian where is_migrasi) as migrasi_rows, -- ~45 (= jumlah RETURNED)
  (select count(*) from pengembalian_detail)     as detail_rows;        -- = migrasi_rows
```

> Kalau eksekusi SQL manual belum bisa dilakukan saat implementasi, task selanjutnya TETAP bisa dikerjakan (kode tidak bergantung data ada), tapi verifikasi perilaku ditunda sampai SQL dijalankan.

- [ ] **Step 3: Commit**

```bash
git add supabase/pengembalian.sql
git commit -m "feat: SQL modul pengembalian (tabel, RLS, seed tarif, backfill)"
```

---

### Task 2: Constants & helper status

**Files:**
- Modify: `lib/constants.ts`
- Create: `lib/pengembalian.ts`

**Interfaces:**
- Produces (dipakai Task 3-8):
  - `APD_ITEMS: readonly ["KARTU","VEST","HELM","INNER","KACAMATA"]`, `type ApdItem`
  - `APD_LABELS: Record<ApdItem,string>`
  - `KONDISI_ITEM: readonly ["KEMBALI","RUSAK","HILANG"]`
  - `computeStatusPengembalian(items: string[]): { status: "LENGKAP"|"KURANG"|"BELUM"; missing: ApdItem[] }`
  - `formatRupiah(value: number): string`

- [ ] **Step 1: Tambah konstanta di `lib/constants.ts`** (append di akhir file):

```ts
export const APD_ITEMS = ["KARTU", "VEST", "HELM", "INNER", "KACAMATA"] as const;
export type ApdItem = (typeof APD_ITEMS)[number];
export const APD_LABELS: Record<ApdItem, string> = {
  KARTU: "ID Card",
  VEST: "Vest",
  HELM: "Helm",
  INNER: "Inner Helm",
  KACAMATA: "Kacamata",
};
export const KONDISI_ITEM = ["KEMBALI", "RUSAK", "HILANG"] as const;
export type KondisiItem = (typeof KONDISI_ITEM)[number];
```

- [ ] **Step 2: Buat `lib/pengembalian.ts`**:

```ts
import { APD_ITEMS, type ApdItem } from "@/lib/constants";

export type StatusPengembalian = "LENGKAP" | "KURANG" | "BELUM";

export function computeStatusPengembalian(items: string[]): {
  status: StatusPengembalian;
  missing: ApdItem[];
} {
  const have = new Set(items);
  const missing = APD_ITEMS.filter((i) => !have.has(i));
  if (missing.length === APD_ITEMS.length) return { status: "BELUM", missing };
  if (missing.length === 0) return { status: "LENGKAP", missing };
  return { status: "KURANG", missing };
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
```

- [ ] **Step 3: Verifikasi manual cepat** — jalankan:

```bash
npx tsc --noEmit
```
Expected: exit 0.

Lalu cek logika dengan node one-liner (tanpa framework test):

```bash
npx tsx -e "import {computeStatusPengembalian} from './lib/pengembalian'; console.log(computeStatusPengembalian([]), computeStatusPengembalian(['KARTU']), computeStatusPengembalian(['KARTU','VEST','HELM','INNER','KACAMATA']));"
```
Expected: `{status:'BELUM',missing:[...5]} {status:'KURANG',missing:[...4 tanpa KARTU]} {status:'LENGKAP',missing:[]}`.
(Jika `tsx` tidak tersedia, cukup andalkan tsc + verifikasi UI di Task 4.)

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts lib/pengembalian.ts
git commit -m "feat: konstanta APD & helper status pengembalian"
```

---

### Task 3: Server actions pengembalian

**Files:**
- Create: `app/(app)/pengembalian/actions.ts`

**Interfaces:**
- Consumes: `APD_ITEMS`, `KONDISI_ITEM` dari `@/lib/constants`.
- Produces (dipakai Task 5, 6, 4):
  - `catatPengembalian(formData: FormData): Promise<{ error?: string; ok?: boolean }>`
    - field form: `peserta_id`, `tanggal`, `catatan`, dan per item: `item_KARTU`(="on"), `kondisi_KARTU`, `potongan_KARTU` (dst utk VEST/HELM/INNER/KACAMATA)
  - `hapusPengembalian(formData: FormData): Promise<{ error?: string; ok?: boolean }>` — field: `pengembalian_id`, `peserta_id`
  - `updateTarif(formData: FormData): Promise<{ error?: string; ok?: boolean }>` — field per item: `tarif_KARTU` dst.

- [ ] **Step 1: Tulis `app/(app)/pengembalian/actions.ts`**:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { APD_ITEMS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";

function revalidateAll() {
  revalidatePath("/pengembalian");
  revalidatePath("/dashboard");
  revalidatePath("/deposit");
  revalidatePath("/peserta");
}

export async function catatPengembalian(formData: FormData) {
  const pesertaId = Number(formData.get("peserta_id"));
  const tanggal = String(formData.get("tanggal") ?? "") || null;
  const catatan = String(formData.get("catatan") ?? "").trim() || null;

  const items: { item: ApdItem; kondisi: string; potongan: number }[] = [];
  for (const item of APD_ITEMS) {
    if (formData.get(`item_${item}`) !== "on") continue;
    const kondisi = String(formData.get(`kondisi_${item}`) ?? "KEMBALI");
    const potongan = Number(formData.get(`potongan_${item}`) ?? 0);
    if (!KONDISI_ITEM.includes(kondisi as (typeof KONDISI_ITEM)[number]))
      return { error: `Kondisi tidak valid untuk ${item}.` };
    if (!Number.isFinite(potongan) || potongan < 0)
      return { error: `Potongan tidak valid untuk ${item}.` };
    items.push({ item, kondisi, potongan });
  }

  if (!pesertaId) return { error: "Peserta tidak valid." };
  if (!tanggal) return { error: "Tanggal wajib diisi." };
  if (items.length === 0) return { error: "Pilih minimal satu item yang dikembalikan." };

  const supabase = await createClient();

  const { data: peserta, error: pesertaErr } = await supabase
    .from("peserta").select("id, status_badge").eq("id", pesertaId).single();
  if (pesertaErr || !peserta) return { error: "Peserta tidak ditemukan." };

  // item yang sudah pernah tercatat utk peserta ini (lintas kejadian)
  const { data: existing } = await supabase
    .from("pengembalian")
    .select("id, pengembalian_detail(item)")
    .eq("peserta_id", pesertaId);
  const sudah = new Set(
    (existing ?? []).flatMap((g) =>
      (g.pengembalian_detail as { item: string }[] | null ?? []).map((d) => d.item)
    )
  );
  const dobel = items.filter((i) => sudah.has(i.item));
  if (dobel.length)
    return { error: `Item sudah pernah tercatat: ${dobel.map((d) => d.item).join(", ")}.` };

  const { data: userData } = await supabase.auth.getUser();
  const petugas = userData.user?.email ?? null;

  const { data: kejadian, error: insErr } = await supabase
    .from("pengembalian")
    .insert({ peserta_id: pesertaId, tanggal, catatan, petugas })
    .select("id")
    .single();
  if (insErr || !kejadian) return { error: insErr?.message ?? "Gagal menyimpan kejadian." };

  const { error: detErr } = await supabase.from("pengembalian_detail").insert(
    items.map((i) => ({ pengembalian_id: kejadian.id, item: i.item, kondisi: i.kondisi, potongan: i.potongan }))
  );
  if (detErr) {
    await supabase.from("pengembalian").delete().eq("id", kejadian.id);
    return { error: detErr.message };
  }

  const kartu = items.find((i) => i.item === "KARTU");
  if (kartu) {
    const newStatus = kartu.kondisi === "HILANG" ? "HANGUS" : "RETURNED";
    await supabase.from("peserta").update({ status_badge: newStatus }).eq("id", pesertaId);
  }

  revalidateAll();
  return { ok: true };
}

export async function hapusPengembalian(formData: FormData) {
  const pengembalianId = Number(formData.get("pengembalian_id"));
  const pesertaId = Number(formData.get("peserta_id"));
  if (!pengembalianId || !pesertaId) return { error: "Data tidak valid." };

  const supabase = await createClient();

  const { data: detail } = await supabase
    .from("pengembalian_detail")
    .select("item")
    .eq("pengembalian_id", pengembalianId);
  const punyaKartu = (detail ?? []).some((d) => d.item === "KARTU");

  const { error } = await supabase.from("pengembalian").delete().eq("id", pengembalianId);
  if (error) return { error: error.message };

  if (punyaKartu) {
    // masih ada kejadian KARTU lain? (harusnya tidak, tapi cek utk aman)
    const { data: sisa } = await supabase
      .from("pengembalian")
      .select("id, pengembalian_detail(item)")
      .eq("peserta_id", pesertaId);
    const masihAdaKartu = (sisa ?? []).some((g) =>
      (g.pengembalian_detail as { item: string }[] | null ?? []).some((d) => d.item === "KARTU")
    );
    if (!masihAdaKartu) {
      await supabase.from("peserta").update({ status_badge: "ACTIVE" }).eq("id", pesertaId);
    }
  }

  revalidateAll();
  return { ok: true };
}

export async function updateTarif(formData: FormData) {
  const supabase = await createClient();
  for (const item of APD_ITEMS) {
    const raw = formData.get(`tarif_${item}`);
    if (raw === null) continue;
    const tarif = Number(raw);
    if (!Number.isFinite(tarif) || tarif < 0) return { error: `Tarif tidak valid untuk ${item}.` };
    const { error } = await supabase
      .from("tarif_potongan")
      .update({ tarif_hilang: tarif, updated_at: new Date().toISOString() })
      .eq("item", item);
    if (error) return { error: error.message };
  }
  revalidatePath("/pengembalian");
  return { ok: true };
}
```

- [ ] **Step 2: Verifikasi**

```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/pengembalian/actions.ts"
git commit -m "feat: server actions catat/hapus pengembalian & update tarif"
```

---

### Task 4: Halaman utama `/pengembalian` (list + stat + tarif)

**Files:**
- Create: `app/(app)/pengembalian/page.tsx`
- Create: `components/TarifCard.tsx`

**Interfaces:**
- Consumes: `computeStatusPengembalian`, `formatRupiah` (Task 2); `updateTarif` (Task 3); `CatatPengembalianButton` (Task 5 — di task ini pakai placeholder link dulu TIDAK BOLEH: langsung import; kerjakan Task 5 sebelum typecheck task ini, ATAU ikuti urutan plan: Task 5 dulu baru Task 4. **Urutan eksekusi: Task 5 dikerjakan SEBELUM Task 4.** Penomoran dipertahankan agar review per unit jelas.)
- Produces: route `/pengembalian`.

- [ ] **Step 1: Buat `components/TarifCard.tsx`** (client, inline edit tarif):

```tsx
"use client";

import { useState, useTransition } from "react";
import { updateTarif } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS } from "@/lib/constants";

export function TarifCard({ tarif }: { tarif: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateTarif(fd);
      setMsg(res.error ?? "Tarif tersimpan.");
    });
  }

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-700">
        <span>Tarif Potongan (item HILANG)</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={onSubmit} className="mt-3 space-y-2">
          {APD_ITEMS.map((item) => (
            <label key={item} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{APD_LABELS[item]}</span>
              <input
                name={`tarif_${item}`}
                type="number"
                min={0}
                step={1000}
                defaultValue={tarif[item] ?? 0}
                className="input-field w-36 text-right"
              />
            </label>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? "Menyimpan..." : "Simpan Tarif"}
            </button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
```

> Cek dulu apakah kelas `btn-primary` / `input-field` ada di `app/globals.css`; kalau tidak ada, pakai kelas yang dipakai `peserta/baru/page.tsx` (baca file itu dan samakan).

- [ ] **Step 2: Buat `app/(app)/pengembalian/page.tsx`** (server component):

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { TarifCard } from "@/components/TarifCard";
import { CatatPengembalianButton } from "@/components/CatatPengembalianModal";
import { computeStatusPengembalian, formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, DEPARTEMEN, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  LENGKAP: "bg-emerald-50 text-emerald-700",
  KURANG: "bg-amber-50 text-amber-700",
  BELUM: "bg-slate-100 text-slate-500",
};

export default async function PengembalianPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; status?: string }>;
}) {
  const { q, dept, status } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const cols = "id, no_badge, no_erp, nama, departemen, status_badge";
  const [p1, p2, gRes, tarifRes] = await Promise.all([
    supabase.from("peserta").select(cols).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(0, 999),
    supabase.from("peserta").select(cols).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]).order("nama").range(1000, 1999),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, pengembalian_detail(item, kondisi, potongan)").range(0, 1999),
    supabase.from("tarif_potongan").select("item, tarif_hilang"),
  ]);
  const peserta = [...(p1.data ?? []), ...(p2.data ?? [])];
  const kejadian = gRes.data ?? [];
  const tarif: Record<string, number> = {};
  for (const t of tarifRes.data ?? []) tarif[t.item] = Number(t.tarif_hilang);

  // agregasi per peserta
  const itemsByPeserta = new Map<number, string[]>();
  const potonganByPeserta = new Map<number, number>();
  for (const g of kejadian) {
    const det = (g.pengembalian_detail as { item: string; potongan: number }[] | null) ?? [];
    const arr = itemsByPeserta.get(g.peserta_id) ?? [];
    for (const d of det) {
      arr.push(d.item);
      potonganByPeserta.set(g.peserta_id, (potonganByPeserta.get(g.peserta_id) ?? 0) + Number(d.potongan));
    }
    itemsByPeserta.set(g.peserta_id, arr);
  }

  const rows = peserta.map((p) => {
    const items = itemsByPeserta.get(p.id) ?? [];
    const { status: st, missing } = computeStatusPengembalian(items);
    return { ...p, st, missing, items, potongan: potonganByPeserta.get(p.id) ?? 0 };
  });

  const nLengkap = rows.filter((r) => r.st === "LENGKAP").length;
  const nKurang = rows.filter((r) => r.st === "KURANG").length;
  const nBelum = rows.filter((r) => r.st === "BELUM").length;
  const totalPotongan = rows.reduce((s, r) => s + r.potongan, 0);

  const qLower = (q ?? "").toLowerCase();
  const filtered = rows.filter((r) => {
    if (dept && r.departemen !== dept) return false;
    if (status && r.st !== status) return false;
    if (qLower && !(`${r.nama} ${r.no_badge ?? ""} ${r.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  });

  return (
    <>
      <TopBar title="Pengembalian ID Card & APD" email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card"><p className="text-xs text-slate-500">Lengkap</p><p className="text-xl font-bold text-emerald-600">{nLengkap}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Kurang</p><p className="text-xl font-bold text-amber-600">{nKurang}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Belum Kembali</p><p className="text-xl font-bold text-slate-700">{nBelum}</p></div>
          <div className="card"><p className="text-xs text-slate-500">Total Potongan</p><p className="text-xl font-bold text-red-600">{formatRupiah(totalPotongan)}</p></div>
        </div>

        <TarifCard tarif={tarif} />

        <form method="get" className="flex flex-wrap items-end gap-3">
          <input name="q" defaultValue={q ?? ""} placeholder="Cari nama / badge / PIN" className="input-field w-64" />
          <select name="dept" defaultValue={dept ?? ""} className="input-field">
            <option value="">Semua Divisi</option>
            {DEPARTEMEN.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ""} className="input-field">
            <option value="">Semua Status</option>
            <option value="LENGKAP">LENGKAP</option>
            <option value="KURANG">KURANG</option>
            <option value="BELUM">BELUM</option>
          </select>
          <button type="submit" className="btn-primary text-sm">Filter</button>
        </form>

        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">No Badge</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Status Badge</th>
                  <th className="px-4 py-3">Pengembalian</th>
                  <th className="px-4 py-3 text-right">Potongan</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-5 py-2.5">{r.no_badge ?? "-"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <Link href={`/pengembalian/${r.id}`} className="hover:text-brand-600 hover:underline">{r.nama}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.departemen ?? "-"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status_badge} /></td>
                    <td className="px-4 py-2.5">
                      <span className={`badge-pill ${STATUS_STYLE[r.st]}`}>{r.st}</span>
                      {r.st === "KURANG" && (
                        <span className="ml-2 text-xs text-slate-400">
                          kurang: {r.missing.map((m) => APD_LABELS[m as ApdItem]).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.potongan ? formatRupiah(r.potongan) : "-"}</td>
                    <td className="px-4 py-2.5">
                      <CatatPengembalianButton
                        peserta={{ id: r.id, nama: r.nama, no_badge: r.no_badge }}
                        sudahTercatat={r.items}
                        tarif={tarif}
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">Tidak ada data cocok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verifikasi**

```bash
npx tsc --noEmit
```
Expected: exit 0 (Task 5 harus sudah selesai — lihat catatan urutan di atas).

Manual: `npm run dev` → buka `/pengembalian` → stat & tabel muncul; edit tarif KARTU ke 55000, simpan, refresh — nilai bertahan; kembalikan lagi ke 50000.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/pengembalian/page.tsx" components/TarifCard.tsx
git commit -m "feat: halaman daftar pengembalian + kartu tarif"
```

---

### Task 5: Modal "Catat Pengembalian" (KERJAKAN SEBELUM TASK 4)

**Files:**
- Create: `components/CatatPengembalianModal.tsx`

**Interfaces:**
- Consumes: `catatPengembalian` (Task 3), `APD_ITEMS/APD_LABELS/KONDISI_ITEM` (Task 2).
- Produces: `CatatPengembalianButton({ peserta: {id,nama,no_badge}, sudahTercatat: string[], tarif: Record<string,number> })` — dipakai Task 4.

- [ ] **Step 1: Tulis `components/CatatPengembalianModal.tsx`**:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { catatPengembalian } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";

type Props = {
  peserta: { id: number; nama: string; no_badge: string | null };
  sudahTercatat: string[];
  tarif: Record<string, number>;
};

export function CatatPengembalianButton({ peserta, sudahTercatat, tarif }: Props) {
  const [open, setOpen] = useState(false);
  const semuaTercatat = APD_ITEMS.every((i) => sudahTercatat.includes(i));
  if (semuaTercatat) return <span className="text-xs text-emerald-600">✔ selesai</span>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Catat
      </button>
      {open && <CatatModal {...{ peserta, sudahTercatat, tarif }} onClose={() => setOpen(false)} />}
    </>
  );
}

function CatatModal({ peserta, sudahTercatat, tarif, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [kondisi, setKondisi] = useState<Record<string, string>>({});

  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("peserta_id", String(peserta.id));
    startTransition(async () => {
      const res = await catatPengembalian(fd);
      if (res.error) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-800">Catat Pengembalian</h3>
        <p className="mt-0.5 text-sm text-slate-500">{peserta.nama} — Badge {peserta.no_badge ?? "-"}</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Tanggal</span>
            <input type="date" name="tanggal" defaultValue={today} className="input-field mt-1 w-full" required />
          </label>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            {APD_ITEMS.map((item: ApdItem) => {
              const done = sudahTercatat.includes(item);
              const isChecked = checked[item] ?? false;
              const kond = kondisi[item] ?? "KEMBALI";
              return (
                <div key={item} className="flex flex-wrap items-center gap-2 text-sm">
                  <label className={`flex w-32 items-center gap-2 ${done ? "text-slate-300" : "text-slate-700"}`}>
                    <input
                      type="checkbox"
                      name={`item_${item}`}
                      disabled={done}
                      checked={isChecked}
                      onChange={(e) => setChecked({ ...checked, [item]: e.target.checked })}
                    />
                    {APD_LABELS[item]}
                  </label>
                  {done && <span className="text-xs text-emerald-600">sudah tercatat</span>}
                  {!done && isChecked && (
                    <>
                      <select
                        name={`kondisi_${item}`}
                        value={kond}
                        onChange={(e) => setKondisi({ ...kondisi, [item]: e.target.value })}
                        className="input-field text-xs"
                      >
                        {KONDISI_ITEM.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      {(kond === "HILANG" || kond === "RUSAK") && (
                        <input
                          type="number"
                          name={`potongan_${item}`}
                          min={0}
                          step={1000}
                          defaultValue={kond === "HILANG" ? (tarif[item] ?? 0) : 0}
                          key={`${item}-${kond}`}
                          className="input-field w-28 text-xs"
                          title="Potongan (Rp)"
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">Catatan</span>
            <textarea name="catatan" rows={2} className="input-field mt-1 w-full" />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Batal</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikasi** — `npx tsc --noEmit` exit 0 (komponen belum dirender di halaman mana pun; itu terjadi di Task 4).

- [ ] **Step 3: Commit**

```bash
git add components/CatatPengembalianModal.tsx
git commit -m "feat: modal catat pengembalian item + kondisi + potongan"
```

---

### Task 6: Halaman riwayat per orang `/pengembalian/[pesertaId]`

**Files:**
- Create: `app/(app)/pengembalian/[pesertaId]/page.tsx`
- Create: `components/HapusPengembalianButton.tsx`

**Interfaces:**
- Consumes: `hapusPengembalian` (Task 3), `formatRupiah` (Task 2).
- Produces: route `/pengembalian/[pesertaId]`; `HapusPengembalianButton({ pengembalianId, pesertaId })`.

- [ ] **Step 1: Buat `components/HapusPengembalianButton.tsx`** (client, PIN 242424 seperti EditPesertaModal):

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hapusPengembalian } from "@/app/(app)/pengembalian/actions";

const ADMIN_PIN = "242424";

export function HapusPengembalianButton({ pengembalianId, pesertaId }: { pengembalianId: number; pesertaId: number }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    if (pin !== ADMIN_PIN) { setErr("PIN salah."); return; }
    const fd = new FormData();
    fd.set("pengembalian_id", String(pengembalianId));
    fd.set("peserta_id", String(pesertaId));
    startTransition(async () => {
      const res = await hapusPengembalian(fd);
      if (res.error) setErr(res.error);
      else { setAsk(false); router.refresh(); }
    });
  }

  if (!ask) {
    return <button onClick={() => { setAsk(true); setPin(""); setErr(null); }} className="text-xs text-red-500 hover:underline">Hapus</button>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN admin" className="input-field w-24 text-xs" />
      <button onClick={doDelete} disabled={isPending} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">OK</button>
      <button onClick={() => setAsk(false)} className="text-xs text-slate-400">batal</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Buat `app/(app)/pengembalian/[pesertaId]/page.tsx`**:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { HapusPengembalianButton } from "@/components/HapusPengembalianButton";
import { formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RiwayatPengembalianPage({
  params,
}: {
  params: Promise<{ pesertaId: string }>;
}) {
  const { pesertaId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: p } = await supabase
    .from("peserta")
    .select("id, nama, no_badge, no_erp, departemen, status_badge, jabatan_deskripsi")
    .eq("id", Number(pesertaId))
    .single();
  if (!p) notFound();

  const { data: kejadian } = await supabase
    .from("pengembalian")
    .select("id, tanggal, petugas, catatan, is_migrasi, pengembalian_detail(item, kondisi, potongan)")
    .eq("peserta_id", p.id)
    .order("tanggal", { ascending: false });

  return (
    <>
      <TopBar title={`Riwayat Pengembalian — ${p.nama}`} email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <Link href="/pengembalian" className="text-sm text-slate-400 hover:text-slate-700">← Kembali ke daftar</Link>

        <div className="card flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><span className="text-slate-400">Badge:</span> <b>{p.no_badge ?? "-"}</b></div>
          <div><span className="text-slate-400">PIN:</span> {p.no_erp ?? "-"}</div>
          <div><span className="text-slate-400">Divisi:</span> {p.departemen ?? "-"}</div>
          <div><span className="text-slate-400">Jabatan:</span> {p.jabatan_deskripsi ?? "-"}</div>
          <div><StatusBadge status={p.status_badge} /></div>
        </div>

        {(kejadian ?? []).length === 0 && (
          <div className="card text-center text-slate-400">Belum ada pengembalian tercatat.</div>
        )}

        {(kejadian ?? []).map((g) => {
          const det = (g.pengembalian_detail as { item: string; kondisi: string; potongan: number }[] | null) ?? [];
          const total = det.reduce((s, d) => s + Number(d.potongan), 0);
          return (
            <div key={g.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-700">
                  {g.tanggal} {g.is_migrasi && <span className="ml-2 badge-pill bg-slate-100 text-slate-500">migrasi</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <Link href={`/pengembalian/${p.id}/bukti/${g.id}`} className="text-brand-600 hover:underline">Cetak Bukti</Link>
                  <HapusPengembalianButton pengembalianId={g.id} pesertaId={p.id} />
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {det.map((d) => (
                    <tr key={d.item} className="border-b border-slate-50">
                      <td className="py-1.5">{APD_LABELS[d.item as ApdItem]}</td>
                      <td className="py-1.5"><StatusBadge status={d.kondisi === "KEMBALI" ? "ACTIVE" : d.kondisi === "RUSAK" ? "PARTIAL" : "HANGUS"} /> <span className="text-xs text-slate-500">{d.kondisi}</span></td>
                      <td className="py-1.5 text-right">{Number(d.potongan) ? formatRupiah(Number(d.potongan)) : "-"}</td>
                    </tr>
                  ))}
                  {total > 0 && (
                    <tr><td className="pt-2 font-semibold" colSpan={2}>Total potongan</td><td className="pt-2 text-right font-semibold text-red-600">{formatRupiah(total)}</td></tr>
                  )}
                </tbody>
              </table>
              {g.catatan && <p className="text-xs text-slate-500">Catatan: {g.catatan}</p>}
              <p className="text-xs text-slate-400">Petugas: {g.petugas ?? "-"}</p>
            </div>
          );
        })}
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verifikasi** — `npx tsc --noEmit` exit 0. Manual (setelah SQL Task 1 jalan): klik nama orang di `/pengembalian` → riwayat tampil; hapus kejadian pakai PIN salah → error; PIN benar → hilang & status badge kembali ACTIVE (cek di /peserta).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/pengembalian/[pesertaId]/page.tsx" components/HapusPengembalianButton.tsx
git commit -m "feat: halaman riwayat pengembalian per orang + hapus ber-PIN"
```

---

### Task 7: Halaman cetak bukti serah terima

**Files:**
- Create: `app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx`
- Create: `components/PrintButton.tsx`

**Interfaces:**
- Consumes: `formatRupiah` (Task 2). Logo: `/logos/logo_cps_transparent.png`, `/logos/logo_koin_transparent.png` (sudah ada di `public/logos/`).
- Produces: route bukti; `PrintButton()`.

- [ ] **Step 1: `components/PrintButton.tsx`**:

```tsx
"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 print:hidden"
    >
      Cetak / Simpan PDF
    </button>
  );
}
```

- [ ] **Step 2: `app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx`**:

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatRupiah } from "@/lib/pengembalian";
import { APD_LABELS, type ApdItem } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BuktiPage({
  params,
}: {
  params: Promise<{ pesertaId: string; pengembalianId: string }>;
}) {
  const { pesertaId, pengembalianId } = await params;
  const supabase = await createClient();

  const [{ data: p }, { data: g }] = await Promise.all([
    supabase.from("peserta").select("id, nama, no_badge, no_erp, departemen, jabatan_deskripsi").eq("id", Number(pesertaId)).single(),
    supabase.from("pengembalian").select("id, peserta_id, tanggal, petugas, catatan, pengembalian_detail(item, kondisi, potongan)").eq("id", Number(pengembalianId)).single(),
  ]);
  if (!p || !g || g.peserta_id !== p.id) notFound();

  const det = (g.pengembalian_detail as { item: string; kondisi: string; potongan: number }[] | null) ?? [];
  const total = det.reduce((s, d) => s + Number(d.potongan), 0);

  return (
    <main className="mx-auto max-w-2xl bg-white p-8 text-slate-900 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">BUKTI SERAH TERIMA</h1>
          <p className="text-sm">Pengembalian ID Card & APD — MOH PLTU Cirebon 1</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
        <p><span className="inline-block w-28 text-slate-500">Nama</span>: <b>{p.nama}</b></p>
        <p><span className="inline-block w-28 text-slate-500">No Badge</span>: {p.no_badge ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Divisi</span>: {p.departemen ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">PIN / No ERP</span>: {p.no_erp ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Jabatan</span>: {p.jabatan_deskripsi ?? "-"}</p>
        <p><span className="inline-block w-28 text-slate-500">Tanggal</span>: {g.tanggal}</p>
      </section>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="px-3 py-2">No</th>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Kondisi</th>
            <th className="px-3 py-2 text-right">Potongan</th>
          </tr>
        </thead>
        <tbody>
          {det.map((d, i) => (
            <tr key={d.item} className="border-b border-slate-200">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{APD_LABELS[d.item as ApdItem]}</td>
              <td className="px-3 py-2">{d.kondisi}</td>
              <td className="px-3 py-2 text-right">{Number(d.potongan) ? formatRupiah(Number(d.potongan)) : "-"}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total Potongan Deposit</td>
            <td className="px-3 py-2 text-right font-bold">{total ? formatRupiah(total) : "-"}</td>
          </tr>
        </tbody>
      </table>

      {g.catatan && <p className="mt-3 text-sm"><span className="text-slate-500">Catatan:</span> {g.catatan}</p>}

      <section className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p>Yang Menyerahkan,</p>
          <div className="mx-auto mt-20 w-48 border-b border-slate-400" />
          <p className="mt-1 font-medium">{p.nama}</p>
        </div>
        <div>
          <p>Penerima (HSE),</p>
          <div className="mx-auto mt-20 w-48 border-b border-slate-400" />
          <p className="mt-1 font-medium">{g.petugas ?? "(............................)"}</p>
        </div>
      </section>
    </main>
  );
}
```

> Catatan layout: route ini berada di bawah `app/(app)` yang punya sidebar. Cek `app/(app)/layout.tsx` — kalau sidebar mengganggu hasil print, tambahkan `print:hidden` pada wrapper sidebar/topbar di layout, ATAU pindahkan route bukti ke group `app/bukti/...` tanpa layout. Pilih yang perubahan minimal; wajib dicek visual saat implementasi.

- [ ] **Step 3: Verifikasi** — `npx tsc --noEmit` exit 0. Manual: buka bukti dari riwayat → 2 logo tampil, tabel benar; Ctrl+P → preview bersih (tombol & sidebar tidak ikut).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx" components/PrintButton.tsx
git commit -m "feat: halaman cetak bukti serah terima pengembalian"
```

---

### Task 8: Navigasi + Dashboard + Summary Deposit

**Files:**
- Modify: `components/Sidebar.tsx` (array `NAV_ITEMS`)
- Modify: `components/BottomNav.tsx` (array `NAV`)
- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `app/(app)/deposit/page.tsx`

**Interfaces:**
- Consumes: `computeStatusPengembalian`, `formatRupiah` (Task 2).

- [ ] **Step 1: Sidebar** — tambah item setelah "Manpower Divisi":

```ts
  { href: "/pengembalian", label: "Pengembalian", icon: "🔄" },
```

- [ ] **Step 2: BottomNav** — tambah entri serupa mengikuti bentuk item existing (svg icon bebas, mis. panah melingkar):

```tsx
  {
    href: '/pengembalian',
    label: 'Pengembalian',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 12a9 9 0 0 1 15.5-6.4M21 12a9 9 0 0 1-15.5 6.4" />
        <path d="M18.5 2v4h-4M5.5 22v-4h4" />
      </svg>
    ),
  },
```

- [ ] **Step 3: Dashboard** — di `app/(app)/dashboard/page.tsx`:
  1. Tambah 2 query ke dalam `Promise.all` yang sudah ada:

```ts
    supabase.from("pengembalian").select("peserta_id, pengembalian_detail(item)").range(0, 1999),
    supabase.from("peserta").select("*", { count: "exact", head: true }).in("status_badge", ["ACTIVE", "RETURNED", "HANGUS"]),
```
  (destrukturkan sebagai `pengembalianRes, totalWajibKembali` di array kiri.)

  2. Hitung setelah blok `totalDeposit`:

```ts
  import { APD_ITEMS } from "@/lib/constants"; // di atas file

  const itemsByPeserta = new Map<number, Set<string>>();
  for (const g of pengembalianRes.data ?? []) {
    const set = itemsByPeserta.get(g.peserta_id) ?? new Set<string>();
    for (const d of (g.pengembalian_detail as { item: string }[] | null) ?? []) set.add(d.item);
    itemsByPeserta.set(g.peserta_id, set);
  }
  const nLengkap = [...itemsByPeserta.values()].filter((s) => APD_ITEMS.every((i) => s.has(i))).length;
```

  3. Tambah StatCard (grid `lg:grid-cols-5` → `lg:grid-cols-6`):

```tsx
          <Link href="/pengembalian" className="block">
            <StatCard label="Pengembalian Lengkap" value={`${nLengkap} / ${totalWajibKembali.count ?? 0}`} tone="success" hint="Klik untuk detail" />
          </Link>
```

- [ ] **Step 4: Deposit** — baca `app/(app)/deposit/page.tsx`, tambahkan query + kartu ringkasan "Total Potongan Tercatat" mengikuti gaya kartu yang ada di halaman itu:

```ts
  const { data: potonganRows } = await supabase.from("pengembalian_detail").select("potongan").range(0, 1999);
  const totalPotongan = (potonganRows ?? []).reduce((s, r) => s + Number(r.potongan), 0);
```

```tsx
  <StatCard label="Total Potongan Tercatat" value={formatRupiah(totalPotongan)} tone={totalPotongan ? "danger" : "default"} hint="dari pengembalian hilang/rusak" />
```
  (`formatRupiah` di file deposit: kalau file itu sudah punya formatter lokal, pakai yang ada; kalau tidak, import dari `@/lib/pengembalian`.)

- [ ] **Step 5: Verifikasi** — `npx tsc --noEmit` exit 0; `npm run dev`: menu Pengembalian muncul di sidebar & bottom nav, StatCard dashboard tampil, kartu potongan di deposit tampil.

- [ ] **Step 6: Commit**

```bash
git add components/Sidebar.tsx components/BottomNav.tsx "app/(app)/dashboard/page.tsx" "app/(app)/deposit/page.tsx"
git commit -m "feat: navigasi + stat pengembalian di dashboard & deposit"
```

---

### Task 9: Verifikasi end-to-end & deploy

**Files:** tidak ada file baru.

- [ ] **Step 1:** Pastikan SQL Task 1 sudah dijalankan di Supabase (verif query Step 2 Task 1). Kalau belum — berhenti, minta user menjalankannya.
- [ ] **Step 2:** `npm run build` — harus sukses tanpa error.
- [ ] **Step 3:** Uji alur lengkap di dev/preview:
  1. `/pengembalian` — daftar tampil; orang RETURNED hasil backfill berstatus KURANG (baru KARTU).
  2. Catat pengembalian bertahap: orang A centang VEST+HELM (KEMBALI) → status KURANG (kurang: Inner Helm, Kacamata, ...); kejadian kedua sisa item → LENGKAP.
  3. Orang B: KARTU kondisi HILANG → potongan auto 50000 → status_badge jadi HANGUS di /peserta.
  4. Cetak bukti kejadian orang A → print preview bersih.
  5. Hapus kejadian KARTU orang B dengan PIN 242424 → status_badge kembali ACTIVE.
  6. Dashboard & deposit menampilkan angka yang berubah sesuai langkah di atas.
- [ ] **Step 4:** Push & tunggu deploy Vercel:

```bash
git push
```
- [ ] **Step 5:** Ulangi cek nomor 1 & 4 di URL produksi (major-overhaul-2026.vercel.app).
```

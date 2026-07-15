# Batch & Nomor Urut Per Departemen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the `pengembalian.batch`/`pengembalian.urutan` numbering to be per-departemen instead of global, and restructure the print page + PDF export of "Daftar ID Card Dikembalikan" into one SECTION per departemen (numbered table + SUBTOTAL row), ending in a GRAND TOTAL and a Catatan block — matching the layout of `DEPOSIT_TEMPORARY_ID CARD_ACCONT.xlsx`.

**Architecture:** Denormalize `departemen` onto the `pengembalian` table so per-department MAX(urutan) lookups don't need a join. Re-run the existing backfill migration with `partition by departemen` instead of a single global sequence. Print/PDF group rows by departemen (SECTION), each with its own running `urutan` and a SUBTOTAL row; the on-screen list keeps its current flat searchable-list shape but reverts its group header from Batch back to Departemen and adds a small Batch badge per row.

**Tech Stack:** Next.js 15 App Router (Server Components + Server Actions), Supabase (Postgres via `@supabase/ssr` client + direct MCP `execute_sql`/`apply_migration` for schema/data work), Tailwind, `jspdf` + `jspdf-autotable`.

## Global Constraints

- No test framework exists in this repo. Verification = `npx tsc --noEmit` (must be silent) run from `d:\PT_KOIN\major_overhaul_2026` after every task, plus a direct Supabase read to confirm data-layer changes.
- Never renumber an already-assigned `urutan` once a task confirms it's correct — cancellations release the slot (`urutan = null`) rather than reassigning it (established rule, `app/(app)/pengembalian/actions.ts:150-156`).
- `DEPARTEMEN` order (`lib/constants.ts:1`) is `["ONE PLANT", "INDIRECT", "TBN-BOP", "BOILER", "SUPPORTING"]` — always iterate/sort in this order, never alphabetically.
- Supabase project id for MCP calls: `sxqsvogwsucuzdjcoqzf`.
- Commit after every task (`git add <exact files>`, then commit, matching this repo's existing message style — imperative summary line, blank line, body, `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer). Do not push until the final task's verification passes; then push once at the end (or after each task if the user prefers — ask if unclear).

---

### Task 1: Denormalize `departemen` onto `pengembalian`, renumber `urutan` per departemen

**Files:**
- None (this is a Supabase schema + data migration, applied via the `mcp__claude_ai_Supabase__apply_migration` tool — no repo file changes).

**Interfaces:**
- Produces: `pengembalian.departemen` (text, nullable) — later tasks read/write this column directly instead of joining through `peserta`.
- Produces: `pengembalian.urutan` — after this task, existing Batch-1 rows are numbered 1..N **per departemen** (previously 1..160 globally). TBN-BOP becomes 1–120, BOILER becomes 1–40 (verify these exact counts in Step 2 before trusting them — they were true as of 2026-07-15 but re-check).

- [ ] **Step 1: Confirm current locked population and its departemen breakdown**

Run via `mcp__claude_ai_Supabase__execute_sql` (project_id `sxqsvogwsucuzdjcoqzf`):

```sql
select p.departemen, count(*)
from pengembalian_detail pd
join pengembalian g on g.id = pd.pengembalian_id
join peserta p on p.id = g.peserta_id
where pd.item = 'KARTU' and pd.kondisi != 'HILANG'
group by p.departemen
order by p.departemen;
```

Expected (as of 2026-07-15): `TBN-BOP` → 120, `BOILER` → 40. If the numbers differ (e.g. more reactivations/cancellations happened since), that's fine — just note the real counts, they don't change the migration logic below.

- [ ] **Step 2: Apply the migration**

Run via `mcp__claude_ai_Supabase__apply_migration` (project_id `sxqsvogwsucuzdjcoqzf`, name `pengembalian_departemen_scoped_urutan`):

```sql
alter table pengembalian add column if not exists departemen text;

-- backfill departemen on every existing pengembalian row from its peserta
update pengembalian g
set departemen = p.departemen
from peserta p
where p.id = g.peserta_id and g.departemen is null;

-- renumber urutan to be per-departemen for the currently-locked KARTU-return population.
-- Only rows that already have urutan set (i.e. already-locked KARTU-return kejadian) are
-- touched; batch stays 1 for all of them (no batch-2 rows exist yet at time of writing, but
-- this WHERE clause protects against accidentally renumbering future batch-2 rows too).
with target as (
  select g.id as kejadian_id, g.departemen,
         coalesce(nullif(regexp_replace(p.no_badge, '[^0-9]', '', 'g'), '')::int, 999999) as bnum
  from pengembalian g
  join peserta p on p.id = g.peserta_id
  where g.urutan is not null and g.batch = 1
),
numbered as (
  select kejadian_id, departemen, row_number() over (partition by departemen order by bnum) as rn
  from target
)
update pengembalian g
set urutan = n.rn
from numbered n
where g.id = n.kejadian_id;
```

- [ ] **Step 3: Verify**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select departemen, batch, count(*), min(urutan), max(urutan)
from pengembalian
where urutan is not null
group by departemen, batch
order by departemen, batch;
```

Expected: one row per departemen that has data, `batch = 1`, `min(urutan) = 1`, `max(urutan)` equal to that departemen's count from Step 1. For 2026-07-15 data: `TBN-BOP | 1 | 120 | 1 | 120` and `BOILER | 1 | 40 | 1 | 40`.

Also confirm no row lost its `departemen`:

```sql
select count(*) from pengembalian where departemen is null;
```

This should equal the number of pengembalian rows whose peserta has `departemen is null` (there may be a few from `Tanpa Divisi` peserta) — sanity-check the number is small (single digits), not a large fraction of the table.

- [ ] **Step 4: No commit needed** (schema-only change applied directly via MCP, not a repo file) — proceed to Task 2.

---

### Task 2: Scope `catatPengembalian`'s urutan assignment to the peserta's departemen

**Files:**
- Modify: `app/(app)/pengembalian/actions.ts:37-78`

**Interfaces:**
- Consumes: `pengembalian.departemen` column from Task 1.
- Produces: no change to the function's external signature/return shape (`{ error }` or `{ ok: true }`) — only internal `urutan`/`batch`/`departemen` computation changes.

- [ ] **Step 1: Fetch the peserta's departemen alongside status_badge**

In `app/(app)/pengembalian/actions.ts`, change:

```ts
  const { data: peserta, error: pesertaErr } = await supabase
    .from("peserta").select("id, status_badge").eq("id", pesertaId).single();
  if (pesertaErr || !peserta) return { error: "Peserta tidak ditemukan." };
```

to:

```ts
  const { data: peserta, error: pesertaErr } = await supabase
    .from("peserta").select("id, status_badge, departemen").eq("id", pesertaId).single();
  if (pesertaErr || !peserta) return { error: "Peserta tidak ditemukan." };
```

- [ ] **Step 2: Scope the MAX(urutan) lookup and the insert to the peserta's departemen**

Replace the batch/urutan block:

```ts
  // Batch 1 (161 orang pertama) dikunci sebagai arsip; setiap pengembalian KARTU baru sejak
  // saat ini otomatis masuk batch 2 dan penomoran "urutan" berlanjut dari yang terakhir
  // (tidak mengulang dari 1), supaya daftar cetak lama tidak berubah nomornya.
  let batchFields: { batch: number; urutan: number } | Record<string, never> = {};
  if (items.some((i) => i.item === "KARTU")) {
    const { data: maxRow } = await supabase
      .from("pengembalian")
      .select("urutan")
      .not("urutan", "is", null)
      .order("urutan", { ascending: false })
      .limit(1)
      .maybeSingle();
    batchFields = { batch: 2, urutan: (maxRow?.urutan ?? 0) + 1 };
  }

  const { data: kejadian, error: insErr } = await supabase
    .from("pengembalian")
    .insert({ peserta_id: pesertaId, tanggal, catatan, petugas, ...batchFields })
    .select("id")
    .single();
```

with:

```ts
  // Batch 1 (data terkunci per 15 Jul 2026) tidak pernah di-renumber lagi. Setiap pengembalian
  // KARTU baru sejak sekarang otomatis masuk batch 2 dan penomoran "urutan" berlanjut dari yang
  // terakhir DALAM DEPARTEMEN PESERTA ITU SAJA (bukan lintas departemen), supaya laporan per
  // divisi tetap bernomor rapi 1..N sendiri-sendiri.
  let batchFields: { batch: number; urutan: number; departemen: string | null } | { departemen: string | null } = {
    departemen: peserta.departemen,
  };
  if (items.some((i) => i.item === "KARTU")) {
    const { data: maxRow } = await supabase
      .from("pengembalian")
      .select("urutan")
      .eq("departemen", peserta.departemen)
      .not("urutan", "is", null)
      .order("urutan", { ascending: false })
      .limit(1)
      .maybeSingle();
    batchFields = { batch: 2, urutan: (maxRow?.urutan ?? 0) + 1, departemen: peserta.departemen };
  }

  const { data: kejadian, error: insErr } = await supabase
    .from("pengembalian")
    .insert({ peserta_id: pesertaId, tanggal, catatan, petugas, ...batchFields })
    .select("id")
    .single();
```

- [ ] **Step 3: Typecheck**

Run: `cd d:\PT_KOIN\major_overhaul_2026 && npx tsc --noEmit`
Expected: no output (silent success).

- [ ] **Step 4: Manual smoke test via direct insert (simulates what the UI does)**

Run via `mcp__claude_ai_Supabase__execute_sql` (read-only check, not a mutation) to confirm a hypothetical next TBN-BOP KARTU return would land on urutan 121:

```sql
select coalesce(max(urutan), 0) + 1 as next_urutan
from pengembalian
where departemen = 'TBN-BOP' and urutan is not null;
```

Expected: `121` (or whatever TBN-BOP's current max + 1 is if Task 1's counts differed). Do the same for `BOILER`, expect `41`.

- [ ] **Step 5: Commit**

```bash
cd d:\PT_KOIN\major_overhaul_2026
git add app/\(app\)/pengembalian/actions.ts
git commit -m "$(cat <<'EOF'
Scope catatPengembalian urutan assignment to peserta departemen

MAX(urutan) lookup and the new pengembalian row now filter/set on
departemen so numbering continues per-department (TBN-BOP, BOILER, etc.)
instead of one global sequence, matching the per-departemen migration
applied to the locked Batch 1 data.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: On-screen list — group by Departemen again, add a Batch badge per row

**Files:**
- Modify: `app/(app)/pengembalian/page.tsx`

**Interfaces:**
- Consumes: `KartuRow.pengembalian.batch`, `KartuRow.pengembalian.urutan` (already fetched — no query change needed, `departemen` is already selected via the nested `peserta` object).
- Produces: no change to `ExportPdfRow`/`ExportPdfButton` usage here — that's Task 5.

- [ ] **Step 1: Revert the sort to departemen-first (urutan is now department-scoped, so departemen-then-urutan gives the correct per-department sequence)**

In `app/(app)/pengembalian/page.tsx`, find:

```ts
  // Batch 1 (161 orang) dikunci - urutannya sudah permanen. Pengembalian baru (batch 2, mulai
  // 18 Jul 2026) ditambahkan di bawahnya dengan nomor lanjut (162, dst), bukan diacak ulang
  // per divisi, supaya daftar cetak batch 1 tidak pernah berubah.
  const kartuRows = ((kartuRes.data ?? []) as unknown as KartuRow[])
    .slice()
    .sort((a, b) => (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity));
```

Replace with:

```ts
  // urutan sekarang per-departemen (lihat migrasi 2026-07-15), jadi urutkan departemen dulu
  // (urutan bisnis, bukan alfabetis) baru urutan di dalamnya - hasilnya tiap departemen tampil
  // sebagai blok berurutan 1..N sendiri-sendiri, sama seperti akan tercetak.
  const kartuRows = ((kartuRes.data ?? []) as unknown as KartuRow[])
    .slice()
    .sort((a, b) =>
      deptRank(a.pengembalian?.peserta?.departemen) - deptRank(b.pengembalian?.peserta?.departemen) ||
      (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity)
    );
```

- [ ] **Step 2: Revert the table's group header from Batch back to Departemen, keep a small Batch badge per row**

Find the "Daftar ID Card Dikembalikan" table body (inside the `{filteredKartuRows.length > 0 && (...)}` block):

```tsx
                <tbody>
                  {(() => {
                    let lastBatch: number | null | undefined = undefined;
                    return filteredKartuRows.map((r, i) => {
                      const p = r.pengembalian?.peserta;
                      const b = r.pengembalian?.batch ?? null;
                      const showGroup = b !== lastBatch;
                      lastBatch = b;
                      return (
                        <Fragment key={`${r.pengembalian?.id}-${i}`}>
                          {showGroup && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {batchLabel(b)}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-50">
                            <td className="px-5 py-2.5 tabular-nums text-slate-500">{r.pengembalian?.urutan ?? "-"}</td>
                            <td className="px-4 py-2.5 tabular-nums">{p?.no_badge ?? "-"}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {p ? <Link href={`/pengembalian/${p.id}`} className="hover:text-brand-600 hover:underline">{p.nama}</Link> : "-"}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">{p?.no_erp ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p?.departemen ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p?.jabatan_deskripsi ?? "-"}</td>
                            <td className="px-4 py-2.5">
                              <KondisiBadge kondisi={r.kondisi} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {r.pengembalian?.tanggal ?? "-"}
                              {r.pengembalian?.is_migrasi && <span className="ml-2 badge-pill bg-slate-100 text-slate-500">migrasi</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.petugas ?? "-"}</td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
```

Replace with (adds a "Batch" column, drops the redundant "Divisi" column since it's now the group header, group header switches to departemen):

```tsx
                <tbody>
                  {(() => {
                    let lastDept: string | null | undefined = undefined;
                    return filteredKartuRows.map((r, i) => {
                      const p = r.pengembalian?.peserta;
                      const showGroup = p?.departemen !== lastDept;
                      lastDept = p?.departemen;
                      return (
                        <Fragment key={`${r.pengembalian?.id}-${i}`}>
                          {showGroup && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {p?.departemen ?? "Tanpa Divisi"}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-slate-50">
                            <td className="px-5 py-2.5 tabular-nums text-slate-500">{r.pengembalian?.urutan ?? "-"}</td>
                            <td className="px-4 py-2.5 tabular-nums">{p?.no_badge ?? "-"}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">
                              {p ? <Link href={`/pengembalian/${p.id}`} className="hover:text-brand-600 hover:underline">{p.nama}</Link> : "-"}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">{p?.no_erp ?? "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600">{p?.jabatan_deskripsi ?? "-"}</td>
                            <td className="px-4 py-2.5">
                              <span className="badge-pill bg-slate-100 text-slate-600">{batchLabel(r.pengembalian?.batch)}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <KondisiBadge kondisi={r.kondisi} />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">
                              {r.pengembalian?.tanggal ?? "-"}
                              {r.pengembalian?.is_migrasi && <span className="ml-2 badge-pill bg-slate-100 text-slate-500">migrasi</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.petugas ?? "-"}</td>
                          </tr>
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
```

- [ ] **Step 3: Update the matching `<thead>` for that table**

Find:

```tsx
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">No</th>
                    <th className="px-4 py-3">No Badge</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">PIN</th>
                    <th className="px-4 py-3">Divisi</th>
                    <th className="px-4 py-3">Jabatan</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Tanggal Kembali</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
```

Replace with:

```tsx
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3">No</th>
                    <th className="px-4 py-3">No Badge</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">PIN</th>
                    <th className="px-4 py-3">Jabatan</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Tanggal Kembali</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
```

(Column count stays 9, matching the `colSpan={9}` group-header row already in place.)

- [ ] **Step 4: Typecheck**

Run: `cd d:\PT_KOIN\major_overhaul_2026 && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
cd d:\PT_KOIN\major_overhaul_2026
git add app/\(app\)/pengembalian/page.tsx
git commit -m "$(cat <<'EOF'
On-screen Daftar ID Card Dikembalikan: group by departemen again, add Batch column

urutan is now per-departemen (previous commit), so the list groups by
departemen again (dropped the now-redundant Divisi column since it's the
group header) and shows Batch 1/2 as its own column instead of the group
header.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Restructure the print page into SECTION-per-departemen with SUBTOTAL + GRAND TOTAL + Catatan

**Files:**
- Modify: `app/(app)/pengembalian/cetak/kembali/page.tsx` (full rewrite of the render section; data-fetching/filtering logic is reused with small changes)

**Interfaces:**
- Consumes: `pengembalian.departemen`, `pengembalian.batch`, `pengembalian.urutan` (already selected in the existing query — no query shape change needed beyond what's already there).
- Produces: no change to the route's URL/searchParams contract (`?q=&dept=`) — `Link` from `page.tsx` Task 3 keeps working unchanged.

- [ ] **Step 1: Replace the whole file**

Read the current file first to confirm it still matches (in case of drift):

Run: `cat "d:\PT_KOIN\major_overhaul_2026\app\(app)\pengembalian\cetak\kembali\page.tsx"` (or the `Read` tool) and diff mentally against the version below before overwriting — if it drifted, port the differences forward instead of blindly pasting.

Replace the entire file content with:

```tsx
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { formatPetugas } from "@/lib/pengembalian";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Row = {
  kondisi: string;
  pengembalian: {
    tanggal: string;
    petugas: string | null;
    batch: number | null;
    urutan: number | null;
    departemen: string | null;
    peserta: {
      id: number;
      nama: string;
      no_badge: string | null;
      no_erp: string | null;
      departemen: string | null;
      jabatan_deskripsi: string | null;
    } | null;
  } | null;
};

const batchLabel = (b: number | null | undefined) =>
  b === 1 ? "Batch 1" : b === 2 ? "Batch 2" : `Batch ${b ?? "-"}`;

export default async function CetakKembaliPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const { q, dept } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pengembalian_detail")
    .select("kondisi, pengembalian(tanggal, petugas, batch, urutan, departemen, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  const deptRank = (d: string | null | undefined) => {
    const i = DEPARTEMEN.indexOf((d ?? "") as (typeof DEPARTEMEN)[number]);
    return i === -1 ? DEPARTEMEN.length : i;
  };

  const qLower = (q ?? "").toLowerCase();
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => {
    const p = r.pengembalian?.peserta;
    if (!p) return false;
    if (dept && p.departemen !== dept) return false;
    if (qLower && !(`${p.nama} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
    return true;
  });

  // Satu SECTION per departemen (urutan bisnis DEPARTEMEN), tiap section diurutkan
  // urutan (No) ascending - itu sudah per-departemen sejak migrasi 2026-07-15.
  const sections = DEPARTEMEN.map((dName) => ({
    dept: dName,
    rows: rows
      .filter((r) => (r.pengembalian?.peserta?.departemen ?? "") === dName)
      .sort((a, b) => (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity)),
  })).filter((s) => s.rows.length > 0);

  // baris tanpa departemen (seharusnya jarang/tidak ada) - tampilkan sebagai section terakhir
  const tanpaDivisi = rows
    .filter((r) => !r.pengembalian?.peserta?.departemen)
    .sort((a, b) => (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity));
  if (tanpaDivisi.length > 0) sections.push({ dept: "Tanpa Divisi", rows: tanpaDivisi });

  const grandTotal = rows.length;
  const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-5xl bg-white p-8 text-slate-900 print:p-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">DAFTAR PENGEMBALIAN ID CARD</h1>
          <p className="text-sm">PT. JO Koin One Plant — Dicetak: {dicetak}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <div className="mt-3 text-xs text-slate-500">
        {dept && <>Divisi: <b>{dept}</b> · </>}
        {q && <>Cari: &quot;{q}&quot; · </>}
        Total: <b>{grandTotal}</b> kartu
      </div>

      {sections.map((section, si) => (
        <section key={section.dept} className="mt-6" style={{ breakInside: "avoid" }}>
          <h2 className="bg-slate-800 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
            SECTION {si + 1}: {section.dept}
          </h2>
          <table className="w-full table-fixed border-collapse text-[11px]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-slate-300 bg-slate-50 text-left">
                <th className="px-1.5 py-2">No</th>
                <th className="px-1.5 py-2 whitespace-nowrap">Tanggal</th>
                <th className="px-1.5 py-2">Badge</th>
                <th className="px-1.5 py-2">Nama</th>
                <th className="px-1.5 py-2">PIN</th>
                <th className="px-1.5 py-2">Jabatan</th>
                <th className="px-1.5 py-2">Kondisi</th>
                <th className="px-1.5 py-2">Batch</th>
                <th className="px-1.5 py-2">Petugas</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((r, i) => {
                const p = r.pengembalian?.peserta;
                return (
                  <tr key={i} className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.urutan ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.tanggal ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_badge ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.nama ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_erp ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.jabatan_deskripsi ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.kondisi}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{batchLabel(r.pengembalian?.batch)}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{formatPetugas(r.pengembalian?.petugas)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-800 font-semibold">
                <td colSpan={8} className="px-1.5 py-1.5 text-right">SUBTOTAL {section.dept}</td>
                <td className="px-1.5 py-1.5 tabular-nums">{section.rows.length}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <table className="mt-4 w-full border-collapse text-xs" style={{ breakInside: "avoid" }}>
        <tbody>
          <tr className="border-t-4 border-double border-slate-800">
            <td className="py-2 pr-8 text-sm font-bold">GRAND TOTAL</td>
            <td className="py-2 text-right text-sm font-bold tabular-nums">{grandTotal}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 text-xs text-slate-600" style={{ breakInside: "avoid" }}>
        <p className="font-semibold">Catatan:</p>
        <ol className="ml-4 list-decimal space-y-0.5">
          <li>Batch 1 = data pengembalian yang sudah dikunci per 15 Juli 2026.</li>
          <li>Batch 2 = pengembalian mulai 18 Juli 2026, nomor urut lanjut otomatis per departemen (tidak mengulang dari 1).</li>
        </ol>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd d:\PT_KOIN\major_overhaul_2026 && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Manual visual check**

Start the dev server if not already running (`npm run dev` in `d:\PT_KOIN\major_overhaul_2026`, background), then open `http://localhost:3000/pengembalian/cetak/kembali` in a browser and confirm:
- Two sections render: "SECTION 1: TBN-BOP" then "SECTION 2: BOILER" (in that order — DEPARTEMEN order, not insertion order).
- TBN-BOP's `No` column runs 1→ 120, BOILER's runs 1 → 40 (both restart at 1).
- Each section ends with a "SUBTOTAL [dept]" row showing the right count.
- A "GRAND TOTAL" row appears once at the bottom with the total across both sections.
- The Catatan block appears below that.
- Print preview (Ctrl+P or the "Cetak / Simpan PDF" button) still fits on portrait A4 without the date/petugas columns wrapping oddly (same column-width discipline as before).

- [ ] **Step 4: Commit**

```bash
cd d:\PT_KOIN\major_overhaul_2026
git add app/\(app\)/pengembalian/cetak/kembali/page.tsx
git commit -m "$(cat <<'EOF'
Restructure print page into SECTION-per-departemen with SUBTOTAL/GRAND TOTAL

Matches the DEPOSIT_TEMPORARY_ID CARD_ACCONT.xlsx layout: one numbered
table per departemen (No restarts at 1 for each, backed by the now
per-departemen urutan column), a SUBTOTAL row per section, a GRAND TOTAL
row at the end, and a Catatan block explaining Batch 1/2. Batch is now a
column within each section's table instead of a separate group header.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Restructure the PDF export into the same SECTION-per-departemen format

**Files:**
- Modify: `components/ExportPdfButton.tsx`
- Modify: `app/(app)/pengembalian/page.tsx` (only the `exportKartuRows` mapping block and the `ExportPdfButton` usage — the rest of this file was already changed in Task 3)

**Interfaces:**
- Consumes: `ExportPdfRow` shape defined in Step 1 below.
- Produces: `ExportPdfButton` keeps the same component name/export and the same `{ title, subtitle, rows, filename }` props shape from the outside — only the internal PDF-building logic and the `ExportPdfRow` fields change, so no other file besides `page.tsx`'s row-mapping needs to change.

- [ ] **Step 1: Redefine `ExportPdfRow` with an explicit `departemen` + `batch` field instead of the generic `groupLabel`**

In `components/ExportPdfButton.tsx`, replace:

```tsx
export type ExportPdfRow = {
  no: number;
  badge: string;
  nama: string;
  pin: string;
  groupLabel: string;
  jabatan: string;
  kondisi: string;
  tanggal: string;
  petugas: string;
};
```

with:

```tsx
export type ExportPdfRow = {
  no: number;
  badge: string;
  nama: string;
  pin: string;
  departemen: string;
  batch: string;
  jabatan: string;
  kondisi: string;
  tanggal: string;
  petugas: string;
};
```

- [ ] **Step 2: Rebuild the PDF body as one table per departemen with a SUBTOTAL row, then a GRAND TOTAL line**

In `components/ExportPdfButton.tsx`, replace the whole `handleExport` function body:

```tsx
  async function handleExport() {
    setBusy(true);
    try {
      const [{ default: jsPDF }, autoTable] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 15);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, 14, 20);
      doc.text(`Dicetak: ${dicetak} · Total: ${rows.length}`, 14, 25);

      const body: (string | number)[][] = [];
      let lastGroup = "";
      for (const r of rows) {
        if (r.groupLabel !== lastGroup) {
          lastGroup = r.groupLabel;
          body.push([{ content: lastGroup || "-", colSpan: 8 } as unknown as string]);
        }
        body.push([r.no, r.badge, r.nama, r.pin, r.jabatan, r.kondisi, r.tanggal, r.petugas]);
      }

      autoTable.default(doc, {
        startY: 29,
        head: [["No", "Badge", "Nama", "PIN", "Jabatan", "Kondisi", "Tgl Kembali", "Petugas"]],
        body,
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [29, 78, 216], textColor: 255 },
        didParseCell: (data) => {
          const raw = data.row.raw as unknown[];
          if (data.row.section === "body" && Array.isArray(raw) && raw.length === 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [51, 65, 85];
          }
        },
      });

      doc.save(filename);
    } finally {
      setBusy(false);
    }
  }
```

with:

```tsx
  async function handleExport() {
    setBusy(true);
    try {
      const [{ default: jsPDF }, autoTable] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 15);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, 14, 20);
      doc.text(`Dicetak: ${dicetak} · Total: ${rows.length}`, 14, 25);

      // satu tabel autoTable per departemen (SECTION), diikuti baris SUBTOTAL,
      // lalu GRAND TOTAL setelah tabel terakhir - mengikuti urutan kemunculan
      // di `rows` (caller sudah mengurutkan sesuai DEPARTEMEN + urutan).
      const groups: { dept: string; rows: ExportPdfRow[] }[] = [];
      for (const r of rows) {
        const last = groups[groups.length - 1];
        if (last && last.dept === r.departemen) last.rows.push(r);
        else groups.push({ dept: r.departemen, rows: [r] });
      }

      let y = 29;
      let sectionNo = 0;
      for (const g of groups) {
        sectionNo += 1;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`SECTION ${sectionNo}: ${g.dept}`, 14, y);
        y += 2;

        autoTable.default(doc, {
          startY: y,
          head: [["No", "Tanggal", "Badge", "Nama", "PIN", "Jabatan", "Kondisi", "Batch", "Petugas"]],
          body: g.rows.map((r) => [r.no, r.tanggal, r.badge, r.nama, r.pin, r.jabatan, r.kondisi, r.batch, r.petugas]),
          foot: [[{ content: `SUBTOTAL ${g.dept}`, colSpan: 8, styles: { halign: "right", fontStyle: "bold" } }, { content: String(g.rows.length), styles: { fontStyle: "bold" } }]],
          styles: { fontSize: 7.5, cellPadding: 1.5 },
          headStyles: { fillColor: [29, 78, 216], textColor: 255 },
          footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85] },
        });

        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`GRAND TOTAL: ${rows.length}`, 14, y);
      y += 8;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Catatan:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text("1. Batch 1 = data pengembalian yang sudah dikunci per 15 Juli 2026.", 14, y + 4);
      doc.text("2. Batch 2 = pengembalian mulai 18 Juli 2026, nomor urut lanjut otomatis per departemen.", 14, y + 8);

      doc.save(filename);
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 3: Update `page.tsx`'s `exportKartuRows` mapping to the new field names and departemen+urutan-based ordering**

In `app/(app)/pengembalian/page.tsx`, replace:

```ts
  const exportKartuRows: ExportPdfRow[] = filteredKartuRows.map((r) => {
    const p = r.pengembalian?.peserta;
    return {
      no: r.pengembalian?.urutan ?? 0,
      badge: p?.no_badge ?? "-",
      nama: p?.nama ?? "-",
      pin: p?.no_erp ?? "-",
      groupLabel: batchLabel(r.pengembalian?.batch),
      jabatan: p?.jabatan_deskripsi ?? "-",
      kondisi: r.kondisi,
      tanggal: r.pengembalian?.tanggal ?? "-",
      petugas: formatPetugas(r.pengembalian?.petugas),
    };
  });
```

with:

```ts
  // Export PDF harus dalam urutan Departemen -> urutan (sama seperti halaman cetak), bukan
  // urutan kartuRows biasa - filteredKartuRows sudah diurutkan begitu sejak Task 3, jadi tinggal
  // dipetakan langsung. Label batch di PDF singkat ("Batch 1"/"Batch 2") karena cuma kolom
  // tabel, bukan header grup seperti di layar - penjelasan lengkapnya ada di Catatan PDF.
  const exportKartuRows: ExportPdfRow[] = filteredKartuRows.map((r) => {
    const p = r.pengembalian?.peserta;
    const b = r.pengembalian?.batch;
    return {
      no: r.pengembalian?.urutan ?? 0,
      badge: p?.no_badge ?? "-",
      nama: p?.nama ?? "-",
      pin: p?.no_erp ?? "-",
      departemen: p?.departemen ?? "Tanpa Divisi",
      batch: b === 1 ? "Batch 1" : b === 2 ? "Batch 2" : `Batch ${b ?? "-"}`,
      jabatan: p?.jabatan_deskripsi ?? "-",
      kondisi: r.kondisi,
      tanggal: r.pengembalian?.tanggal ?? "-",
      petugas: formatPetugas(r.pengembalian?.petugas),
    };
  });
```

(No change needed to the `<ExportPdfButton ... rows={exportKartuRows} .../>` JSX usage itself — same prop name.)

- [ ] **Step 4: Typecheck**

Run: `cd d:\PT_KOIN\major_overhaul_2026 && npx tsc --noEmit`
Expected: no output. Pay attention to `jspdf-autotable`'s `lastAutoTable` typing — if TS complains about the cast, confirm the cast in Step 2 (`doc as unknown as { lastAutoTable: { finalY: number } }`) is present exactly as written; `jspdf-autotable` augments `jsPDF` at runtime but not always in its shipped types, hence the cast.

- [ ] **Step 5: Manual test**

In the running dev server, go to `/pengembalian`, click "Export PDF" on the "Daftar ID Card Dikembalikan" card, open the downloaded PDF, and confirm: SECTION 1 (TBN-BOP) table with a SUBTOTAL row, SECTION 2 (BOILER) table with its own SUBTOTAL row, and a "GRAND TOTAL: N" line after the last table.

- [ ] **Step 6: Commit**

```bash
cd d:\PT_KOIN\major_overhaul_2026
git add components/ExportPdfButton.tsx app/\(app\)/pengembalian/page.tsx
git commit -m "$(cat <<'EOF'
PDF export: SECTION-per-departemen tables with SUBTOTAL + GRAND TOTAL

Mirrors the print page's new layout. ExportPdfRow gained explicit
departemen/batch fields (replacing the generic groupLabel) so the PDF
builder can emit one autoTable per departemen with its own foot-row
SUBTOTAL, then a GRAND TOTAL line after the last section.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Push everything

- [ ] **Step 1: Final full typecheck**

Run: `cd d:\PT_KOIN\major_overhaul_2026 && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 2: Confirm all commits are present and push**

```bash
cd d:\PT_KOIN\major_overhaul_2026
git log --oneline -6
git push
```

Expected: the 5 commits from Tasks 2–5 (Task 1 has no repo commit) appear in the log, then `git push` succeeds and Vercel picks up the deploy.

- [ ] **Step 3: Report back to the user**

Summarize: what got renumbered (exact per-departemen counts from Task 1 Step 3), where the Batch column now lives on-screen, and that the print/PDF now follow the SECTION/SUBTOTAL/GRAND TOTAL format from their reference file.

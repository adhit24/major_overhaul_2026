# CPS Deposit Refund Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Standing Dana Deposit di CPS" section to `/deposit` that lets the HSE admin log staged deposit refunds received from Cirebon Power Services (CPS) and see, per department and overall, how much deposit money is still outstanding.

**Architecture:** One new table (`cps_deposit_refund`) holds a manually-entered ledger of refund transactions. The existing `/deposit` server component reads this table alongside the already-queried `deposit_batch` and `pengembalian_detail` data, computes per-department and total standing-balance figures in plain JS (no stored/generated columns), and renders them with the same dual-render (mobile card / desktop table) pattern already used everywhere else on this page. A new server action pair (`createCpsRefund`, `hapusCpsRefund`) and a small delete-button client component round it out.

**Tech Stack:** Next.js 15 App Router server components/actions, Supabase Postgres + supabase-js, Tailwind CSS. No test framework exists in this project (no jest/vitest, no `*.test.*` files) — verification is via `npx tsc --noEmit`, direct Supabase REST checks, and a Playwright-driven browser check against the running dev server, matching how prior features in this codebase were verified.

## Global Constraints

- Department values are exactly: `ONE PLANT`, `INDIRECT`, `TBN-BOP`, `BOILER`, `SUPPORTING` (the `DEPARTEMEN` constant in `lib/constants.ts`).
- Card deposit tariff is Rp 50.000/card, but CPS refund amounts are entered manually as whatever CPS actually paid — never computed as `jumlah_kartu * 50000`.
- Never hardcode the Supabase service-role key in any script; read `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` at runtime (established project convention).
- Admin-destructive actions (delete) are PIN-gated with the existing hardcoded admin PIN `242424`, matching `components/HapusPengembalianButton.tsx`.
- All new UI must follow the mobile-first dual-render pattern already used throughout this app: a `sm:hidden` card list plus a `hidden sm:block` table, both driven by the same data array.

---

### Task 1: Database migration — `cps_deposit_refund` table

**Files:**
- Create: `supabase/cps_refund.sql`

**Interfaces:**
- Produces: Postgres table `cps_deposit_refund` with columns `id bigint`, `tanggal date`, `departemen text`, `jumlah_kartu integer`, `jumlah_uang numeric`, `no_referensi text`, `petugas text`, `keterangan text`, `created_at timestamptz`. Later tasks (2 and 4) read/write this table by these exact column names.

- [ ] **Step 1: Write the migration file**

```sql
-- PT KOIN - Ledger Pengembalian Dana Deposit dari CPS
-- Jalankan di Supabase Dashboard > SQL Editor (sekali saja).
-- Spec: docs/superpowers/specs/2026-07-17-cps-deposit-refund-ledger-design.md

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

create index if not exists cps_deposit_refund_departemen_idx on cps_deposit_refund (departemen);

alter table cps_deposit_refund enable row level security;

create policy "admin penuh akses cps_deposit_refund" on cps_deposit_refund
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration**

Run the SQL above via the `mcp__claude_ai_Supabase__execute_sql` tool against the `major_overhaul_2026` project (same tool used for earlier migrations in this project's history). If that tool is unavailable, paste the SQL into the Supabase Dashboard SQL Editor and run it once.

- [ ] **Step 3: Verify the table exists and constraints work**

Write a throwaway script `_verify_cps_table.py` in the project root (delete it after this step):

```python
import requests
from pathlib import Path

env = {}
for line in Path(".env.local").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

url = env["NEXT_PUBLIC_SUPABASE_URL"]
key = env["SUPABASE_SERVICE_ROLE_KEY"]
h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}

# valid insert
r = requests.post(f"{url}/rest/v1/cps_deposit_refund", headers=h, json={
    "tanggal": "2026-07-14", "departemen": "BOILER", "jumlah_kartu": 5, "jumlah_uang": 250000,
})
print("insert status:", r.status_code, r.json())
assert r.status_code == 201, "expected successful insert"
row_id = r.json()[0]["id"]

# invalid departemen should be rejected by the check constraint
r2 = requests.post(f"{url}/rest/v1/cps_deposit_refund", headers=h, json={
    "tanggal": "2026-07-14", "departemen": "NOT_A_DEPT", "jumlah_kartu": 1, "jumlah_uang": 1,
})
print("invalid insert status (expect 400/23514):", r2.status_code)
assert r2.status_code >= 400, "expected the check constraint to reject an invalid departemen"

# cleanup
r3 = requests.delete(f"{url}/rest/v1/cps_deposit_refund", headers=h, params={"id": f"eq.{row_id}"})
print("cleanup status:", r3.status_code)
```

Run: `python _verify_cps_table.py`
Expected output: `insert status: 201 [...]`, `invalid insert status (expect 400/23514): 400`, `cleanup status: 204`.

Then delete `_verify_cps_table.py` — it was only for this verification step, not part of the app.

- [ ] **Step 4: Commit**

```bash
git add supabase/cps_refund.sql
git commit -m "Add cps_deposit_refund table for tracking CPS deposit refund ledger"
```

---

### Task 2: Server actions — create and delete CPS refund entries

**Files:**
- Modify: `app/(app)/deposit/actions.ts`

**Interfaces:**
- Consumes: table `cps_deposit_refund` from Task 1 (columns `tanggal`, `departemen`, `jumlah_kartu`, `jumlah_uang`, `no_referensi`, `petugas`, `keterangan`).
- Produces: `createCpsRefund(formData: FormData): Promise<void>` (redirects on success/error, same pattern as `createDepositBatch`) and `hapusCpsRefund(formData: FormData): Promise<{ error: string | null }>` (returns a result object, same pattern as `hapusPengembalian` in `app/(app)/pengembalian/actions.ts`). Task 3's component calls `hapusCpsRefund`; Task 4's form calls `createCpsRefund` as its `action`.

- [ ] **Step 1: Add the `DEPARTEMEN` import**

In `app/(app)/deposit/actions.ts`, change line 6 from:

```ts
import { DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
```

to:

```ts
import { DEPARTEMEN, DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
```

- [ ] **Step 2: Append `createCpsRefund` and `hapusCpsRefund` to the end of the file**

Add after the existing `createDepositBatch` function (after line 50):

```ts
export async function createCpsRefund(formData: FormData) {
  const tanggal = String(formData.get("tanggal") ?? "");
  const departemen = String(formData.get("departemen") ?? "");
  const jumlahKartu = Number(formData.get("jumlah_kartu") ?? 0);
  const jumlahUang = Number(formData.get("jumlah_uang") ?? 0);
  const noReferensi = String(formData.get("no_referensi") ?? "").trim() || null;
  const petugas = String(formData.get("petugas") ?? "").trim() || null;
  const keterangan = String(formData.get("keterangan") ?? "").trim() || null;

  const errors: string[] = [];
  if (!tanggal) errors.push("Tanggal wajib diisi.");
  if (!DEPARTEMEN.includes(departemen as (typeof DEPARTEMEN)[number])) errors.push("Departemen wajib dipilih.");
  if (!jumlahKartu || jumlahKartu <= 0) errors.push("Jumlah kartu wajib diisi dan lebih dari 0.");
  if (!formData.get("jumlah_uang") || jumlahUang < 0 || Number.isNaN(jumlahUang)) errors.push("Jumlah uang wajib diisi.");

  if (errors.length) {
    redirect(`/deposit?error=${encodeURIComponent(errors.join(" "))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cps_deposit_refund").insert({
    tanggal,
    departemen,
    jumlah_kartu: jumlahKartu,
    jumlah_uang: jumlahUang,
    no_referensi: noReferensi,
    petugas,
    keterangan,
  });

  if (error) {
    redirect(`/deposit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/deposit");
  redirect("/deposit?saved=1");
}

export async function hapusCpsRefund(formData: FormData): Promise<{ error: string | null }> {
  const id = Number(formData.get("id") ?? 0);
  if (!id) return { error: "ID tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.from("cps_deposit_refund").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/deposit");
  return { error: null };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/deposit/actions.ts"
git commit -m "Add createCpsRefund and hapusCpsRefund server actions"
```

---

### Task 3: `HapusCpsRefundButton` component

**Files:**
- Create: `components/HapusCpsRefundButton.tsx`

**Interfaces:**
- Consumes: `hapusCpsRefund` from `@/app/(app)/deposit/actions` (Task 2).
- Produces: `HapusCpsRefundButton({ id }: { id: number })` — a client component. Task 4's ledger table/card list renders `<HapusCpsRefundButton id={r.id} />` per row.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hapusCpsRefund } from "@/app/(app)/deposit/actions";

const ADMIN_PIN = "242424";

export function HapusCpsRefundButton({ id }: { id: number }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    if (pin !== ADMIN_PIN) { setErr("PIN salah."); return; }
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await hapusCpsRefund(fd);
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/HapusCpsRefundButton.tsx
git commit -m "Add HapusCpsRefundButton component"
```

---

### Task 4: `/deposit` page — queries, calculations, and the new section

**Files:**
- Modify: `app/(app)/deposit/page.tsx`

**Interfaces:**
- Consumes: `cps_deposit_refund` table (Task 1), `createCpsRefund` (Task 2), `HapusCpsRefundButton` (Task 3), plus existing in-scope values `batches`, `totalDeposit`, `totalKembali`, `deptOrder`, `kembaliBreakdown`, `formatRupiah`, `DEPARTEMEN`.
- Produces: the rendered "Standing Dana Deposit di CPS" section — no other file depends on this task's output.

- [ ] **Step 1: Add imports**

Change line 5-7 from:

```ts
import { DEPARTEMEN, DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
import { createDepositBatch } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
```

to:

```ts
import { DEPARTEMEN, DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
import { createDepositBatch, createCpsRefund } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { HapusCpsRefundButton } from "@/components/HapusCpsRefundButton";
```

- [ ] **Step 2: Add the query and calculations**

Immediately after the existing block that computes `totalKembaliBatch1`/`totalKembaliBatch2`/`totalKembali` (currently ending at line 66, right before the `return (` on line 68), insert:

```ts
  // Standing Dana Deposit di CPS - ledger transaksi pengembalian dana dari CPS,
  // dibandingkan terhadap total deposit (per departemen & total) dan terhadap
  // jumlah kartu yang benar-benar sudah dikembalikan pekerja (kembaliBreakdown di atas).
  const { data: cpsRefunds } = await supabase
    .from("cps_deposit_refund")
    .select("*")
    .order("tanggal", { ascending: false });

  const depositByDept = new Map<string, number>();
  for (const b of batches ?? []) {
    const dept = b.departemen_section ?? "Tanpa Divisi";
    depositByDept.set(dept, (depositByDept.get(dept) ?? 0) + Number(b.total_deposit ?? 0));
  }

  const cpsByDept = new Map<string, { uang: number; kartu: number }>();
  for (const r of cpsRefunds ?? []) {
    const row = cpsByDept.get(r.departemen) ?? { uang: 0, kartu: 0 };
    row.uang += Number(r.jumlah_uang);
    row.kartu += Number(r.jumlah_kartu);
    cpsByDept.set(r.departemen, row);
  }

  const kartuKembaliByDept = new Map<string, number>();
  for (const r of kembaliBreakdown) {
    kartuKembaliByDept.set(r.dept, r.batch1 + r.batch2);
  }

  const cpsBreakdown = deptOrder
    .map((d) => {
      const dep = depositByDept.get(d) ?? 0;
      const cps = cpsByDept.get(d) ?? { uang: 0, kartu: 0 };
      const kartuKembali = kartuKembaliByDept.get(d) ?? 0;
      return {
        dept: d,
        totalDeposit: dep,
        dikembalikanCps: cps.uang,
        standingBalance: dep - cps.uang,
        kartuKembali,
        kartuDicairkan: cps.kartu,
        selisihKartu: kartuKembali - cps.kartu,
      };
    })
    .filter((r) => r.totalDeposit > 0 || r.dikembalikanCps > 0 || r.kartuKembali > 0);

  const totalDikembalikanCps = (cpsRefunds ?? []).reduce((s, r) => s + Number(r.jumlah_uang), 0);
  const totalKartuDicairkanCps = (cpsRefunds ?? []).reduce((s, r) => s + Number(r.jumlah_kartu), 0);
  const standingBalanceTotal = totalDeposit - totalDikembalikanCps;
  const selisihKartuTotal = totalKembali - totalKartuDicairkanCps;
```

- [ ] **Step 3: Add the new section to the JSX**

Insert the following immediately after the `</div>` on line 371 (which closes the "Summary Pengembalian ID Card" card) and before the `</main>` on line 373:

```tsx
        {/* ── Standing Dana Deposit di CPS ── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Standing Dana Deposit di CPS</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pelacakan dana deposit yang masih di-hold oleh Cirebon Power Services</p>
          </div>

          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Deposit</p>
              <p className="mt-2 text-lg font-bold text-slate-800 sm:text-2xl">{formatRupiah(totalDeposit)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sudah Dikembalikan CPS</p>
              <p className="mt-2 text-lg font-bold text-emerald-600 sm:text-2xl">{formatRupiah(totalDikembalikanCps)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Standing Balance</p>
              <p className={`mt-2 text-lg font-bold sm:text-2xl ${standingBalanceTotal > 0 ? "text-amber-600" : "text-slate-800"}`}>{formatRupiah(standingBalanceTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selisih Kartu</p>
              <p className={`mt-2 text-lg font-bold sm:text-2xl ${selisihKartuTotal < 0 ? "text-red-600" : "text-slate-800"}`}>{selisihKartuTotal}</p>
              <p className="mt-1 text-xs text-slate-400">kembali − dicairkan CPS</p>
            </div>
          </div>

          {cpsBreakdown.length > 0 && (
            <>
              {/* Mobile: kartu (< sm) */}
              <div className="flex flex-col gap-2.5 border-t border-slate-100 p-3.5 sm:hidden">
                {cpsBreakdown.map((r) => (
                  <div key={r.dept} className="data-card">
                    <p className="font-semibold text-slate-800">{r.dept}</p>
                    <div className="my-2.5 border-t border-slate-100" />
                    <div className="data-card-row">
                      <span className="data-card-label">Total Deposit</span>
                      <span className="data-card-value">{formatRupiah(r.totalDeposit)}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Dikembalikan CPS</span>
                      <span className="data-card-value text-emerald-700">{formatRupiah(r.dikembalikanCps)}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Standing Balance</span>
                      <span className="data-card-value font-semibold">{formatRupiah(r.standingBalance)}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Kartu Kembali</span>
                      <span className="data-card-value">{r.kartuKembali}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Kartu Dicairkan CPS</span>
                      <span className="data-card-value">{r.kartuDicairkan}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Selisih Kartu</span>
                      <span className={`data-card-value font-semibold ${r.selisihKartu < 0 ? "text-red-600" : ""}`}>{r.selisihKartu}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabel (>= sm) */}
              <div className="hidden overflow-x-auto border-t border-slate-100 sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 text-left font-semibold">Departemen</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Deposit</th>
                      <th className="px-4 py-3 text-right font-semibold">Dikembalikan CPS</th>
                      <th className="px-4 py-3 text-right font-semibold">Standing Balance</th>
                      <th className="px-4 py-3 text-right font-semibold">Kartu Kembali</th>
                      <th className="px-4 py-3 text-right font-semibold">Kartu Dicairkan CPS</th>
                      <th className="px-4 py-3 text-right font-semibold">Selisih Kartu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cpsBreakdown.map((r) => (
                      <tr key={r.dept}>
                        <td className="px-5 py-2.5 text-slate-700">{r.dept}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{formatRupiah(r.totalDeposit)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatRupiah(r.dikembalikanCps)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800">{formatRupiah(r.standingBalance)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{r.kartuKembali}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{r.kartuDicairkan}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.selisihKartu < 0 ? "text-red-600" : "text-slate-800"}`}>{r.selisihKartu}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold text-slate-700">
                      <td className="px-5 py-3">Total Keseluruhan</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(totalDeposit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(totalDikembalikanCps)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatRupiah(standingBalanceTotal)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totalKembali}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{totalKartuDicairkanCps}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${selisihKartuTotal < 0 ? "text-red-600" : ""}`}>{selisihKartuTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {/* Form catat pengembalian dana CPS */}
          <div className="border-t border-slate-100 p-5">
            <p className="mb-4 text-sm font-semibold text-slate-700">Catat Pengembalian Dana CPS</p>
            <form action={createCpsRefund} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <div className="sm:col-span-1">
                <label className="label-field">Tanggal *</label>
                <input name="tanggal" type="date" required className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Departemen *</label>
                <select name="departemen" required defaultValue="" className="input-field">
                  <option value="" disabled>Pilih</option>
                  {DEPARTEMEN.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="label-field">Jumlah Kartu *</label>
                <input name="jumlah_kartu" type="number" min={1} required className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Jumlah Uang (Rp) *</label>
                <input name="jumlah_uang" type="number" min={0} step={1000} required className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">No. Referensi</label>
                <input name="no_referensi" className="input-field" placeholder="mis. CPS-TID-07/26/010" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Petugas</label>
                <input name="petugas" className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Keterangan</label>
                <input name="keterangan" className="input-field" />
              </div>
              <div className="sm:col-span-6 flex justify-end">
                <SubmitButton className="btn-primary" pendingText="Menyimpan...">Simpan</SubmitButton>
              </div>
            </form>
          </div>

          {/* Riwayat transaksi */}
          <div className="border-t border-slate-100">
            <div className="px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Riwayat Transaksi</h3>
              <p className="text-xs text-slate-400 mt-0.5">{cpsRefunds?.length ?? 0} transaksi tercatat</p>
            </div>
            {!cpsRefunds?.length ? (
              <p className="px-5 pb-10 text-center text-slate-400 text-sm">Belum ada transaksi pengembalian dana dari CPS.</p>
            ) : (
              <>
                {/* Mobile: kartu (< sm) */}
                <div className="flex flex-col gap-2.5 p-3.5 sm:hidden">
                  {cpsRefunds.map((r) => (
                    <div key={r.id} className="data-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{r.departemen}</span>
                          <p className="mt-1 text-xs text-slate-400">{r.tanggal}</p>
                        </div>
                        <HapusCpsRefundButton id={r.id} />
                      </div>
                      <div className="my-2.5 border-t border-slate-100" />
                      <div className="data-card-row">
                        <span className="data-card-label">Jumlah Kartu</span>
                        <span className="data-card-value">{r.jumlah_kartu}</span>
                      </div>
                      <div className="data-card-row">
                        <span className="data-card-label">Jumlah Uang</span>
                        <span className="data-card-value font-semibold text-emerald-700">{formatRupiah(Number(r.jumlah_uang))}</span>
                      </div>
                      {r.no_referensi && (
                        <div className="data-card-row">
                          <span className="data-card-label">No. Referensi</span>
                          <span className="data-card-value font-mono text-xs">{r.no_referensi}</span>
                        </div>
                      )}
                      {r.petugas && (
                        <div className="data-card-row">
                          <span className="data-card-label">Petugas</span>
                          <span className="data-card-value">{r.petugas}</span>
                        </div>
                      )}
                      {r.keterangan && <p className="mt-2 text-sm text-slate-600">{r.keterangan}</p>}
                    </div>
                  ))}
                </div>

                {/* Desktop/tablet: tabel (>= sm) */}
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3 text-left font-semibold">Tanggal</th>
                        <th className="px-4 py-3 text-left font-semibold">Departemen</th>
                        <th className="px-4 py-3 text-right font-semibold">Jml Kartu</th>
                        <th className="px-4 py-3 text-right font-semibold">Jumlah Uang</th>
                        <th className="px-4 py-3 text-left font-semibold">No. Referensi</th>
                        <th className="px-4 py-3 text-left font-semibold">Petugas</th>
                        <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cpsRefunds.map((r) => (
                        <tr key={r.id}>
                          <td className="px-5 py-2.5 text-slate-600 whitespace-nowrap">{r.tanggal}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{r.departemen}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{r.jumlah_kartu}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap">{formatRupiah(Number(r.jumlah_uang))}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{r.no_referensi ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-500">{r.petugas ?? <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-[200px]"><span className="line-clamp-1">{r.keterangan ?? <span className="text-slate-300">—</span>}</span></td>
                          <td className="px-4 py-2.5 text-right"><HapusCpsRefundButton id={r.id} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (no errors).

- [ ] **Step 5: Start the dev server**

Run (background): `npm run dev`
Expected: `✓ Ready in <N>s` with no compile errors.

- [ ] **Step 6: End-to-end verification via Playwright**

Write a throwaway script `_verify_cps_section.js` in the project root (delete it after this step). It logs in, submits the new form, confirms the row appears, deletes it via the PIN-gated button, and confirms it's gone:

```js
const { chromium } = require('playwright');

const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.goto('http://localhost:3000/deposit', { waitUntil: 'networkidle' });

  // Fill and submit the "Catat Pengembalian Dana CPS" form
  const form = page.locator('form', { has: page.locator('select[name=departemen]') }).last();
  await form.locator('input[name=tanggal]').fill('2026-07-14');
  await form.locator('select[name=departemen]').selectOption('BOILER');
  await form.locator('input[name=jumlah_kartu]').fill('60');
  await form.locator('input[name=jumlah_uang]').fill('8000000');
  await form.locator('input[name=no_referensi]').fill('QA-TEST-001');
  await form.locator('button[type=submit]').click();
  await page.waitForURL('**/deposit?saved=1', { timeout: 15000 });

  const bodyText = await page.textContent('body');
  console.log('Row visible after insert:', bodyText.includes('QA-TEST-001'));

  // Delete it via the PIN-gated button
  await page.getByText('Hapus', { exact: true }).first().click();
  await page.locator('input[type=password]').first().fill('242424');
  await page.getByText('OK', { exact: true }).first().click();
  await page.waitForTimeout(1000);

  const bodyText2 = await page.textContent('body');
  console.log('Row gone after delete:', !bodyText2.includes('QA-TEST-001'));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
```

Run: `QA_EMAIL="<real login email>" QA_PASSWORD="<real login password>" node _verify_cps_section.js`
Expected output: `Row visible after insert: true` then `Row gone after delete: true`.

Then delete `_verify_cps_section.js`.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/deposit/page.tsx"
git commit -m "Add Standing Dana Deposit di CPS section to /deposit page"
```

---

## Self-Review Notes

- **Spec coverage:** table schema (Task 1) ✓, create/delete actions (Task 2) ✓, PIN-gated delete button (Task 3) ✓, 4 summary cards + per-department breakdown table + form + ledger history, all dual-render mobile/desktop (Task 4) ✓. No spec section left uncovered.
- **Type consistency:** `createCpsRefund` and `hapusCpsRefund` names match between Task 2 (definition), Task 3 (`hapusCpsRefund` import), and Task 4 (`createCpsRefund` import + form `action`). `HapusCpsRefundButton({ id }: { id: number })` signature in Task 3 matches its two call sites `<HapusCpsRefundButton id={r.id} />` in Task 4.
- **No placeholders:** every step has complete, runnable code — no TBDs.

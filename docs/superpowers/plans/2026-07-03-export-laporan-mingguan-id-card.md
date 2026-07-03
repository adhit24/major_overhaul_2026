# Export Laporan Mingguan ID Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Export Laporan Mingguan" feature to `/manpower` that generates a PDF (with company logos, for HRD) and an Excel file (raw data, for internal use) summarizing ID card return status — per the SOP in `docs/superpowers/specs/2026-07-03-id-card-return-process-design.md`.

**Architecture:** A pure data-bucketing function queries the `peserta` table and categorizes rows by `status_badge` + `remarks` tag convention (no schema change). Two generator functions (PDF via jsPDF, Excel via exceljs) turn that data into downloadable buffers. A Next.js Route Handler (`app/api/manpower/report`) wires auth + data + generators together and streams the file. Two link-buttons on `/manpower` trigger the downloads.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict), Supabase (`@supabase/ssr` server client), jsPDF + jspdf-autotable, exceljs.

## Global Constraints

- No changes to the `peserta` table schema — reuse `status_badge` and `remarks` exactly as they exist today (from spec, section "Di Luar Cakupan").
- Remarks tag convention is exact string matching, case-sensitive: `[CEK ULANG]` and `[TIDAK KEMBALI` (from spec section 3 and 4). Any future manual entry into `remarks` must use these exact brackets for the report to pick it up.
- Report categories (from spec section 7 table):
  - Returned (clean): `status_badge = RETURNED` AND `remarks` does NOT contain `[CEK ULANG]`
  - Exception List: `status_badge = RETURNED` AND `remarks` contains `[CEK ULANG]`
  - Tidak Kembali: `status_badge = PENDING` AND `remarks` contains `[TIDAK KEMBALI`
  - Masih Aktif: `status_badge = ACTIVE`
- PDF header uses two logos, copied verbatim from `d:\PT_KOIN\PT_KOIN_ASSET\logo_CPS_Transparant.png` and `d:\PT_KOIN\PT_KOIN_ASSET\logo_koin_oneplant_transparant.png` (per explicit user instruction).
- Supabase REST caps 1000 rows/request — always query with two parallel `.range(0,999)` + `.range(1000,1999)` batches and merge, matching the existing pattern in `app/(app)/manpower/page.tsx:56-60`.
- `DEPARTEMEN` order for any per-department table comes from `lib/constants.ts:1` (`["ONE PLANT", "INDIRECT", "TBN-BOP", "BOILER", "SUPPORTING"]`).
- This repo has no test runner configured (no jest/vitest, no eslint config; confirmed by inspecting `package.json` and repo root). Per-task verification therefore uses `npx tsc --noEmit` (strict type-check, already enabled in `tsconfig.json`) for pure-logic tasks, and manual dev-server + curl/browser checks for integration tasks — not automated unit tests.
- Follow existing code style: 2-space indentation, no semicolri— (existing files DO use semicolons, follow that), Tailwind utility classes reusing `.btn-secondary` / `.card` from `app/globals.css:18-29`.

---

### Task 1: Add PDF/Excel dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `jspdf`, `jspdf-autotable`, `exceljs` packages available to import from any file in the project.

- [ ] **Step 1: Install the dependencies**

Run:
```bash
cd d:/PT_KOIN/major_overhaul_2026
npm install jspdf@^4.2.1 jspdf-autotable@^5.0.8 exceljs@^4.4.0
```

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('jspdf/package.json').version, require('jspdf-autotable/package.json').version, require('exceljs/package.json').version)"`
Expected output: three version strings printed, e.g. `4.2.1 5.0.8 4.4.0` (exact patch versions may differ slightly — any 4.x/5.x/4.x is fine).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf, jspdf-autotable, exceljs for weekly report export"
```

---

### Task 2: Copy transparent logo assets

**Files:**
- Create: `public/logos/logo_cps_transparent.png`
- Create: `public/logos/logo_koin_transparent.png`

**Interfaces:**
- Produces: two PNG files on disk, readable at runtime via `path.join(process.cwd(), "public", "logos", "<filename>")`.

- [ ] **Step 1: Copy the files**

Run:
```bash
cp "d:/PT_KOIN/PT_KOIN_ASSET/logo_CPS_Transparant.png" "d:/PT_KOIN/major_overhaul_2026/public/logos/logo_cps_transparent.png"
cp "d:/PT_KOIN/PT_KOIN_ASSET/logo_koin_oneplant_transparant.png" "d:/PT_KOIN/major_overhaul_2026/public/logos/logo_koin_transparent.png"
```

- [ ] **Step 2: Verify byte sizes match source**

Run: `ls -la "d:/PT_KOIN/major_overhaul_2026/public/logos/"`
Expected: `logo_cps_transparent.png` is 48580 bytes, `logo_koin_transparent.png` is 19117 bytes (matching the source files in `PT_KOIN_ASSET`).

- [ ] **Step 3: Commit**

```bash
git add public/logos/logo_cps_transparent.png public/logos/logo_koin_transparent.png
git commit -m "chore: add transparent CPS and KOIN logos for weekly report PDF"
```

---

### Task 3: Report data query + categorization

**Files:**
- Create: `lib/report/buildReportData.ts`

**Interfaces:**
- Consumes: `DEPARTEMEN` from `lib/constants.ts` (`readonly ["ONE PLANT", "INDIRECT", "TBN-BOP", "BOILER", "SUPPORTING"]`); a `SupabaseClient` instance (same type returned by `lib/supabase/server.ts`'s `createClient()`).
- Produces (consumed by Tasks 4, 5, 6):
  - `type PesertaRow = { id: number; no_badge: string | null; nama: string; departemen: string | null; status_badge: string | null; remarks: string | null; leader: string | null }`
  - `type DeptSummaryRow = { dept: string; active: number; pending: number; returned: number; total: number }`
  - `type ReportData = { generatedAt: Date; deptSummary: DeptSummaryRow[]; totalActive: number; totalPending: number; totalReturned: number; returnedClean: PesertaRow[]; exceptionList: PesertaRow[]; tidakKembali: PesertaRow[] }`
  - `async function buildReportData(supabase: SupabaseClient): Promise<ReportData>`

- [ ] **Step 1: Write the file**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEPARTEMEN } from "@/lib/constants";

export type PesertaRow = {
  id: number;
  no_badge: string | null;
  nama: string;
  departemen: string | null;
  status_badge: string | null;
  remarks: string | null;
  leader: string | null;
};

export type DeptSummaryRow = {
  dept: string;
  active: number;
  pending: number;
  returned: number;
  total: number;
};

export type ReportData = {
  generatedAt: Date;
  deptSummary: DeptSummaryRow[];
  totalActive: number;
  totalPending: number;
  totalReturned: number;
  returnedClean: PesertaRow[];
  exceptionList: PesertaRow[];
  tidakKembali: PesertaRow[];
};

export async function buildReportData(
  supabase: SupabaseClient
): Promise<ReportData> {
  const cols = "id, no_badge, nama, departemen, status_badge, remarks, leader";
  const [batch1, batch2] = await Promise.all([
    supabase.from("peserta").select(cols).range(0, 999),
    supabase.from("peserta").select(cols).range(1000, 1999),
  ]);
  const allPeserta = [
    ...((batch1.data ?? []) as PesertaRow[]),
    ...((batch2.data ?? []) as PesertaRow[]),
  ];

  const deptSummary: DeptSummaryRow[] = DEPARTEMEN.map((d) => {
    const list = allPeserta.filter((p) => p.departemen === d);
    return {
      dept: d,
      active: list.filter((p) => p.status_badge === "ACTIVE").length,
      pending: list.filter((p) => p.status_badge === "PENDING").length,
      returned: list.filter((p) => p.status_badge === "RETURNED").length,
      total: list.length,
    };
  });

  const returnedClean = allPeserta.filter(
    (p) => p.status_badge === "RETURNED" && !(p.remarks ?? "").includes("[CEK ULANG]")
  );
  const exceptionList = allPeserta.filter(
    (p) => p.status_badge === "RETURNED" && (p.remarks ?? "").includes("[CEK ULANG]")
  );
  const tidakKembali = allPeserta.filter(
    (p) => p.status_badge === "PENDING" && (p.remarks ?? "").includes("[TIDAK KEMBALI")
  );

  return {
    generatedAt: new Date(),
    deptSummary,
    totalActive: deptSummary.reduce((s, d) => s + d.active, 0),
    totalPending: deptSummary.reduce((s, d) => s + d.pending, 0),
    totalReturned: deptSummary.reduce((s, d) => s + d.returned, 0),
    returnedClean,
    exceptionList,
    tidakKembali,
  };
}
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `cd d:/PT_KOIN/major_overhaul_2026 && npx tsc --noEmit`
Expected: no errors referencing `lib/report/buildReportData.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/report/buildReportData.ts
git commit -m "feat(report): add weekly report data query and categorization"
```

---

### Task 4: PDF generator

**Files:**
- Create: `lib/report/generatePdfReport.ts`

**Interfaces:**
- Consumes: `ReportData`, `PesertaRow`, `DeptSummaryRow` from `lib/report/buildReportData.ts` (Task 3); logo files at `public/logos/logo_cps_transparent.png` and `public/logos/logo_koin_transparent.png` (Task 2).
- Produces (consumed by Task 6): `function generatePdfReport(data: ReportData): Buffer` from `lib/report/generatePdfReport.ts`.

- [ ] **Step 1: Write the file**

```typescript
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import type { ReportData } from "./buildReportData";

function readLogoBase64(filename: string): string {
  const filePath = path.join(process.cwd(), "public", "logos", filename);
  const buffer = fs.readFileSync(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function formatTanggal(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type DocWithAutoTable = InstanceType<typeof jsPDF> & {
  lastAutoTable: { finalY: number };
};

export function generatePdfReport(data: ReportData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const cpsLogo = readLogoBase64("logo_cps_transparent.png");
  const koinLogo = readLogoBase64("logo_koin_transparent.png");

  doc.addImage(cpsLogo, "PNG", 14, 10, 22, 22);
  doc.addImage(koinLogo, "PNG", pageWidth - 36, 10, 22, 22);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LAPORAN MINGGUAN PENGEMBALIAN ID CARD", pageWidth / 2, 18, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("PT KOIN Pratama x Cirebon Power Service", pageWidth / 2, 24, { align: "center" });
  doc.text(`Tanggal Cetak: ${formatTanggal(data.generatedAt)}`, pageWidth / 2, 29, { align: "center" });

  let cursorY = 40;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Ringkasan per Departemen", 14, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    head: [["Departemen", "Active", "Pending", "Returned", "Total"]],
    body: data.deptSummary.map((d) => [
      d.dept,
      String(d.active),
      String(d.pending),
      String(d.returned),
      String(d.total),
    ]),
    foot: [[
      "TOTAL",
      String(data.totalActive),
      String(data.totalPending),
      String(data.totalReturned),
      String(data.totalActive + data.totalPending + data.totalReturned),
    ]],
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175] },
    footStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  cursorY = (doc as DocWithAutoTable).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Exception List - Perlu Cek Ulang (${data.exceptionList.length})`, 14, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    head: [["No Badge", "Nama", "Departemen", "Catatan"]],
    body: data.exceptionList.length > 0
      ? data.exceptionList.map((p) => [p.no_badge ?? "-", p.nama, p.departemen ?? "-", p.remarks ?? ""])
      : [["-", "Tidak ada exception minggu ini", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [217, 119, 6] },
    styles: { fontSize: 8 },
  });

  cursorY = (doc as DocWithAutoTable).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Tidak Kembali - Potensi Potong Gaji (${data.tidakKembali.length})`, 14, cursorY);
  cursorY += 3;

  autoTable(doc, {
    startY: cursorY,
    head: [["No Badge", "Nama", "Departemen", "Leader", "Catatan"]],
    body: data.tidakKembali.length > 0
      ? data.tidakKembali.map((p) => [p.no_badge ?? "-", p.nama, p.departemen ?? "-", p.leader ?? "-", p.remarks ?? ""])
      : [["-", "Tidak ada catatan tidak-kembali minggu ini", "-", "-", "-"]],
    theme: "grid",
    headStyles: { fillColor: [190, 18, 60] },
    styles: { fontSize: 8 },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `cd d:/PT_KOIN/major_overhaul_2026 && npx tsc --noEmit`
Expected: no errors referencing `lib/report/generatePdfReport.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/report/generatePdfReport.ts
git commit -m "feat(report): add PDF generator for weekly report"
```

---

### Task 5: Excel generator

**Files:**
- Create: `lib/report/generateExcelReport.ts`

**Interfaces:**
- Consumes: `ReportData`, `PesertaRow` from `lib/report/buildReportData.ts` (Task 3).
- Produces (consumed by Task 6): `async function generateExcelReport(data: ReportData): Promise<Buffer>` from `lib/report/generateExcelReport.ts`.

- [ ] **Step 1: Write the file**

```typescript
import ExcelJS from "exceljs";
import type { ReportData, PesertaRow } from "./buildReportData";

function addPesertaSheet(workbook: ExcelJS.Workbook, name: string, rows: PesertaRow[]) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [
    { header: "No Badge", key: "no_badge", width: 12 },
    { header: "Nama", key: "nama", width: 28 },
    { header: "Departemen", key: "departemen", width: 14 },
    { header: "Leader", key: "leader", width: 20 },
    { header: "Catatan", key: "remarks", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const p of rows) {
    sheet.addRow({
      no_badge: p.no_badge ?? "-",
      nama: p.nama,
      departemen: p.departemen ?? "-",
      leader: p.leader ?? "-",
      remarks: p.remarks ?? "",
    });
  }
}

export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PT KOIN Induction & Badge Management";
  workbook.created = data.generatedAt;

  const summarySheet = workbook.addWorksheet("Ringkasan");
  summarySheet.columns = [
    { header: "Departemen", key: "dept", width: 14 },
    { header: "Active", key: "active", width: 10 },
    { header: "Pending", key: "pending", width: 10 },
    { header: "Returned", key: "returned", width: 10 },
    { header: "Total", key: "total", width: 10 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  for (const d of data.deptSummary) {
    summarySheet.addRow(d);
  }
  const totalRow = summarySheet.addRow({
    dept: "TOTAL",
    active: data.totalActive,
    pending: data.totalPending,
    returned: data.totalReturned,
    total: data.totalActive + data.totalPending + data.totalReturned,
  });
  totalRow.font = { bold: true };

  addPesertaSheet(workbook, "Exception List", data.exceptionList);
  addPesertaSheet(workbook, "Tidak Kembali", data.tidakKembali);
  addPesertaSheet(workbook, "Returned (Clean)", data.returnedClean);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
```

- [ ] **Step 2: Verify with the TypeScript compiler**

Run: `cd d:/PT_KOIN/major_overhaul_2026 && npx tsc --noEmit`
Expected: no errors referencing `lib/report/generateExcelReport.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/report/generateExcelReport.ts
git commit -m "feat(report): add Excel generator for weekly report"
```

---

### Task 6: API route handler

**Files:**
- Create: `app/api/manpower/report/route.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server.ts`; `buildReportData` from `lib/report/buildReportData.ts` (Task 3); `generatePdfReport` from `lib/report/generatePdfReport.ts` (Task 4); `generateExcelReport` from `lib/report/generateExcelReport.ts` (Task 5).
- Produces (consumed by Task 7): `GET /api/manpower/report?format=pdf` → PDF file download; `GET /api/manpower/report?format=excel` → Excel file download; missing/invalid `format` → `400`; unauthenticated → `401`.

- [ ] **Step 1: Write the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReportData } from "@/lib/report/buildReportData";
import { generatePdfReport } from "@/lib/report/generatePdfReport";
import { generateExcelReport } from "@/lib/report/generateExcelReport";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "excel") {
    return NextResponse.json({ error: "format harus 'pdf' atau 'excel'" }, { status: 400 });
  }

  const reportData = await buildReportData(supabase);
  const dateStr = reportData.generatedAt.toISOString().slice(0, 10);

  if (format === "pdf") {
    const buffer = generatePdfReport(reportData);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="laporan-mingguan-id-card-${dateStr}.pdf"`,
      },
    });
  }

  const buffer = await generateExcelReport(reportData);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="laporan-mingguan-id-card-${dateStr}.xlsx"`,
    },
  });
}
```

- [ ] **Step 2: Verify the route starts and enforces auth**

Run: `cd d:/PT_KOIN/major_overhaul_2026 && npm run dev` (leave it running)

In a second terminal, run:
```bash
curl -i "http://localhost:3000/api/manpower/report?format=pdf"
```
Expected: `HTTP/1.1 401` with JSON body `{"error":"Unauthorized"}` (no session cookie was sent).

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 3: Commit**

```bash
git add app/api/manpower/report/route.ts
git commit -m "feat(report): add /api/manpower/report route for PDF/Excel export"
```

---

### Task 7: Export buttons on the Manpower page

**Files:**
- Create: `components/ExportReportButtons.tsx`
- Modify: `app/(app)/manpower/page.tsx:153-157`

**Interfaces:**
- Consumes: `/api/manpower/report?format=pdf` and `/api/manpower/report?format=excel` (Task 6).
- Produces: `<ExportReportButtons />` component rendered on `/manpower`.

- [ ] **Step 1: Write the component**

```tsx
export function ExportReportButtons() {
  return (
    <div className="flex items-center gap-2">
      <a href="/api/manpower/report?format=pdf" className="btn-secondary text-xs">
        Export PDF
      </a>
      <a href="/api/manpower/report?format=excel" className="btn-secondary text-xs">
        Export Excel
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Manpower page**

In `app/(app)/manpower/page.tsx`, add the import near the top with the other component imports (after line 5, `import { ManpowerCards } from "@/components/ManpowerCards";`):

```typescript
import { ExportReportButtons } from "@/components/ExportReportButtons";
```

Then replace the existing conditional block (currently at `app/(app)/manpower/page.tsx:153-157`):

```tsx
          {dept && (
            <Link href="/manpower" className="ml-auto text-xs text-slate-400 hover:text-slate-700 transition-colors">
              ← Semua divisi
            </Link>
          )}
```

with:

```tsx
          <div className="ml-auto flex items-center gap-3">
            <ExportReportButtons />
            {dept && (
              <Link href="/manpower" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
                ← Semua divisi
              </Link>
            )}
          </div>
```

- [ ] **Step 3: Verify end-to-end in the browser**

Run: `cd d:/PT_KOIN/major_overhaul_2026 && npm run dev`

1. Open `http://localhost:3000/login`, log in with `adhit24@gmail.com` / `Koinenc2315`.
2. Go to `http://localhost:3000/manpower`.
3. Confirm "Export PDF" and "Export Excel" buttons appear at the top-right of the stat strip.
4. Click "Export PDF" — confirm a file named `laporan-mingguan-id-card-<today>.pdf` downloads. Open it and confirm: both logos appear in the header, "Ringkasan per Departemen" table shows all 5 departments with numbers, Exception List and Tidak Kembali sections render (with placeholder rows if empty).
5. Click "Export Excel" — confirm a file named `laporan-mingguan-id-card-<today>.xlsx` downloads. Open it and confirm 4 sheets exist: Ringkasan, Exception List, Tidak Kembali, Returned (Clean), each with the expected columns.

Stop the dev server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add components/ExportReportButtons.tsx "app/(app)/manpower/page.tsx"
git commit -m "feat(manpower): add weekly report export buttons"
```

---

## Post-Plan Note

To populate the `[CEK ULANG]` and `[TIDAK KEMBALI dd/mm]` tags this report reads, HSE admin adds them manually into the `remarks` field via the existing "Edit Peserta" modal (`components/EditPesertaModal.tsx`) as described in the SOP (spec sections 3 and 4) — no additional UI is built for tagging in this plan, since the spec's intake process is a paper-first workflow digitized by hand.

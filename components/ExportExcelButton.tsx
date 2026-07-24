"use client";

import { useState } from "react";

export type ExportExcelRow = {
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

type Props = {
  title: string;
  subtitle: string;
  rows: ExportExcelRow[];
  filename: string;
};

export function ExportExcelButton({ title, subtitle, rows, filename }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

      // satu blok tabel per departemen (SECTION), diikuti baris SUBTOTAL, lalu
      // GRAND TOTAL di akhir - mengikuti urutan kemunculan di `rows` (caller
      // sudah mengurutkan sesuai DEPARTEMEN + urutan), sama seperti versi PDF.
      const groups: { dept: string; rows: ExportExcelRow[] }[] = [];
      for (const r of rows) {
        const last = groups[groups.length - 1];
        if (last && last.dept === r.departemen) last.rows.push(r);
        else groups.push({ dept: r.departemen, rows: [r] });
      }

      const header = ["No", "Tanggal", "Badge", "Nama", "PIN", "Jabatan", "Kondisi", "Batch", "Petugas"];
      const aoa: (string | number)[][] = [
        [title],
        [subtitle],
        [`Dicetak: ${dicetak} · Total: ${rows.length}`],
        [],
      ];

      let sectionNo = 0;
      for (const g of groups) {
        sectionNo += 1;
        aoa.push([`SECTION ${sectionNo}: ${g.dept}`]);
        aoa.push(header);
        for (const r of g.rows) {
          aoa.push([r.no, r.tanggal, r.badge, r.nama, r.pin, r.jabatan, r.kondisi, r.batch, r.petugas]);
        }
        aoa.push([`SUBTOTAL ${g.dept}`, "", "", "", "", "", "", "", g.rows.length]);
        aoa.push([]);
      }

      aoa.push([`GRAND TOTAL: ${rows.length}`]);
      aoa.push([]);
      aoa.push(["Catatan:"]);
      aoa.push(["1. Batch 1 = data pengembalian yang sudah dikunci per 15 Juli 2026."]);
      aoa.push(["2. Batch 2 = pengembalian mulai 18 Juli 2026, nomor urut lanjut otomatis per departemen."]);

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet["!cols"] = [
        { wch: 5 },
        { wch: 12 },
        { wch: 8 },
        { wch: 24 },
        { wch: 10 },
        { wch: 22 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Daftar");
      XLSX.writeFile(workbook, filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy || rows.length === 0}
      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Membuat Excel..." : "Export Excel"}
    </button>
  );
}

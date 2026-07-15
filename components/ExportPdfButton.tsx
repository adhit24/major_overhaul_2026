"use client";

import { useState } from "react";

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

type Props = {
  title: string;
  subtitle: string;
  rows: ExportPdfRow[];
  filename: string;
};

export function ExportPdfButton({ title, subtitle, rows, filename }: Props) {
  const [busy, setBusy] = useState(false);

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

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy || rows.length === 0}
      className="rounded-md px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Membuat PDF..." : "Export PDF"}
    </button>
  );
}

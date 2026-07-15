"use client";

import { useState } from "react";

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

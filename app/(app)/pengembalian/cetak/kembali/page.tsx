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

export default async function CetakKembaliPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const { q, dept } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("pengembalian_detail")
    .select("kondisi, pengembalian(tanggal, petugas, batch, urutan, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  const deptRank = (d: string | null | undefined) => {
    const i = DEPARTEMEN.indexOf((d ?? "") as (typeof DEPARTEMEN)[number]);
    return i === -1 ? DEPARTEMEN.length : i;
  };

  const batchLabel = (b: number | null | undefined) =>
    b === 1 ? "Batch 1 (dikunci)" : b === 2 ? "Batch 2 — mulai 18 Juli 2026" : `Batch ${b ?? "-"}`;

  const qLower = (q ?? "").toLowerCase();
  // Batch 1 dikunci - urutan (No) permanen mengikuti kolom `urutan`, bukan dihitung ulang
  // per render, supaya daftar cetak lama tidak pernah berubah nomornya walau ada data baru.
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => {
      const p = r.pengembalian?.peserta;
      if (!p) return false;
      if (dept && p.departemen !== dept) return false;
      if (qLower && !(`${p.nama} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
      return true;
    })
    .sort((a, b) => (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity));

  const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  const perDept = new Map<string, number>();
  const perBatch = new Map<number, number>();
  for (const r of rows) {
    const key = r.pengembalian?.peserta?.departemen ?? "Tanpa Divisi";
    perDept.set(key, (perDept.get(key) ?? 0) + 1);
    const b = r.pengembalian?.batch ?? 0;
    perBatch.set(b, (perBatch.get(b) ?? 0) + 1);
  }
  const deptSummary = [...perDept.entries()].sort(
    (a, b) => deptRank(a[0]) - deptRank(b[0])
  );
  const batchSummary = [...perBatch.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <main className="mx-auto max-w-6xl bg-white p-8 text-slate-900 print:p-0">
      <style>{"@media print { @page { size: A4 portrait; margin: 12mm; } }"}</style>

      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_cps_transparent.png" alt="Cirebon Power" className="h-12 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-lg font-bold">DAFTAR ID CARD DIKEMBALIKAN</h1>
          <p className="text-sm">Pengembalian ID Card & APD — MOH PLTU Cirebon 1</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/logo_koin_transparent.png" alt="JO KOIN" className="h-12 w-auto object-contain" />
      </header>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>Dicetak: {dicetak}</p>
        <p>
          Total: <b>{rows.length}</b> kartu
          {dept && <> · Divisi: <b>{dept}</b></>}
          {q && <> · Cari: &quot;{q}&quot;</>}
        </p>
      </div>

      <table className="mt-4 w-full table-fixed border-collapse text-[11px]">
        <colgroup>
          <col className="w-[5%]" />
          <col className="w-[9%]" />
          <col className="w-[22%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="px-1.5 py-2">No</th>
            <th className="px-1.5 py-2">Badge</th>
            <th className="px-1.5 py-2">Nama</th>
            <th className="px-1.5 py-2">PIN</th>
            <th className="px-1.5 py-2">Jabatan</th>
            <th className="px-1.5 py-2">Kondisi</th>
            <th className="px-1.5 py-2 whitespace-nowrap">Tgl Kembali</th>
            <th className="px-1.5 py-2">Petugas</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let lastBatch: number | null | undefined = undefined;
            return rows.map((r, i) => {
              const p = r.pengembalian?.peserta;
              const b = r.pengembalian?.batch ?? null;
              const showGroup = b !== lastBatch;
              lastBatch = b;
              return (
                <Fragment key={i}>
                  {showGroup && (
                    <tr className="bg-slate-100">
                      <td colSpan={8} className="px-1.5 py-1.5 font-semibold uppercase tracking-wide">
                        {batchLabel(b)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.urutan ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_badge ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.nama ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{p?.no_erp ?? "-"}</td>
                    <td className="px-1.5 py-1 break-words">{p?.jabatan_deskripsi ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.kondisi}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{r.pengembalian?.tanggal ?? "-"}</td>
                    <td className="px-1.5 py-1 whitespace-nowrap">{formatPetugas(r.pengembalian?.petugas)}</td>
                  </tr>
                </Fragment>
              );
            });
          })()}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-1.5 py-8 text-center text-slate-400">Tidak ada data.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 flex flex-wrap gap-x-16 gap-y-4" style={{ breakInside: "avoid" }}>
        <table className="border-collapse text-xs">
          <tbody>
            {deptSummary.map(([dName, count]) => (
              <tr key={dName} className="border-b border-slate-100">
                <td className="py-1 pr-8 text-slate-600">{dName}</td>
                <td className="py-1 text-right font-medium tabular-nums">{count}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-800">
              <td className="py-1.5 pr-8 font-semibold">Total Kartu</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{rows.length}</td>
            </tr>
          </tbody>
        </table>

        <table className="border-collapse text-xs">
          <tbody>
            {batchSummary.map(([b, count]) => (
              <tr key={b} className="border-b border-slate-100">
                <td className="py-1 pr-8 text-slate-600">{batchLabel(b)}</td>
                <td className="py-1 text-right font-medium tabular-nums">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

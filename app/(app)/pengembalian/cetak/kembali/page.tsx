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
  const sections: { dept: string; rows: Row[] }[] = DEPARTEMEN.map((dName) => ({
    dept: dName as string,
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

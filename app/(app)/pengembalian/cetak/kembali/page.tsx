import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Row = {
  kondisi: string;
  pengembalian: {
    tanggal: string;
    petugas: string | null;
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
    .select("kondisi, pengembalian(tanggal, petugas, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  const deptRank = (d: string | null | undefined) => {
    const i = DEPARTEMEN.indexOf((d ?? "") as (typeof DEPARTEMEN)[number]);
    return i === -1 ? DEPARTEMEN.length : i;
  };

  const qLower = (q ?? "").toLowerCase();
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => {
      const p = r.pengembalian?.peserta;
      if (!p) return false;
      if (dept && p.departemen !== dept) return false;
      if (qLower && !(`${p.nama} ${p.no_badge ?? ""} ${p.no_erp ?? ""}`.toLowerCase().includes(qLower))) return false;
      return true;
    })
    .sort((a, b) =>
      deptRank(a.pengembalian?.peserta?.departemen) - deptRank(b.pengembalian?.peserta?.departemen) ||
      (a.pengembalian?.peserta?.nama ?? "").localeCompare(b.pengembalian?.peserta?.nama ?? "")
    );

  const dicetak = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });

  return (
    <main className="mx-auto max-w-6xl bg-white p-8 text-slate-900 print:p-0">
      <style>{"@media print { @page { size: A4 landscape; margin: 12mm; } }"}</style>

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

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50 text-left">
            <th className="px-2 py-2">No</th>
            <th className="px-2 py-2">No Badge</th>
            <th className="px-2 py-2">Nama</th>
            <th className="px-2 py-2">PIN</th>
            <th className="px-2 py-2">Divisi</th>
            <th className="px-2 py-2">Jabatan</th>
            <th className="px-2 py-2">Kondisi</th>
            <th className="px-2 py-2">Tanggal Kembali</th>
            <th className="px-2 py-2">Petugas</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let lastDept: string | null | undefined = undefined;
            let no = 0;
            return rows.map((r, i) => {
              const p = r.pengembalian?.peserta;
              const showGroup = p?.departemen !== lastDept;
              lastDept = p?.departemen;
              no += 1;
              return (
                <Fragment key={i}>
                  {showGroup && (
                    <tr className="bg-slate-100">
                      <td colSpan={9} className="px-2 py-1.5 font-semibold uppercase tracking-wide">
                        {p?.departemen ?? "Tanpa Divisi"}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-200" style={{ breakInside: "avoid" }}>
                    <td className="px-2 py-1.5">{no}</td>
                    <td className="px-2 py-1.5">{p?.no_badge ?? "-"}</td>
                    <td className="px-2 py-1.5">{p?.nama ?? "-"}</td>
                    <td className="px-2 py-1.5">{p?.no_erp ?? "-"}</td>
                    <td className="px-2 py-1.5">{p?.departemen ?? "-"}</td>
                    <td className="px-2 py-1.5">{p?.jabatan_deskripsi ?? "-"}</td>
                    <td className="px-2 py-1.5">{r.kondisi}</td>
                    <td className="px-2 py-1.5">{r.pengembalian?.tanggal ?? "-"}</td>
                    <td className="px-2 py-1.5">{r.pengembalian?.petugas ?? "-"}</td>
                  </tr>
                </Fragment>
              );
            });
          })()}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2 py-8 text-center text-slate-400">Tidak ada data.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

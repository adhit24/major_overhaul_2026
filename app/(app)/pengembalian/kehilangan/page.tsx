import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { formatPetugas, formatRupiah } from "@/lib/pengembalian";
import { DEPARTEMEN } from "@/lib/constants";

export const dynamic = "force-dynamic";

const batchLabel = (b: number | null | undefined) => (b != null ? `Batch ${b}` : "Batch -");

// Urutan bisnis DEPARTEMEN (bukan alfabetis), sama seperti halaman Pengembalian utama.
const deptRank = (d: string | null | undefined) => {
  const i = DEPARTEMEN.indexOf((d ?? "") as (typeof DEPARTEMEN)[number]);
  return i === -1 ? DEPARTEMEN.length : i;
};

type Row = {
  potongan: number;
  pengembalian: {
    id: number;
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

export default async function KartuHilangPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const { q, dept } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("pengembalian_detail")
    .select("potongan, pengembalian(id, tanggal, petugas, batch, urutan, departemen, peserta(id, nama, no_badge, no_erp, departemen, jabatan_deskripsi))")
    .eq("item", "KARTU")
    .eq("kondisi", "HILANG");

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
      (a.pengembalian?.urutan ?? Infinity) - (b.pengembalian?.urutan ?? Infinity)
    );

  const totalPotongan = rows.reduce((s, r) => s + Number(r.potongan), 0);

  const cetakParams = new URLSearchParams();
  if (q) cetakParams.set("q", q);
  if (dept) cetakParams.set("dept", dept);
  const cetakHref = `/pengembalian/cetak/kehilangan${cetakParams.toString() ? `?${cetakParams.toString()}` : ""}`;

  return (
    <>
      <TopBar title="Kartu ID Hilang" email={userData.user?.email} />
      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Kartu Hilang" value={rows.length} tone="danger" />
          <StatCard label="Total Potongan Deposit" value={formatRupiah(totalPotongan)} tone="danger" />
          <Link href="/pengembalian" className="card flex items-center justify-center text-sm font-medium text-brand-600 hover:bg-brand-50">
            ← Kembali ke Pengembalian
          </Link>
        </div>

        <form method="get" className="card flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label-field">Cari nama / badge / PIN</label>
            <input name="q" defaultValue={q ?? ""} placeholder="Ketik nama, no badge, atau PIN..." className="input-field" />
          </div>
          <div>
            <label className="label-field">Divisi</label>
            <select name="dept" defaultValue={dept ?? ""} className="input-field">
              <option value="">Semua Divisi</option>
              {DEPARTEMEN.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary text-sm">Cari</button>
          {(q || dept) && (
            <Link href="/pengembalian/kehilangan" className="btn-ghost text-sm">Reset</Link>
          )}
        </form>

        <div className="card p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Daftar Kartu ID Hilang</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {rows.length} kartu · total potongan {formatRupiah(totalPotongan)}
              </p>
            </div>
            <Link href={cetakHref} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:underline">
              Cetak Daftar
            </Link>
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Tidak ada kartu hilang.</p>
          ) : (
            <>
              {/* Mobile: kartu (< sm) */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {(() => {
                  let lastDept: string | null | undefined = undefined;
                  return rows.map((r, i) => {
                    const p = r.pengembalian?.peserta;
                    const showGroup = p?.departemen !== lastDept;
                    lastDept = p?.departemen;
                    return (
                      <Fragment key={`${r.pengembalian?.id}-${i}`}>
                        {showGroup && (
                          <div className="bg-slate-50/80 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {p?.departemen ?? "Tanpa Divisi"}
                          </div>
                        )}
                        <div className="p-3.5 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="mr-1.5 text-xs tabular-nums text-slate-400">#{r.pengembalian?.urutan ?? "-"}</span>
                              {p ? (
                                <Link href={`/pengembalian/${p.id}`} className="font-semibold text-slate-800 hover:text-brand-600 hover:underline">
                                  {p.nama}
                                </Link>
                              ) : (
                                <span className="font-semibold text-slate-800">-</span>
                              )}
                              <p className="text-xs text-slate-400">
                                {p?.no_badge ? `Badge ${p.no_badge}` : "-"}{p?.no_erp ? ` · PIN ${p.no_erp}` : ""}
                              </p>
                            </div>
                            <span className="font-semibold tabular-nums text-red-600">{formatRupiah(Number(r.potongan))}</span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="badge-pill bg-slate-100 text-slate-600">{batchLabel(r.pengembalian?.batch)}</span>
                            <span className="text-xs text-slate-400">{r.pengembalian?.tanggal ?? "-"}</span>
                            {r.pengembalian?.petugas && <span className="text-xs text-slate-400">· {r.pengembalian.petugas}</span>}
                          </div>
                        </div>
                      </Fragment>
                    );
                  });
                })()}
              </div>

              {/* Desktop/tablet: tabel (>= sm) */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3">No</th>
                      <th className="px-4 py-3">No Badge</th>
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">PIN</th>
                      <th className="px-4 py-3">Jabatan</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Petugas</th>
                      <th className="px-4 py-3 text-right">Potongan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lastDept: string | null | undefined = undefined;
                      return rows.map((r, i) => {
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
                              <td className="px-4 py-2.5 text-slate-500">{r.pengembalian?.tanggal ?? "-"}</td>
                              <td className="px-4 py-2.5 text-slate-500">{formatPetugas(r.pengembalian?.petugas)}</td>
                              <td className="px-4 py-2.5 text-right font-medium tabular-nums text-red-600">{formatRupiah(Number(r.potongan))}</td>
                            </tr>
                          </Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

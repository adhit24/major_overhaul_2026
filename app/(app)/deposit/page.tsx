import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DEPARTEMEN, DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
import { createDepositBatch, createCpsRefund } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { HapusCpsRefundButton } from "@/components/HapusCpsRefundButton";

export const dynamic = "force-dynamic";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function DepositPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: batches } = await supabase
    .from("deposit_batch")
    .select("*")
    .order("tanggal", { ascending: false });

  const doneBatches  = (batches ?? []).filter((b) => b.status_batch === "DONE");
  const totalDeposit = (batches ?? []).reduce((s, b) => s + Number(b.total_deposit ?? 0), 0);
  const totalKartu   = (batches ?? []).reduce((s, b) => s + Number(b.jumlah_kartu ?? 0), 0);
  const doneKartu    = doneBatches.reduce((s, b) => s + Number(b.jumlah_kartu ?? 0), 0);
  const doneDeposit  = doneBatches.reduce((s, b) => s + Number(b.total_deposit ?? 0), 0);

  const { data: potonganRows } = await supabase.from("pengembalian_detail").select("potongan").range(0, 1999);
  const totalPotongan = (potonganRows ?? []).reduce((s, r) => s + Number(r.potongan), 0);

  // Summary Pengembalian ID Card - jumlah kartu yang sudah dikembalikan, dipecah per
  // departemen x batch (Batch 1 = dikunci, Batch 2 = mulai 18 Juli 2026, nomor lanjut per
  // departemen). Query ringan (cuma hitung), detail lengkap & cetak/export ada di /pengembalian.
  const { data: kembaliRows } = await supabase
    .from("pengembalian_detail")
    .select("pengembalian(departemen, batch)")
    .eq("item", "KARTU")
    .neq("kondisi", "HILANG");

  type KembaliCount = { departemen: string | null; batch: number | null };
  const perDeptBatch = new Map<string, { batch1: number; batch2: number }>();
  for (const r of (kembaliRows ?? []) as unknown as { pengembalian: KembaliCount | null }[]) {
    const dept = r.pengembalian?.departemen ?? "Tanpa Divisi";
    const b = r.pengembalian?.batch;
    const row = perDeptBatch.get(dept) ?? { batch1: 0, batch2: 0 };
    if (b === 1) row.batch1 += 1;
    else if (b === 2) row.batch2 += 1;
    perDeptBatch.set(dept, row);
  }
  const deptOrder = [...DEPARTEMEN, "Tanpa Divisi"];
  const kembaliBreakdown = deptOrder
    .filter((d) => perDeptBatch.has(d))
    .map((d) => ({ dept: d, ...perDeptBatch.get(d)! }));
  const totalKembaliBatch1 = kembaliBreakdown.reduce((s, r) => s + r.batch1, 0);
  const totalKembaliBatch2 = kembaliBreakdown.reduce((s, r) => s + r.batch2, 0);
  const totalKembali = totalKembaliBatch1 + totalKembaliBatch2;

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

  return (
    <>
      <TopBar title="Summary Deposit" email={userData.user?.email} />

      <main className="flex-1 space-y-6 p-4 pb-10 sm:p-6">

        {/* ── Alerts ── */}
        {params.saved === "cps" ? (
          <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
            ✓ Pengembalian dana CPS berhasil dicatat.
          </p>
        ) : params.saved ? (
          <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
            ✓ Batch deposit berhasil disimpan.
          </p>
        ) : null}
        {params.error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {params.error}
          </p>
        )}

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Batch</p>
            <p className="mt-2 text-2xl font-bold text-slate-800 sm:text-3xl">{batches?.length ?? 0}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Kartu</p>
            <p className="mt-2 text-2xl font-bold text-slate-800 sm:text-3xl">{totalKartu.toLocaleString("id-ID")}</p>
            <p className="mt-1 text-xs text-slate-400">DONE: {doneKartu}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Deposit</p>
            <p className="mt-2 text-lg font-bold text-slate-800 sm:text-2xl">{formatRupiah(totalDeposit)}</p>
            <p className="mt-1 text-xs text-slate-400">DONE: {formatRupiah(doneDeposit)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tarif / Kartu</p>
            <p className="mt-2 text-lg font-bold text-emerald-600 sm:text-2xl">Rp 50.000</p>
          </div>
          <div className="card text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Potongan Tercatat</p>
            <p className={`mt-2 text-lg font-bold sm:text-2xl ${totalPotongan ? "text-red-600" : "text-slate-800"}`}>{formatRupiah(totalPotongan)}</p>
            <p className="mt-1 text-xs text-slate-400">dari pengembalian hilang/rusak</p>
          </div>
        </div>

        {/* ── Form tambah batch ── */}
        <div className="card">
          <p className="mb-4 text-sm font-semibold text-slate-700">Tambah Batch Pengajuan Kartu</p>
          <form action={createDepositBatch} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
            <div className="sm:col-span-1">
              <label className="label-field">Tanggal *</label>
              <input name="tanggal" type="date" required className="input-field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Departemen/Section *</label>
              <select name="departemen_section" required defaultValue="" className="input-field">
                <option value="" disabled>Pilih</option>
                {DEPARTEMEN_SECTION.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label-field">Status *</label>
              <select name="status_batch" required defaultValue="PENDING" className="input-field">
                {STATUS_BATCH.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="label-field">Jumlah Kartu *</label>
              <input name="jumlah_kartu" type="number" min={1} required className="input-field" />
            </div>
            <div className="sm:col-span-1">
              <label className="label-field">Tarif (Rp)</label>
              <input name="tarif_kartu" type="number" min={0} defaultValue={50000} className="input-field" />
            </div>
            <div className="sm:col-span-3">
              <label className="label-field">Keterangan</label>
              <input name="keterangan" className="input-field" placeholder="Pengajuan ID Card - TBN/BOP" />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Rentang No ID</label>
              <input name="rentang_no_id" className="input-field" placeholder="107 - 125 atau 96,98,99" />
            </div>
            <div className="sm:col-span-1">
              <label className="label-field">Due Date</label>
              <input name="due_date" type="date" className="input-field" />
            </div>
            <div className="sm:col-span-5">
              <label className="label-field">Remarks</label>
              <input name="remarks" className="input-field" />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <SubmitButton className="btn-primary w-full" pendingText="Menyimpan...">Simpan</SubmitButton>
            </div>
          </form>
        </div>

        {/* ── Tabel deposit ── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Riwayat Batch Deposit</h2>
            <p className="text-xs text-slate-400 mt-0.5">{batches?.length ?? 0} batch tercatat</p>
          </div>
          {!batches?.length ? (
            <p className="px-5 py-10 text-center text-slate-400 text-sm">Belum ada batch deposit.</p>
          ) : (
            <>
              {/* Mobile: kartu (< sm) */}
              <div className="flex flex-col gap-2.5 p-3.5 sm:hidden">
                {batches.map((b) => (
                  <div key={b.id} className="data-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {b.departemen_section ? (
                          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {b.departemen_section}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        <p className="mt-1 text-xs text-slate-400">{b.tanggal}</p>
                      </div>
                      <StatusBadge status={b.status_batch} />
                    </div>
                    {b.keterangan && <p className="mt-2 text-sm text-slate-600">{b.keterangan}</p>}
                    <div className="my-2.5 border-t border-slate-100" />
                    <div className="data-card-row">
                      <span className="data-card-label">Rentang No ID</span>
                      <span className="data-card-value font-mono text-xs">{b.rentang_no_id ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Jml Kartu</span>
                      <span className="data-card-value font-semibold">{Number(b.jumlah_kartu).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Total Deposit</span>
                      <span className="data-card-value font-semibold text-emerald-700">{formatRupiah(Number(b.total_deposit))}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Due Date</span>
                      <span className="data-card-value">{b.due_date ?? "-"}</span>
                    </div>
                  </div>
                ))}
                <div className="data-card bg-slate-50">
                  <div className="data-card-row">
                    <span className="data-card-label">Total Kartu</span>
                    <span className="data-card-value font-semibold">{totalKartu.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="data-card-row">
                    <span className="data-card-label">Total Deposit</span>
                    <span className="data-card-value font-semibold text-emerald-700">{formatRupiah(totalDeposit)}</span>
                  </div>
                </div>
              </div>

              {/* Desktop/tablet: tabel (>= sm) */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 text-left font-semibold">Tanggal</th>
                      <th className="px-4 py-3 text-left font-semibold">Departemen</th>
                      <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                      <th className="px-4 py-3 text-left font-semibold">Rentang No ID</th>
                      <th className="px-4 py-3 text-right font-semibold">Jml Kartu</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Deposit</th>
                      <th className="px-4 py-3 text-center font-semibold">Due Date</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batches.map((b, i) => (
                      <tr
                        key={b.id}
                        className={`transition-colors hover:bg-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                      >
                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{b.tanggal}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {b.departemen_section ? (
                            <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {b.departemen_section}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[220px]">
                          <span className="line-clamp-2">{b.keterangan ?? <span className="text-slate-300">—</span>}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                          {b.rentang_no_id ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {Number(b.jumlah_kartu).toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {formatRupiah(Number(b.total_deposit))}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 whitespace-nowrap">
                          {b.due_date ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={b.status_batch} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer total */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold text-slate-700">
                      <td className="px-5 py-3" colSpan={4}>
                        Total Keseluruhan
                      </td>
                      <td className="px-4 py-3 text-right text-slate-800">
                        {totalKartu.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-700 whitespace-nowrap">
                        {formatRupiah(totalDeposit)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Summary Pengembalian ID Card ── */}
        <div className="card p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Summary Pengembalian ID Card</h2>
              <p className="text-xs text-slate-400 mt-0.5">{totalKembali} kartu sudah dikembalikan</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Link href="/pengembalian" className="font-medium text-brand-600 hover:underline">
                Lihat Detail
              </Link>
              <Link href="/pengembalian/cetak/kembali" className="font-medium text-brand-600 hover:underline">
                Cetak Daftar
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-5">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Dikembalikan</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{totalKembali}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch 1 (dikunci)</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{totalKembaliBatch1}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Batch 2 (mulai 18 Jul)</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">{totalKembaliBatch2}</p>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-3 text-left font-semibold sm:px-5">Departemen</th>
                  <th className="px-2 py-3 text-right font-semibold sm:px-4">Batch 1</th>
                  <th className="px-2 py-3 text-right font-semibold sm:px-4">Batch 2</th>
                  <th className="px-3 py-3 text-right font-semibold sm:px-4">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {kembaliBreakdown.map((r) => (
                  <tr key={r.dept}>
                    <td className="px-3 py-2.5 text-slate-700 sm:px-5">{r.dept}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 sm:px-4">{r.batch1 || "-"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 sm:px-4">{r.batch2 || "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800 sm:px-4">{r.batch1 + r.batch2}</td>
                  </tr>
                ))}
                {kembaliBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">
                      Belum ada ID Card yang dikembalikan.
                    </td>
                  </tr>
                )}
              </tbody>
              {kembaliBreakdown.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold text-slate-700">
                    <td className="px-3 py-3 sm:px-5">Total Keseluruhan</td>
                    <td className="px-2 py-3 text-right tabular-nums sm:px-4">{totalKembaliBatch1}</td>
                    <td className="px-2 py-3 text-right tabular-nums sm:px-4">{totalKembaliBatch2}</td>
                    <td className="px-3 py-3 text-right tabular-nums sm:px-4">{totalKembali}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

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

      </main>
    </>
  );
}

import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
import { createDepositBatch } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

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

  return (
    <>
      <TopBar title="Summary Deposit" email={userData.user?.email} />

      <main className="flex-1 space-y-6 p-4 pb-10 sm:p-6">

        {/* ── Alerts ── */}
        {params.saved && (
          <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700">
            ✓ Batch deposit berhasil disimpan.
          </p>
        )}
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
          <div className="overflow-x-auto">
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
                {(batches ?? []).map((b, i) => (
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
                {!batches?.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 text-sm">
                      Belum ada batch deposit.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* Footer total */}
              {(batches?.length ?? 0) > 0 && (
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
              )}
            </table>
          </div>
        </div>

      </main>
    </>
  );
}

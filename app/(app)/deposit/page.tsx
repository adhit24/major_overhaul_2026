import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DEPARTEMEN_SECTION, STATUS_BATCH } from "@/lib/constants";
import { createDepositBatch } from "./actions";

export const dynamic = "force-dynamic";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
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

  const totalDeposit = (batches ?? []).reduce((sum, b) => sum + Number(b.total_deposit ?? 0), 0);
  const totalKartu = (batches ?? []).reduce((sum, b) => sum + Number(b.jumlah_kartu ?? 0), 0);

  return (
    <>
      <TopBar title="Summary Deposit" email={userData.user?.email} />
      <main className="flex-1 space-y-6 p-6">
        {params.saved ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Batch deposit berhasil disimpan.</p>
        ) : null}
        {params.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{params.error}</p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-sm font-medium text-slate-500">Total Batch</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{batches?.length ?? 0}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-slate-500">Total Kartu Diajukan</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{totalKartu}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-slate-500">Total Deposit</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatRupiah(totalDeposit)}</p>
          </div>
        </div>

        <div className="card">
          <p className="mb-3 text-sm font-semibold text-slate-700">Tambah Batch Pengajuan Kartu</p>
          <form action={createDepositBatch} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label-field">Tanggal *</label>
              <input name="tanggal" type="date" required className="input-field" />
            </div>
            <div>
              <label className="label-field">Departemen/Section *</label>
              <select name="departemen_section" required defaultValue="" className="input-field">
                <option value="" disabled>
                  Pilih
                </option>
                {DEPARTEMEN_SECTION.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Status Batch *</label>
              <select name="status_batch" required defaultValue="PENDING" className="input-field">
                {STATUS_BATCH.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Keterangan</label>
              <input name="keterangan" className="input-field" placeholder="contoh: Pengajuan ID Card - TBN/BOP" />
            </div>
            <div>
              <label className="label-field">Rentang No ID</label>
              <input name="rentang_no_id" className="input-field" placeholder="contoh: 107 - 125" />
            </div>
            <div>
              <label className="label-field">Jumlah Kartu *</label>
              <input name="jumlah_kartu" type="number" min={1} required className="input-field" />
            </div>
            <div>
              <label className="label-field">Tarif Kartu (Rp)</label>
              <input name="tarif_kartu" type="number" min={0} defaultValue={50000} className="input-field" />
            </div>
            <div>
              <label className="label-field">Due Date</label>
              <input name="due_date" type="date" className="input-field" />
            </div>
            <div className="sm:col-span-3">
              <label className="label-field">Remarks</label>
              <input name="remarks" className="input-field" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit" className="btn-primary">
                Simpan Batch
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Departemen</th>
                  <th className="py-2 pr-4">Keterangan</th>
                  <th className="py-2 pr-4">Rentang No ID</th>
                  <th className="py-2 pr-4">Jml Kartu</th>
                  <th className="py-2 pr-4">Total Deposit</th>
                  <th className="py-2 pr-4">Due Date</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {(batches ?? []).map((b) => (
                  <tr key={b.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{b.tanggal}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.departemen_section}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.keterangan ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.rentang_no_id ?? "-"}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.jumlah_kartu}</td>
                    <td className="py-2 pr-4 text-slate-600">{formatRupiah(Number(b.total_deposit))}</td>
                    <td className="py-2 pr-4 text-slate-600">{b.due_date ?? "-"}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={b.status_batch} />
                    </td>
                  </tr>
                ))}
                {!batches?.length ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      Belum ada batch deposit.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}

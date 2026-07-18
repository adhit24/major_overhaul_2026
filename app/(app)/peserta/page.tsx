 import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { EditPesertaButton } from "@/components/EditPesertaModal";
import { DEPARTEMEN, STATUS_BADGE } from "@/lib/constants";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function PesertaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; departemen?: string; status?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  let query = supabase
    .from("peserta")
    .select("id, nama, no_badge, no_erp, departemen, kategori, leader, status_badge, tanggal_induction, due_date, jabatan_deskripsi, ktp, sks, sertifikat, remarks")
    .order("tanggal_induction", { ascending: false })
    .limit(100);

  if (params.q) {
    const term = params.q.trim();
    query = query.or(`nama.ilike.%${term}%,no_badge.ilike.%${term}%,no_erp.ilike.%${term}%`);
  }
  if (params.departemen === "__PERLU_VERIFIKASI__") {
    query = query.is("departemen", null);
  } else if (params.departemen) {
    query = query.eq("departemen", params.departemen);
  }
  if (params.status) {
    query = query.eq("status_badge", params.status);
  }

  const { data: peserta, error } = await query;

  return (
    <>
      <TopBar title="Database Peserta" email={userData.user?.email} />
      <main className="flex-1 space-y-4 p-4 sm:p-6">
        {params.saved ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Data peserta berhasil disimpan.
          </p>
        ) : null}

        <div className="card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3" method="get">
              <div className="w-full sm:w-auto">
                <label className="label-field">Cari</label>
                <input
                  type="text"
                  name="q"
                  defaultValue={params.q}
                  placeholder="Nama / No Badge / No ERP"
                  className="input-field w-full sm:w-56"
                />
              </div>
              <div className="w-full sm:w-auto">
                <label className="label-field">Departemen</label>
                <select name="departemen" defaultValue={params.departemen ?? ""} className="input-field w-full sm:w-40">
                  <option value="">Semua</option>
                  {DEPARTEMEN.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="__PERLU_VERIFIKASI__">Perlu Verifikasi</option>
                </select>
              </div>
              <div className="w-full sm:w-auto">
                <label className="label-field">Status Badge</label>
                <select name="status" defaultValue={params.status ?? ""} className="input-field w-full sm:w-40">
                  <option value="">Semua</option>
                  {STATUS_BADGE.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="btn-secondary w-full sm:w-auto" pendingText="Memfilter...">
                Filter
              </SubmitButton>
            </form>
            <Link href="/peserta/baru" className="btn-primary justify-center">
              + Input Peserta Baru
            </Link>
          </div>

          {!peserta?.length ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {error ? error.message : "Tidak ada data yang cocok dengan filter."}
            </p>
          ) : (
            <>
              {/* Mobile: kartu ringkas per peserta (< sm) */}
              <div className="flex flex-col gap-2.5 sm:hidden">
                {peserta.map((p) => (
                  <div key={p.id} className="data-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{p.nama}</p>
                        <p className="text-xs text-slate-400">
                          {p.no_badge ? `Badge ${p.no_badge}` : "Belum ada badge"}
                          {p.no_erp ? ` · ERP ${p.no_erp}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={p.status_badge} />
                    </div>
                    <div className="my-2.5 border-t border-slate-100" />
                    <div className="data-card-row">
                      <span className="data-card-label">Departemen</span>
                      <span className="data-card-value">
                        {p.departemen ?? <span className="badge-pill bg-orange-50 text-orange-700">Perlu Verifikasi</span>}
                      </span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Kategori</span>
                      <span className="data-card-value">{p.kategori ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Leader</span>
                      <span className="data-card-value">{p.leader ?? "-"}</span>
                    </div>
                    <div className="data-card-row">
                      <span className="data-card-label">Tgl Induction</span>
                      <span className="data-card-value">{p.tanggal_induction ?? "-"}</span>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5">
                      <EditPesertaButton peserta={{
                        id:                p.id,
                        nama:              p.nama,
                        no_badge:          p.no_badge ?? null,
                        no_erp:            p.no_erp ?? null,
                        status_badge:      p.status_badge ?? null,
                        jabatan_deskripsi: p.jabatan_deskripsi ?? null,
                        leader:            p.leader ?? null,
                        tanggal_induction: p.tanggal_induction ?? null,
                        due_date:          p.due_date ?? null,
                        ktp:               p.ktp ?? false,
                        sks:               p.sks ?? false,
                        sertifikat:        p.sertifikat ?? false,
                        remarks:           p.remarks ?? null,
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabel penuh (>= sm) */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                      <th className="py-2 pr-4">Nama</th>
                      <th className="py-2 pr-4">No ERP</th>
                      <th className="py-2 pr-4">No Badge</th>
                      <th className="py-2 pr-4">Departemen</th>
                      <th className="py-2 pr-4">Kategori</th>
                      <th className="py-2 pr-4">Leader</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Tgl Induction</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {peserta.map((p) => (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 pr-4 font-medium text-slate-800">{p.nama}</td>
                        <td className="py-2 pr-4 text-slate-600">{p.no_erp ?? "-"}</td>
                        <td className="py-2 pr-4 text-slate-600">{p.no_badge ?? "-"}</td>
                        <td className="py-2 pr-4 text-slate-600">
                          {p.departemen ?? <span className="badge-pill bg-orange-50 text-orange-700">Perlu Verifikasi</span>}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{p.kategori ?? "-"}</td>
                        <td className="py-2 pr-4 text-slate-600">{p.leader ?? "-"}</td>
                        <td className="py-2 pr-4">
                          <StatusBadge status={p.status_badge} />
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{p.tanggal_induction ?? "-"}</td>
                        <td className="py-2">
                          <EditPesertaButton peserta={{
                            id:                p.id,
                            nama:              p.nama,
                            no_badge:          p.no_badge ?? null,
                            no_erp:            p.no_erp ?? null,
                            status_badge:      p.status_badge ?? null,
                            jabatan_deskripsi: p.jabatan_deskripsi ?? null,
                            leader:            p.leader ?? null,
                            tanggal_induction: p.tanggal_induction ?? null,
                            due_date:          p.due_date ?? null,
                            ktp:               p.ktp ?? false,
                            sks:               p.sks ?? false,
                            sertifikat:        p.sertifikat ?? false,
                            remarks:           p.remarks ?? null,
                          }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-slate-400">Menampilkan maksimum 100 baris terbaru. Gunakan filter untuk mempersempit hasil.</p>
        </div>
      </main>
    </>
  );
}

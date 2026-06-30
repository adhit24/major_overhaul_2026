import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { DEPARTEMEN, KATEGORI, STATUS_BADGE } from "@/lib/constants";
import { createPeserta } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function PesertaBaruPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="Input Peserta Baru" email={userData.user?.email} />
      <main className="flex-1 p-6">
        <form action={createPeserta} className="card mx-auto max-w-3xl space-y-5">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field">Nama *</label>
              <input name="nama" required className="input-field" placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="label-field">Tanggal Induction *</label>
              <input name="tanggal_induction" type="date" required className="input-field" />
            </div>
            <div>
              <label className="label-field">No ERP</label>
              <input name="no_erp" className="input-field" />
            </div>
            <div>
              <label className="label-field">Job No</label>
              <input name="job_no" className="input-field" placeholder="contoh: M-26019" />
            </div>
            <div>
              <label className="label-field">Departemen *</label>
              <select name="departemen" required defaultValue="" className="input-field">
                <option value="" disabled>
                  Pilih departemen
                </option>
                {DEPARTEMEN.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Kategori *</label>
              <select name="kategori" required defaultValue="" className="input-field">
                <option value="" disabled>
                  Pilih kategori
                </option>
                {KATEGORI.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Jabatan / Deskripsi</label>
              <input name="jabatan_deskripsi" className="input-field" />
            </div>
            <div>
              <label className="label-field">Leader</label>
              <input name="leader" className="input-field" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Badge &amp; Dokumen</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field">Status Badge *</label>
                <select name="status_badge" required defaultValue="" className="input-field">
                  <option value="" disabled>
                    Pilih status
                  </option>
                  {STATUS_BADGE.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field">No Badge (wajib kecuali PENDING)</label>
                <input name="no_badge" className="input-field" />
              </div>
              <div>
                <label className="label-field">Due Date</label>
                <input name="due_date" type="date" className="input-field" />
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="ktp" className="h-4 w-4 rounded border-slate-300" /> KTP
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="sks" className="h-4 w-4 rounded border-slate-300" /> SKS
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="sertifikat" className="h-4 w-4 rounded border-slate-300" /> Sertifikat
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="label-field">Remarks</label>
            <textarea name="remarks" rows={2} className="input-field" />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <a href="/peserta" className="btn-secondary">
              Batal
            </a>
            <SubmitButton className="btn-primary" pendingText="Menyimpan...">
              Simpan &amp; Validasi
            </SubmitButton>
          </div>
        </form>
      </main>
    </>
  );
}

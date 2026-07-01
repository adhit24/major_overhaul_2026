'use client';

import { useState, useTransition } from 'react';
import { updatePeserta } from '@/app/(app)/actions';

type Peserta = {
  id: number;
  nama: string;
  no_badge: string | null;
  no_erp: string | null;
  status_badge: string | null;
  jabatan_deskripsi: string | null;
  leader: string | null;
  tanggal_induction: string | null;
  due_date: string | null;
  ktp: boolean;
  sks: boolean;
  sertifikat: boolean;
  remarks: string | null;
};

export function EditPesertaButton({ peserta }: { peserta: Peserta }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
        title="Edit data"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
        </svg>
      </button>
      {open && (
        <EditModal peserta={peserta} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function EditModal({ peserta, onClose }: { peserta: Peserta; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    status_badge:      peserta.status_badge ?? 'PENDING',
    no_badge:          peserta.no_badge ?? '',
    no_erp:            peserta.no_erp ?? '',
    jabatan_deskripsi: peserta.jabatan_deskripsi ?? '',
    leader:            peserta.leader ?? '',
    tanggal_induction: peserta.tanggal_induction ?? '',
    due_date:          peserta.due_date ?? '',
    ktp:               peserta.ktp ?? false,
    sks:               peserta.sks ?? false,
    sertifikat:        peserta.sertifikat ?? false,
    remarks:           peserta.remarks ?? '',
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePeserta(peserta.id, {
          status_badge:      form.status_badge,
          no_badge:          form.no_badge || null,
          no_erp:            form.no_erp || null,
          jabatan_deskripsi: form.jabatan_deskripsi || null,
          leader:            form.leader || null,
          tanggal_induction: form.tanggal_induction || null,
          due_date:          form.due_date || null,
          ktp:               form.ktp,
          sks:               form.sks,
          sertifikat:        form.sertifikat,
          remarks:           form.remarks || null,
        });
        setSuccess(true);
        setTimeout(() => onClose(), 800);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Gagal menyimpan');
      }
    });
  }

  const STATUS_OPTIONS = ['ACTIVE', 'PENDING', 'RETURNED'];
  const STATUS_COLOR: Record<string, string> = {
    ACTIVE:   'text-emerald-700 bg-emerald-50 border-emerald-300',
    PENDING:  'text-amber-700   bg-amber-50   border-amber-300',
    RETURNED: 'text-slate-600   bg-slate-100  border-slate-300',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Edit Peserta</p>
            <p className="mt-0.5 text-base font-bold text-slate-800">{peserta.nama}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Status Badge */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Status Badge
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('status_badge', s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                    form.status_badge === s
                      ? STATUS_COLOR[s] + ' ring-2 ring-offset-1 ring-brand-400'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* No Badge + No ERP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">No Badge</label>
              <input
                type="text"
                value={form.no_badge}
                onChange={(e) => set('no_badge', e.target.value)}
                placeholder="mis. 253"
                className="input w-full font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">No ERP</label>
              <input
                type="text"
                value={form.no_erp}
                onChange={(e) => set('no_erp', e.target.value)}
                placeholder="mis. 30001"
                className="input w-full font-mono"
              />
            </div>
          </div>

          {/* Jabatan + Leader */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Jabatan</label>
              <input
                type="text"
                value={form.jabatan_deskripsi}
                onChange={(e) => set('jabatan_deskripsi', e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Leader</label>
              <input
                type="text"
                value={form.leader}
                onChange={(e) => set('leader', e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          {/* Tgl Induction + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Tgl Induction</label>
              <input
                type="date"
                value={form.tanggal_induction}
                onChange={(e) => set('tanggal_induction', e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => set('due_date', e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          {/* Dokumen */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Dokumen</label>
            <div className="flex gap-4">
              {(['ktp', 'sks', 'sertifikat'] as const).map((doc) => (
                <label key={doc} className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={form[doc]}
                    onChange={(e) => set(doc, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-sm font-semibold uppercase text-slate-600">{doc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Remarks</label>
            <textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              className="input w-full resize-none"
              placeholder="Catatan tambahan..."
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          {/* Footer */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary flex-1"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending || success}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                success
                  ? 'bg-emerald-500 text-white'
                  : 'btn-primary'
              }`}
            >
              {success ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Tersimpan!
                </>
              ) : isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { catatPengembalian } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";

type Props = {
  peserta: { id: number; nama: string; no_badge: string | null };
  sudahTercatat: string[];
  tarif: Record<string, number>;
};

export function CatatPengembalianButton({ peserta, sudahTercatat, tarif }: Props) {
  const [open, setOpen] = useState(false);
  const semuaTercatat = APD_ITEMS.every((i) => sudahTercatat.includes(i));
  if (semuaTercatat) return <span className="text-xs text-emerald-600">✔ selesai</span>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Catat
      </button>
      {open && <CatatModal {...{ peserta, sudahTercatat, tarif }} onClose={() => setOpen(false)} />}
    </>
  );
}

function CatatModal({ peserta, sudahTercatat, tarif, onClose }: Props & { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [kondisi, setKondisi] = useState<Record<string, string>>({});

  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("peserta_id", String(peserta.id));
    startTransition(async () => {
      const res = await catatPengembalian(fd);
      if (res.error) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-800">Catat Pengembalian</h3>
        <p className="mt-0.5 text-sm text-slate-500">{peserta.nama} — Badge {peserta.no_badge ?? "-"}</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Tanggal</span>
            <input type="date" name="tanggal" defaultValue={today} className="input-field mt-1 w-full" required />
          </label>

          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            {APD_ITEMS.map((item: ApdItem) => {
              const done = sudahTercatat.includes(item);
              const isChecked = checked[item] ?? false;
              const kond = kondisi[item] ?? "KEMBALI";
              return (
                <div key={item} className="flex flex-wrap items-center gap-2 text-sm">
                  <label className={`flex w-32 items-center gap-2 ${done ? "text-slate-300" : "text-slate-700"}`}>
                    <input
                      type="checkbox"
                      name={`item_${item}`}
                      disabled={done}
                      checked={isChecked}
                      onChange={(e) => setChecked({ ...checked, [item]: e.target.checked })}
                    />
                    {APD_LABELS[item]}
                  </label>
                  {done && (
                    <span className="text-xs text-emerald-600">
                      sudah tercatat ·{" "}
                      <Link href={`/pengembalian/${peserta.id}`} className="underline hover:text-emerald-700">
                        edit di riwayat
                      </Link>
                    </span>
                  )}
                  {!done && isChecked && (
                    <>
                      <select
                        name={`kondisi_${item}`}
                        value={kond}
                        onChange={(e) => setKondisi({ ...kondisi, [item]: e.target.value })}
                        className="input-field text-xs"
                      >
                        {KONDISI_ITEM.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      {(kond === "HILANG" || kond === "RUSAK") && (
                        <input
                          type="number"
                          name={`potongan_${item}`}
                          min={0}
                          step={1000}
                          defaultValue={kond === "HILANG" ? (tarif[item] ?? 0) : 0}
                          key={`${item}-${kond}`}
                          className="input-field w-28 text-xs"
                          title="Potongan (Rp)"
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">Catatan</span>
            <textarea name="catatan" rows={2} className="input-field mt-1 w-full" />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">Batal</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

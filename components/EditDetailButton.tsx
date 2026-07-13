"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePengembalianDetail } from "@/app/(app)/pengembalian/actions";
import { KONDISI_ITEM, APD_LABELS, type ApdItem } from "@/lib/constants";

type Props = {
  detailId: number;
  pesertaId: number;
  item: ApdItem;
  kondisiAwal: string;
  potonganAwal: number;
  tarif: Record<string, number>;
};

export function EditDetailButton({ detailId, pesertaId, item, kondisiAwal, potonganAwal, tarif }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kondisi, setKondisi] = useState(kondisiAwal);
  const [potongan, setPotongan] = useState(potonganAwal);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("detail_id", String(detailId));
    fd.set("peserta_id", String(pesertaId));
    fd.set("item", item);
    fd.set("kondisi", kondisi);
    fd.set("potongan", String(potongan));
    startTransition(async () => {
      const res = await updatePengembalianDetail(fd);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 hover:underline">
        Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800">Edit {APD_LABELS[item]}</h3>
            <form onSubmit={onSubmit} className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">Kondisi</span>
                <select
                  value={kondisi}
                  onChange={(e) => {
                    const v = e.target.value;
                    setKondisi(v);
                    if (v === "HILANG") setPotongan(tarif[item] ?? 0);
                    if (v === "KEMBALI") setPotongan(0);
                  }}
                  className="input-field mt-1 w-full"
                >
                  {KONDISI_ITEM.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>
              {(kondisi === "HILANG" || kondisi === "RUSAK") && (
                <label className="block text-sm">
                  <span className="text-slate-600">Potongan (Rp)</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={potongan}
                    onChange={(e) => setPotongan(Number(e.target.value))}
                    className="input-field mt-1 w-full tabular-nums"
                  />
                </label>
              )}
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                  Batal
                </button>
                <button type="submit" disabled={isPending} className="btn-primary text-sm">
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

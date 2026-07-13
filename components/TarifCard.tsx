"use client";

import { useState, useTransition } from "react";
import { updateTarif } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS } from "@/lib/constants";

export function TarifCard({ tarif }: { tarif: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateTarif(fd);
      setMsg(res.error ?? "Tarif tersimpan.");
    });
  }

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-700">
        <span>Tarif Potongan (item HILANG)</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={onSubmit} className="mt-3 space-y-2">
          {APD_ITEMS.map((item) => (
            <label key={item} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">{APD_LABELS[item]}</span>
              <input
                name={`tarif_${item}`}
                type="number"
                min={0}
                step={1000}
                defaultValue={tarif[item] ?? 0}
                className="input-field w-36 text-right"
              />
            </label>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={isPending} className="btn-primary text-sm">
              {isPending ? "Menyimpan..." : "Simpan Tarif"}
            </button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

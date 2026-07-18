"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hapusCpsRefund } from "@/app/(app)/deposit/actions";

const ADMIN_PIN = "242424";

export function HapusCpsRefundButton({ id }: { id: number }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function doDelete() {
    if (pin !== ADMIN_PIN) { setErr("PIN salah."); return; }
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      const res = await hapusCpsRefund(fd);
      if (res.error) setErr(res.error);
      else { setAsk(false); router.refresh(); }
    });
  }

  if (!ask) {
    return <button onClick={() => { setAsk(true); setPin(""); setErr(null); }} className="text-xs text-red-500 hover:underline">Hapus</button>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN admin" className="input-field w-24 text-xs" />
      <button onClick={doDelete} disabled={isPending} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">OK</button>
      <button onClick={() => setAsk(false)} className="text-xs text-slate-400">batal</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}

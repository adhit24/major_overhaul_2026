const KONDISI_STYLES: Record<string, string> = {
  KEMBALI: "bg-emerald-50 text-emerald-700",
  RUSAK: "bg-amber-50 text-amber-700",
  HILANG: "bg-red-50 text-red-700",
};

export function KondisiBadge({ kondisi }: { kondisi: string }) {
  return (
    <span className={`badge-pill ${KONDISI_STYLES[kondisi] ?? "bg-slate-100 text-slate-600"}`}>
      {kondisi}
    </span>
  );
}

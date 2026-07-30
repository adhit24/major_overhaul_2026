const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  RETURNED: "bg-slate-100 text-slate-600",
  HANGUS: "bg-red-50 text-red-700",
  DONE: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
};

const DOT_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  PENDING: "bg-amber-500",
  RETURNED: "bg-slate-400",
  HANGUS: "bg-red-500",
  DONE: "bg-emerald-500",
  PARTIAL: "bg-amber-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge-pill gap-1.5 ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status] ?? "bg-slate-400"}`} aria-hidden="true" />
      {status}
    </span>
  );
}

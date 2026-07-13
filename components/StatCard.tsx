import Link from "next/link";

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  href,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "danger" | "success";
  hint?: string;
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    default: "text-slate-900",
    warning: "text-amber-600",
    danger: "text-red-600",
    success: "text-emerald-600",
  };
  const ringClasses: Record<string, string> = {
    default: "hover:ring-slate-200",
    warning: "hover:ring-amber-200",
    danger: "hover:ring-red-200",
    success: "hover:ring-emerald-200",
  };

  const content = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 break-words text-xl font-semibold leading-tight tabular-nums sm:text-2xl ${toneClasses[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`card block transition hover:ring-1 ${ringClasses[tone]}`}>
        {content}
      </Link>
    );
  }

  return <div className="card">{content}</div>;
}

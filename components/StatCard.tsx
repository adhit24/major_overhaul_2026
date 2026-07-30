"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
  href,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "danger" | "success";
  hint?: string;
  href?: string;
  icon?: ReactNode;
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
  const iconToneClasses: Record<string, string> = {
    default: "bg-slate-100 text-slate-500",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
    success: "bg-emerald-50 text-emerald-600",
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconToneClasses[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 break-words text-xl font-semibold leading-tight tabular-nums sm:text-2xl ${toneClasses[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <motion.div variants={itemVariants} className="h-full">
        <Link href={href} className={`card block h-full transition hover:ring-1 ${ringClasses[tone]}`}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} className="card">
      {content}
    </motion.div>
  );
}

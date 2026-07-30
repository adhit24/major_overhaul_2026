"use client";

import { useEffect, useState } from "react";
import { logout } from "@/app/(app)/actions";
import { CommandPalette } from "./CommandPalette";
import { SubmitButton } from "./SubmitButton";

export function TopBar({ title, email }: { title: string; email?: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5 transition-shadow sm:px-6 ${
        scrolled ? "shadow-sm" : "shadow-none"
      }`}
    >
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <CommandPalette />
        {email ? <span className="hidden text-sm text-slate-400 md:inline">{email}</span> : null}
        <form action={logout}>
          <SubmitButton className="btn-secondary text-xs" pendingText="Keluar...">
            Keluar
          </SubmitButton>
        </form>
      </div>
    </header>
  );
}

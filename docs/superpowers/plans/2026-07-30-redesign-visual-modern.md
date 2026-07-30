# Redesign Visual Modern — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the industrial-slate + brand-green design system (from
`docs/superpowers/specs/2026-07-30-redesign-visual-modern-design.md`) across
the app: recolor tokens, restyle shared components, add purposeful Motion
animation, and lightly rebrand the print pages — with zero changes to data,
routes, or business logic.

**Architecture:** Token-cascade approach. Recoloring the Tailwind `brand`
palette and the shared `globals.css` utility classes (`.card`, `.btn-primary`,
etc.) automatically restyles every page that already consumes them — no
per-page rewrites needed for Dashboard, Peserta, Deposit, Manpower, or
Pengembalian. Remaining tasks touch only the handful of components/pages that
need bespoke work: `StatusBadge`, `StatCard`, `Sidebar`, `BottomNav`, two
modals, and the four print pages.

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS 3 +
`framer-motion` 12 (already a dependency) + Supabase.

## Global Constraints

- No automated test suite exists in this repo (`package.json` has no `test`
  script). Every task's verification step is: `npx tsc --noEmit` (type
  check), `npm run build` (production build, runs Next's build-time ESLint
  too), and a manual check via `npm run dev` in the browser as described in
  the task. Do not add a test framework — out of scope.
- New `brand` color scale (replaces the old blue scale in
  `tailwind.config.ts`, same key so all existing `brand-*` classnames keep
  working unchanged): `50 #ecfdf5`, `100 #d1fae5`, `200 #a7f3d0`,
  `300 #6ee7b7`, `400 #34d399`, `500 #10b981`, `600 #059669`, `700 #047857`,
  `800 #065f46`, `900 #064e3b`.
- Font variable is renamed from `--font-inter` to `--font-sans` (Task 1) —
  every later task that touches typography assumes this name already exists.
- `app/login/**` is explicitly OUT OF SCOPE — do not modify any file under
  it. It already meets the design bar and uses its own `orange-*` palette
  unrelated to `brand-*`.
- No changes to Supabase queries, Server Actions, calculation logic, schema,
  or routes in any task. Every task is presentational/interaction-only.
- Touch targets stay ≥44px (already correct in `.btn-primary`/`.btn-secondary`
  /`.btn-ghost` via `min-h-[44px]`) — do not shrink them.
- Button/link tap feedback stays CSS `active:scale-[0.98]` (unchanged) — do
  NOT migrate `.btn-primary`/`.btn-secondary`/`.btn-ghost` usages to Motion
  `whileTap`. This was in the original design spec but was scoped out: those
  classes are used on plain `<button>`/`<Link>` elements across ~15 Server
  Component files, and converting all of them to Motion would mean making
  all of them Client Components for a marginal gain over the existing CSS,
  which already satisfies `ui-ux-pro-max`'s press-feedback guideline. See
  the spec's "Revisi dari draf awal" note under section 3.
- Any new Motion animation must respect `prefers-reduced-motion` implicitly
  by only animating `transform`/`opacity` (never `width`/`height`/`top`/
  `left`), matching the existing codebase's animated components
  (`CommandPalette.tsx`, `app/login/LoginCard.tsx`).
- Windows/PowerShell environment — verification commands below use npm
  scripts (e.g. `npm run build`), which work the same on Windows.

---

### Task 1: Design tokens — recolor brand palette + swap font to Plus Jakarta Sans

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: Tailwind `brand-{50..900}` green scale (values in Global
  Constraints) and CSS variable `--font-sans` (Plus Jakarta Sans), both
  consumed implicitly by every other task and every existing page that
  already uses `brand-*` classes or `font-sans`.

- [ ] **Step 1: Replace the brand color scale and font family in `tailwind.config.ts`**

Replace the entire file content with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Swap the Google Font import in `app/layout.tsx`**

Replace the entire file content with:

```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PT KOIN | Induction & Badge Control",
  description: "Sistem input data induction, badge, dan deposit kartu PT KOIN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${plusJakartaSans.variable} font-sans`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

Then run `npm run dev`, open `http://localhost:3000/dashboard` (log in
first), and confirm: all previously-blue elements (active sidebar item,
primary buttons, links) now render green, and body text uses Plus Jakarta
Sans (visibly different letterforms from the old Inter — check via browser
devtools "Computed" font-family if unsure).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/layout.tsx
git commit -m "Recolor brand palette to green and switch font to Plus Jakarta Sans"
```

---

### Task 2: Restyle shared utility classes in `globals.css`

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `brand-600`/`brand-700` from Task 1 (already referenced, values
  just changed).
- Produces: updated `.input-field`, `.btn-primary`, `.btn-secondary`,
  `.btn-ghost`, `.card`, `.data-card` radii, consumed by every page in the
  app automatically.

- [ ] **Step 1: Bump radius on form/button/data-card classes and the card class, in `app/globals.css`**

Replace this block (inside `@layer components`, the six rules from
`.input-field` through `.data-card`):

```css
  .input-field {
    @apply w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:py-2;
  }
  .label-field {
    @apply mb-1 block text-sm font-medium text-slate-700;
  }
  .btn-primary {
    @apply inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .btn-secondary {
    @apply inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-[0.98] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .btn-ghost {
    @apply inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition active:scale-[0.98] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .card {
    @apply rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5;
  }
  .badge-pill {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
  }
  /* Kartu ringkas dipakai untuk tampilan mobile pengganti baris tabel yang lebar */
  .data-card {
    @apply rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition active:bg-slate-50;
  }
```

with:

```css
  .input-field {
    @apply w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:py-2;
  }
  .label-field {
    @apply mb-1 block text-sm font-medium text-slate-700;
  }
  .btn-primary {
    @apply inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .btn-secondary {
    @apply inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-[0.98] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .btn-ghost {
    @apply inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition active:scale-[0.98] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 sm:min-h-0;
  }
  .card {
    @apply rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5;
  }
  .badge-pill {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
  }
  /* Kartu ringkas dipakai untuk tampilan mobile pengganti baris tabel yang lebar */
  .data-card {
    @apply rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:bg-slate-50;
  }
```

(Leave `.scroll-fade` and everything in `@layer base` untouched.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open `/peserta`: cards, buttons, and inputs should show
visibly rounder corners than before (`rounded-2xl`/`rounded-xl` vs the old
`rounded-lg`/`rounded-xl`), with no layout breakage.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Soften shared UI radii for a more modern look"
```

---

### Task 3: StatusBadge — add a non-color status indicator

**Files:**
- Modify: `components/StatusBadge.tsx`

- [ ] **Step 1: Replace `components/StatusBadge.tsx` in full**

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open `/peserta`: every status pill should show a small
solid dot before the text, colored to match its tone (green/amber/slate/red).

- [ ] **Step 3: Commit**

```bash
git add components/StatusBadge.tsx
git commit -m "Add non-color status indicator dot to StatusBadge"
```

---

### Task 4: StatCard icon slot + entrance animation on the Dashboard

**Files:**
- Create: `components/MotionStagger.tsx`
- Modify: `components/StatCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Produces: `MotionStagger({ children, className }: { children: ReactNode;
  className?: string })` — generic client wrapper that fades/slides its
  direct children in with a staggered delay. `StatCard` gains an optional
  `icon?: ReactNode` prop and becomes a Motion item that must be a descendant
  of a `MotionStagger` (or any Motion component with `variants`/`animate`)
  to receive its entrance animation — rendered standalone it just appears
  with no animation (safe default, no crash).

- [ ] **Step 1: Create `components/MotionStagger.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

export function MotionStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Replace `components/StatCard.tsx` in full**

```tsx
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
      <motion.div variants={itemVariants}>
        <Link href={href} className={`card block transition hover:ring-1 ${ringClasses[tone]}`}>
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
```

- [ ] **Step 3: Wire `MotionStagger` and icons into `app/(app)/dashboard/page.tsx`**

Replace the import block:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
```

with:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MotionStagger } from "@/components/MotionStagger";

function IconCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M6 15h5M14 9h4M14 13h4" />
    </svg>
  );
}

function IconCheckBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
```

Then replace the stat card grid:

```tsx
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Kartu Diajukan" value={totalKartu} hint="batch DONE" />
          <StatCard label="Sudah Ada Badge" value={totalBadgeValid} tone="success" />
          <StatCard
            label="ID Badge Sudah Kembali"
            value={nKartuKembali}
            tone="success"
            hint="Kartu fisik sudah kembali"
            href="/pengembalian"
          />
          <StatCard
            label="ID Badge Tersisa"
            value={nKartuTersisa}
            tone={nKartuTersisa ? "warning" : "default"}
            hint="Belum tercatat kembali"
            href="/pengembalian"
          />
          <StatCard label="Total Deposit Tercatat" value={formatRupiah(totalDeposit)} hint={`${doneBatches.length} batch DONE`} />
          <StatCard
            label="Nominal Sisa Pengembalian"
            value={formatRupiah(nominalSisaPengembalian)}
            tone={nominalSisaPengembalian > 0 ? "warning" : "default"}
            hint={`${nKartuTersisa} ID badge tersisa`}
            href="/deposit"
          />
        </div>
```

with:

```tsx
        <MotionStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Kartu Diajukan" value={totalKartu} hint="batch DONE" icon={<IconCard />} />
          <StatCard label="Sudah Ada Badge" value={totalBadgeValid} tone="success" icon={<IconCheckBadge />} />
          <StatCard
            label="ID Badge Sudah Kembali"
            value={nKartuKembali}
            tone="success"
            hint="Kartu fisik sudah kembali"
            href="/pengembalian"
            icon={<IconCheckBadge />}
          />
          <StatCard
            label="ID Badge Tersisa"
            value={nKartuTersisa}
            tone={nKartuTersisa ? "warning" : "default"}
            hint="Belum tercatat kembali"
            href="/pengembalian"
            icon={<IconWarning />}
          />
          <StatCard label="Total Deposit Tercatat" value={formatRupiah(totalDeposit)} hint={`${doneBatches.length} batch DONE`} icon={<IconMoney />} />
          <StatCard
            label="Nominal Sisa Pengembalian"
            value={formatRupiah(nominalSisaPengembalian)}
            tone={nominalSisaPengembalian > 0 ? "warning" : "default"}
            hint={`${nKartuTersisa} ID badge tersisa`}
            href="/deposit"
            icon={<IconWarning />}
          />
        </MotionStagger>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed (StatCard and MotionStagger are Client Components
rendered from the Server Component dashboard page — this is a supported
Next.js pattern, but confirm the build doesn't flag it).

Run `npm run dev`, open `/dashboard`: each stat card should show a small
icon top-right, and on page load the six cards should fade/slide up in a
quick left-to-right, top-to-bottom stagger (not all at once). Reload a few
times to confirm it's consistent. Also open `/manpower` and `/deposit`
(other pages that render bare `StatCard`s without `MotionStagger`, e.g. via
`TarifCard`/`ManpowerCards` if applicable) and confirm they still render
correctly with no console errors (no animation expected there — only
`/dashboard` was wired to `MotionStagger` in this task).

- [ ] **Step 5: Commit**

```bash
git add components/MotionStagger.tsx components/StatCard.tsx "app/(app)/dashboard/page.tsx"
git commit -m "Add icon slot and staggered entrance animation to dashboard StatCards"
```

---

### Task 5: Sidebar — animated active-item pill

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add the Motion import**

Replace:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
```

with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
```

- [ ] **Step 2: Replace the nav item rendering**

Replace:

```tsx
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={active ? "text-brand-600" : "text-slate-400"} aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
```

with:

```tsx
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-lg bg-brand-50"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${active ? "text-brand-600" : "text-slate-400"}`} aria-hidden>
                {item.icon}
              </span>
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev` on a desktop-width window (sidebar only shows at `sm:` and
up), click through Dashboard → Database Peserta → Manpower Divisi → Summary
Deposit: the green active-item background should visibly slide/morph from
the old item's position to the new one instead of instantly jumping.

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "Animate Sidebar active-item indicator with a shared layout pill"
```

---

### Task 6: BottomNav — animated active-item pill (mobile)

**Files:**
- Modify: `components/BottomNav.tsx`

- [ ] **Step 1: Add the Motion import**

Replace:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
```

with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
```

- [ ] **Step 2: Replace the nav item rendering**

Replace:

```tsx
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active
                  ? 'text-brand-600 bg-brand-50/60'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={active ? 'text-brand-600' : 'text-slate-400'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
```

with:

```tsx
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="bottomnav-active-pill"
                  className="absolute inset-x-2 inset-y-1.5 rounded-lg bg-brand-50/60"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${active ? 'text-brand-600' : 'text-slate-400'}`}>
                {item.icon}
              </span>
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open devtools responsive mode at a mobile width (<640px,
where `BottomNav` shows instead of `Sidebar`), tap through the bottom nav
items: the green pill background should slide between tabs.

- [ ] **Step 4: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "Animate BottomNav active-item indicator with a shared layout pill"
```

---

### Task 7: Modal primitive + AnimatePresence for EditPesertaModal and CatatPengembalianModal

**Files:**
- Create: `components/Modal.tsx`
- Modify: `components/EditPesertaModal.tsx`
- Modify: `components/CatatPengembalianModal.tsx`

**Interfaces:**
- Produces: `Modal({ open, onClose, children, maxWidthClassName? }: { open:
  boolean; onClose: () => void; children: ReactNode; maxWidthClassName?:
  string })` — always-mounted wrapper; internally uses `AnimatePresence` so
  it only renders (and animates in/out) its backdrop+panel while `open` is
  true. Default `maxWidthClassName` is `"max-w-md"`.
- Important behavior change: because `Modal` is always mounted (required for
  exit animations to play), the two modals below can no longer rely on
  mount/unmount to reset their internal form state between opens. Each gets
  a `useEffect` keyed on `open` that resets its state when `open` becomes
  `true`, preserving the original "always starts fresh" behavior.

- [ ] **Step 1: Create `components/Modal.tsx`**

```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", mass: 0.7, damping: 22, stiffness: 260 }}
            className={`relative flex max-h-[90dvh] w-full flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 ${maxWidthClassName}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Refactor `components/EditPesertaModal.tsx` to use `Modal`**

Replace the import line:

```tsx
import { useState, useTransition, useRef } from 'react';
import { updatePeserta, deletePeserta } from '@/app/(app)/actions';
```

with:

```tsx
import { useEffect, useState, useTransition, useRef } from 'react';
import { updatePeserta, deletePeserta } from '@/app/(app)/actions';
import { Modal } from '@/components/Modal';
```

Replace the `EditPesertaButton` function body:

```tsx
export function EditPesertaButton({ peserta }: { peserta: Peserta }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
        title="Edit data"
        aria-label="Edit data"
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
```

with:

```tsx
export function EditPesertaButton({ peserta }: { peserta: Peserta }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-600 transition-colors"
        title="Edit data"
        aria-label="Edit data"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
        </svg>
      </button>
      <EditModal peserta={peserta} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

Replace the `EditModal` signature and add a reset effect — replace:

```tsx
function EditModal({ peserta, onClose }: { peserta: Peserta; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // PIN delete flow
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted]   = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
```

with:

```tsx
function EditModal({ peserta, open, onClose }: { peserta: Peserta; open: boolean; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // PIN delete flow
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted]   = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
```

(signature line changed only — body of these declarations is untouched).

Next, find the `const [form, setForm] = useState({...})` block that follows
and add a reset effect immediately after it — replace:

```tsx
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
```

with:

```tsx
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

  // Modal is now always mounted (Modal uses AnimatePresence for exit
  // animation), so state no longer resets via unmount — reset explicitly
  // whenever the modal transitions to open, matching the old behavior.
  useEffect(() => {
    if (open) {
      setForm({
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
      setError(null);
      setSuccess(false);
      setShowPinPrompt(false);
      setPin('');
      setPinError('');
      setDeleting(false);
      setDeleted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, peserta.id]);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }
```

Finally, replace the outer wrapper markup — replace:

```tsx
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
```

with:

```tsx
  return (
    <Modal open={open} onClose={onClose}>
```

and replace the matching closing tags at the very end of the component —
replace:

```tsx
      </div>
    </div>
  );
}
```

with:

```tsx
    </Modal>
  );
}
```

(Everything between the header `<div className="flex shrink-0 items-start ...">` and this closing tag — the header, the form, and the PIN overlay — stays exactly as-is; only the two outermost wrapper `<div>`s at the start and their matching closes at the end are swapped for `<Modal>`/`</Modal>`.)

- [ ] **Step 3: Refactor `components/CatatPengembalianModal.tsx` to use `Modal`**

Replace the import block:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { catatPengembalian } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";
```

with:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { catatPengembalian } from "@/app/(app)/pengembalian/actions";
import { APD_ITEMS, APD_LABELS, KONDISI_ITEM, type ApdItem } from "@/lib/constants";
import { Modal } from "@/components/Modal";
```

Replace the `CatatPengembalianButton` function body:

```tsx
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
```

with:

```tsx
export function CatatPengembalianButton({ peserta, sudahTercatat, tarif }: Props) {
  const [open, setOpen] = useState(false);
  const semuaTercatat = APD_ITEMS.every((i) => sudahTercatat.includes(i));
  if (semuaTercatat) return <span className="text-xs text-emerald-600">✔ selesai</span>;
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
        Catat
      </button>
      <CatatModal {...{ peserta, sudahTercatat, tarif }} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

Replace the `CatatModal` function in full:

```tsx
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
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-800">Catat Pengembalian</h3>
        <p className="mt-0.5 text-sm text-slate-500">{peserta.nama} — Badge {peserta.no_badge ?? "-"}</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
```

with:

```tsx
function CatatModal({ peserta, sudahTercatat, tarif, open, onClose }: Props & { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [kondisi, setKondisi] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setError(null);
      setChecked({});
      setKondisi({});
    }
  }, [open]);

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
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="overflow-y-auto p-6">
        <h3 className="text-base font-bold text-slate-800">Catat Pengembalian</h3>
        <p className="mt-0.5 text-sm text-slate-500">{peserta.nama} — Badge {peserta.no_badge ?? "-"}</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
```

Then replace the matching closing tags at the very end of the file — replace:

```tsx
        </form>
      </div>
    </div>
  );
}
```

with:

```tsx
        </form>
      </div>
    </Modal>
  );
}
```

(The form's contents in between — the tanggal input, the APD items block,
the catatan textarea, error display, and footer buttons — stay exactly
as-is.)

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`:
1. Open `/peserta`, click the edit icon on any row: the modal should
   fade/scale in. Make a change, click "Batal" (or click the backdrop): the
   modal should fade/scale out (not just disappear instantly). Reopen it on
   the same row: fields should show the current data again, not the edit
   you cancelled.
2. Open a peserta's `/pengembalian/[id]` detail page, click "Catat" on an
   APD item: the modal should animate in the same way, and reopening after
   cancelling should show an empty/reset form.
3. Confirm the PIN-delete overlay inside `EditPesertaModal` still works
   (wrong PIN shows an error, correct PIN deletes and shows the checkmark
   state) — this logic was not touched, only the outer wrapper.

- [ ] **Step 5: Commit**

```bash
git add components/Modal.tsx components/EditPesertaModal.tsx components/CatatPengembalianModal.tsx
git commit -m "Add reusable animated Modal and wire it into peserta/pengembalian modals"
```

---

### Task 8: Print pages — swap slate-800 accents for brand green

**Files:**
- Modify: `app/(app)/pengembalian/cetak/kembali/page.tsx`
- Modify: `app/(app)/pengembalian/cetak/kehilangan/page.tsx`
- Modify: `app/(app)/deposit/cetak/cps-refund/page.tsx`
- Modify: `app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx`

**Interfaces:**
- Consumes: `brand-700` (`#047857`) from Task 1.

All four files use the literal Tailwind class fragment `slate-800`
exclusively for accent purposes (section header bars, active-tab
background, header/footer rule lines) — never for body text or neutral
borders. Replace every occurrence of the substring `slate-800` with
`brand-700` in each of the four files (a plain find-and-replace of that
exact substring across the whole file is safe and sufficient — do not touch
any other `slate-*` shade).

- [ ] **Step 1: Replace `slate-800` → `brand-700` in `app/(app)/pengembalian/cetak/kembali/page.tsx`**

Occurrences to update (8 total, all `className` fragments): the active-tab
background (`bg-slate-800 text-white`, appears twice), the header border
(`border-b-2 border-slate-800`), the section header background
(`bg-slate-800 px-2 py-1.5 ...`), and three `border-slate-800` totals
rules. Replace all 8.

- [ ] **Step 2: Replace `slate-800` → `brand-700` in `app/(app)/pengembalian/cetak/kehilangan/page.tsx`**

Same pattern, 7 occurrences (this file has one fewer totals rule than
`kembali/page.tsx`). Replace all 7.

- [ ] **Step 3: Replace `slate-800` → `brand-700` in `app/(app)/deposit/cetak/cps-refund/page.tsx`**

Same pattern, 7 occurrences (header border, section header, two totals
rules, three signature-line `border-t border-slate-800`). Replace all 7.

- [ ] **Step 4: Replace `slate-800` → `brand-700` in `app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx`**

One occurrence: the header border (`border-b-2 border-slate-800`). Replace
it.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open each of the four print pages listed above (via a
real batch/peserta id from your dev data, or by navigating from the
Pengembalian/Deposit UI): confirm the section headers, active-tab pills,
and rule lines now render in dark green instead of near-black, everything
else (fonts, borders, table layout) is unchanged, and the browser print
preview (Ctrl+P) still fits one A4 page-width with no layout shift.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/pengembalian/cetak/kembali/page.tsx" "app/(app)/pengembalian/cetak/kehilangan/page.tsx" "app/(app)/deposit/cetak/cps-refund/page.tsx" "app/(app)/pengembalian/[pesertaId]/bukti/[pengembalianId]/page.tsx"
git commit -m "Rebrand print page accents from slate to brand green"
```

---

### Task 9: TopBar — scroll elevation and color retint

**Files:**
- Modify: `components/TopBar.tsx`

`TopBar` currently uses only neutral `slate-*` colors (no `brand-*`), so
Task 1's token change already "retints" it with no code change needed. The
one piece of spec coverage still missing is "elevasi halus saat halaman
discroll" (subtle elevation as the page scrolls) — `TopBar` isn't currently
sticky, so this task makes it stick to the top of its scroll container and
gain a shadow once the page has scrolled past the top, which is the only
way "elevation on scroll" is visually meaningful. The app shell
(`app/(app)/layout.tsx`) has no inner scroll container, so the page scrolls
on `window` — confirmed by reading that file.

- [ ] **Step 1: Replace `components/TopBar.tsx` in full**

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, open `/peserta` (a page with enough rows to scroll) on a
wide viewport: the header should stay pinned at the top while the list
scrolls beneath it, and gain a subtle shadow once scrolled down (shadow
disappears again at the very top). Also confirm the print pages (Task 8)
still look correct — they don't use `TopBar`, so this task doesn't touch
them.

- [ ] **Step 3: Commit**

```bash
git add components/TopBar.tsx
git commit -m "Make TopBar sticky with a subtle shadow on scroll"
```

---

### Task 10: Entrance-only page transition on route change

**Files:**
- Create: `components/PageTransition.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Produces: `PageTransition({ children }: { children: ReactNode })` — client
  wrapper that replays a fade+slide-up entrance whenever `usePathname()`
  changes. Deliberately entrance-only (no `AnimatePresence`/exit animation)
  — see the spec's "Revisi dari draf awal" note under section 5 for why a
  full exit+enter transition was rejected for this app's Server Component
  pages.

- [ ] **Step 1: Create `components/PageTransition.tsx`**

```tsx
"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 2: Wire it into the app shell**

Replace the content of `app/(app)/layout.tsx`:

```tsx
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <IdleLogout />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 sm:pb-0">{children}</div>
      <BottomNav />
    </div>
  );
}
```

with:

```tsx
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { IdleLogout } from "@/components/IdleLogout";
import { PageTransition } from "@/components/PageTransition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <IdleLogout />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-16 sm:pb-0">
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

Run `npm run dev`, click between Dashboard, Database Peserta, Manpower
Divisi, Summary Deposit, Pengembalian in the sidebar: each page's content
(including its `TopBar`, since `TopBar` is rendered inside each page, which
is inside `PageTransition`) should fade+slide up briefly on arrival. Then,
on `/peserta`, type into the search box and submit the filter form (a
same-route navigation with only the query string changing): confirm the
page does NOT replay the fade (only the filtered rows update) — this
confirms the `pathname`-only key is working as intended.

- [ ] **Step 4: Commit**

```bash
git add components/PageTransition.tsx "app/(app)/layout.tsx"
git commit -m "Add entrance-only page transition animation on route change"
```

---

### Task 11: Final verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type check, lint, and production build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three succeed with zero errors/warnings introduced by this
redesign (pre-existing warnings, if any, are not this plan's concern).

- [ ] **Step 2: Manual walkthrough with `npm run dev`**

Log in (Login page is unchanged, still works as before) and check every
item:
- Dashboard: green stat-card accents, icons visible, staggered entrance on
  load, sidebar active pill slides on navigation.
- Database Peserta: status badges show a dot, table/cards show new radii,
  edit modal opens/closes with animation and resets between opens.
- Manpower Divisi, Summary Deposit: cards/tables show new colors/radii, no
  visual regressions.
- Pengembalian: "Catat Pengembalian" modal opens/closes with animation and
  resets between opens; the 4 print pages show green accents.
- Resize to mobile width: BottomNav shows instead of Sidebar, its active
  pill slides between tabs; data-cards (not tables) render with new radii.
- TopBar stays pinned while scrolling a long list and gains a subtle shadow
  once scrolled (Task 9).
- Navigating between sidebar links replays the page fade-in; filtering on
  the same page (e.g. `/peserta?q=...`) does not (Task 10).

- [ ] **Step 3: Reduced-motion check**

In Chrome DevTools, open the Command Menu (Ctrl+Shift+P) → "Rendering" tab →
set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Reload
`/dashboard` and open a modal. Confirm nothing breaks (content still
appears/disappears correctly, just without the animated approach being
required to work — Motion still renders the end state).

- [ ] **Step 4: Commit (only if Steps 1–3 required fixes)**

If any issue was found and fixed during this pass:

```bash
git add -A
git commit -m "Fix issues found during redesign verification pass"
```

If no fixes were needed, skip this step — there is nothing to commit.

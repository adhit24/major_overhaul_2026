'use client';

import { motion } from 'framer-motion';

const LOGO_KOIN = 'https://sxqsvogwsucuzdjcoqzf.supabase.co/storage/v1/object/public/assets/logo_koin_transparent.png';
const LOGO_CPS  = 'https://sxqsvogwsucuzdjcoqzf.supabase.co/storage/v1/object/public/assets/logo_cps_transparent.png';

const BG_URL = 'https://sxqsvogwsucuzdjcoqzf.supabase.co/storage/v1/object/public/assets/background_pltu.png';

// Spring config dari ui-ux-pro-max: mass:1 damping:15 stiffness:120
const spring = { type: 'spring', mass: 1, damping: 15, stiffness: 120 } as const;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring, delay },
});

interface Props {
  error?: string;
  loginAction: (formData: FormData) => Promise<void>;
}

export function LoginCard({ error, loginAction }: Props) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
      {/* Background PLTU */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${BG_URL}')` }}
      />
      {/* Overlay: dark + blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content wrapper */}
      <div className="relative z-10 w-full max-w-md">

        {/* ── Logo bar ── */}
        <motion.div
          {...fadeUp(0.05)}
          className="mb-5 flex items-center justify-center gap-5 rounded-2xl
                     bg-white/20 backdrop-blur-xl border border-white/25
                     px-8 py-4 shadow-xl shadow-black/40"
        >
          <img
            src={LOGO_KOIN}
            alt="JO. Koin-One Plant"
            className="h-12 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}
          />
          <div className="h-10 w-px bg-white/30" />
          <img
            src={LOGO_CPS}
            alt="Cirebon Power Services"
            className="h-11 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.4))' }}
          />
        </motion.div>

        {/* ── Project identity ── */}
        <motion.div {...fadeUp(0.15)} className="mb-5 text-center">
          <span className="inline-block rounded-full bg-orange-500/25 px-4 py-1
                           text-[11px] font-bold uppercase tracking-widest
                           text-orange-300 ring-1 ring-orange-400/40">
            Major Overhaul · June – July 2026
          </span>
          <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-white drop-shadow-lg">
            PLTU Cirebon
          </h1>
          <p className="mt-1 text-sm font-medium text-blue-100/80">
            Safety Induction &amp; Badge Control System
          </p>
        </motion.div>

        {/* ── Login card (glassmorphism) ── */}
        <motion.div
          {...fadeUp(0.25)}
          className="rounded-2xl bg-white/10 backdrop-blur-xl
                     border border-white/20 shadow-2xl shadow-black/50
                     px-8 pb-8 pt-7"
        >
          <p className="mb-6 text-center text-[11px] font-semibold uppercase
                        tracking-[0.18em] text-white/50">
            Login Sistem
          </p>

          <form action={loginAction} className="space-y-4">
            {/* Email */}
            <motion.div {...fadeUp(0.32)}>
              <label htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                Email
              </label>
              <input
                id="email" name="email" type="email" required
                autoComplete="email" placeholder="user@ptkoin.com"
                className="w-full rounded-xl border border-white/20 bg-white/10
                           px-4 py-3 text-sm text-white placeholder-white/30
                           backdrop-blur-sm outline-none
                           focus:border-orange-400/70 focus:ring-2 focus:ring-orange-400/30
                           transition-all duration-200"
              />
            </motion.div>

            {/* Password */}
            <motion.div {...fadeUp(0.37)}>
              <label htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/70">
                Password
              </label>
              <input
                id="password" name="password" type="password" required
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/20 bg-white/10
                           px-4 py-3 text-sm text-white placeholder-white/30
                           backdrop-blur-sm outline-none
                           focus:border-orange-400/70 focus:ring-2 focus:ring-orange-400/30
                           transition-all duration-200"
              />
            </motion.div>

            {/* Error */}
            {error ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-2 rounded-xl bg-red-500/20
                           border border-red-400/30 px-3 py-2.5"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-300" fill="none"
                     viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0
                           001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-red-200">{decodeURIComponent(error)}</p>
              </motion.div>
            ) : null}

            {/* Submit button */}
            <motion.div {...fadeUp(0.42)}>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="mt-1 w-full cursor-pointer rounded-xl bg-orange-500
                           py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30
                           hover:bg-orange-600 transition-colors duration-200"
              >
                Masuk
              </motion.button>
            </motion.div>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          {...fadeUp(0.50)}
          className="mt-5 text-center text-xs text-white/40"
        >
          Akun dikelola HSE/HRD Admin · Hubungi admin jika belum punya akun
        </motion.p>
      </div>
    </main>
  );
}

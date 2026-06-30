import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#051225] via-[#0a1f3d] to-[#0d2a52]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 15% 60%, #1a4a8a 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, #0e3a7a 0%, transparent 50%)",
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md space-y-5">
        {/* Logo bar */}
        <div className="flex items-center justify-center gap-5 rounded-2xl bg-white px-6 py-4 shadow-xl shadow-black/30">
          <img
            src="/logos/logo_koin.png"
            alt="JO. Koin-One Plant"
            className="h-10 w-auto object-contain"
          />
          <div className="h-10 w-px bg-slate-200" />
          <img
            src="/logos/logo_cps.png"
            alt="Cirebon Power Services"
            className="h-9 w-auto object-contain"
          />
        </div>

        {/* Project identity */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-orange-500/20 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-300 ring-1 ring-orange-400/30">
            Major Overhaul · June – July 2026
          </span>
          <h1 className="mt-3 text-[26px] font-extrabold tracking-tight text-white">
            PLTU Cirebon
          </h1>
          <p className="mt-1 text-sm font-medium text-blue-200/80">
            Safety Induction &amp; Badge Control System
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl bg-white px-8 pb-8 pt-7 shadow-2xl shadow-black/40">
          <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Login Sistem
          </p>

          <form action={login} className="space-y-4">
            <div>
              <label htmlFor="email" className="label-field">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="user@ptkoin.com"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-field">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input-field"
              />
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <p className="text-sm text-red-700">{decodeURIComponent(error)}</p>
              </div>
            ) : null}

            <button type="submit" className="btn-primary mt-2 w-full py-2.5 text-sm font-semibold">
              Masuk
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-blue-300/60">
          Akun dikelola HSE/HRD Admin &middot; Hubungi admin jika belum punya akun
        </p>
      </div>
    </main>
  );
}

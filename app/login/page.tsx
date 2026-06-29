import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-brand-700 shadow-lg">
            PK
          </div>
          <h1 className="text-xl font-semibold text-white">PT KOIN</h1>
          <p className="text-sm text-brand-100">Induction &amp; Badge Control System</p>
        </div>

        <form action={login} className="card space-y-4">
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
              placeholder="admin@ptkoin.com"
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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Masuk
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-brand-200">
          Akun dibuat oleh admin lewat Supabase Dashboard. Hubungi HSE/HRD jika belum punya akun.
        </p>
      </div>
    </main>
  );
}

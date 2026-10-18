import type { ReactNode } from 'react'

const points = [
  'Login sekali, selanjutnya cukup token',
  'Password tidak pernah disimpan',
  'Mendukung verifikasi 2 langkah (MFA)',
]

/** Split screen on desktop (brand panel + form), logo above the form on mobile. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-[640px] shrink-0 flex-col bg-ink p-16 text-white lg:flex">
        <div className="text-[22px] font-extrabold tracking-tight">Garmin Hub</div>
        <div className="flex flex-1 flex-col justify-center gap-6">
          <h1 className="max-w-[480px] text-[44px] leading-[1.1] font-extrabold tracking-tight">
            Semua data Garmin-mu, dalam satu dashboard.
          </h1>
          <p className="max-w-[480px] text-lg leading-relaxed text-white/70">
            Body Battery, tidur, HRV, dan aktivitas — diambil langsung dari Garmin Connect.
          </p>
          <ul className="space-y-3 pt-2 text-[15px] text-white/90">
            {points.map((p) => (
              <li key={p}>✓&nbsp;&nbsp;{p}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">Garmin Hub tidak berafiliasi dengan Garmin Ltd.</p>
      </aside>
      <main className="flex flex-1 flex-col px-5 pt-[72px] pb-8 lg:items-center lg:justify-center lg:p-10">
        <div className="mb-10 text-[22px] font-extrabold tracking-tight text-ink lg:hidden">Garmin Hub</div>
        <div className="w-full lg:max-w-[400px]">{children}</div>
      </main>
    </div>
  )
}

export function Alert({ tone, children }: { tone: 'info' | 'success' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'bg-accent-soft text-[#0b5e4e]',
    success: 'bg-paper text-ink',
    error: 'bg-[#fdeeee] text-[#a2282d]',
  }[tone]
  return <div className={`rounded-xl px-3.5 py-3 text-[13px] leading-normal ${styles}`}>{children}</div>
}

export function SubmitButton({ loading, disabled, children }: { loading: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full rounded-xl bg-accent p-3.5 text-[15px] font-semibold text-white transition hover:bg-[#0d6f5c] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Menghubungkan…' : children}
    </button>
  )
}

import type { ReactNode } from 'react'
import { api, me, useLoad } from './api'
import { navigate } from './App'
import { Icon, Link, Toaster, type IconName } from './ui'

export const nav: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '/', label: 'Hari ini', short: 'Hari ini', icon: 'today' },
  { to: '/activities', label: 'Aktivitas', short: 'Aktivitas', icon: 'activity' },
  { to: '/sleep', label: 'Tidur & recovery', short: 'Tidur', icon: 'moon' },
  { to: '/body', label: 'Body', short: 'Body', icon: 'body' },
  { to: '/workouts', label: 'Workout', short: 'Workout', icon: 'dumbbell' },
]

const isActive = (to: string, path: string) => (to === '/' ? path === '/' : path.startsWith(to))

async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {})
  navigate('/login')
}

/** Rail on desktop, top bar + tab bar on mobile. Also the auth gate: no connected account → /login. */
export default function Shell({ path, children }: { path: string; children: ReactNode }) {
  const status = useLoad(async () => {
    const s = await me<{ connected: boolean; display_name?: string; full_name?: string }>('/status')
    if (!s.connected) navigate('/login')
    return s
  }, [])
  const name = status.data?.full_name || status.data?.display_name

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white px-3 py-6 lg:flex">
        <Brand className="mb-8 px-3" />
        <nav className="space-y-0.5">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive(n.to, path) ? 'bg-accent-soft font-bold text-accent' : 'text-muted hover:bg-paper hover:text-ink'
              }`}
            >
              <Icon name={n.icon} className="size-[18px]" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent">
            {(name ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name ?? 'Akun Garmin'}</p>
            <p className="text-xs text-battery">Terhubung</p>
          </div>
          <button onClick={logout} title="Keluar" className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink">
            <Icon name="logout" className="size-[18px]" />
            <span className="sr-only">Keluar</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-5 py-3 backdrop-blur lg:hidden">
          <Brand />
          <button onClick={logout} className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Icon name="logout" className="size-4" />
            Keluar
          </button>
        </div>
        <main className="mx-auto max-w-[1180px] space-y-6 px-5 pt-6 pb-28 lg:px-10 lg:pt-9 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={`flex flex-col items-center gap-1 pt-2.5 pb-3 text-[11px] ${isActive(n.to, path) ? 'font-bold text-accent' : 'text-muted'}`}
          >
            <Icon name={n.icon} className="size-5" />
            {n.short}
          </Link>
        ))}
      </nav>
      <Toaster />
    </div>
  )
}

function Brand({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-lg font-extrabold tracking-tight ${className}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-white">
        <Icon name="activity" className="size-4" />
      </span>
      Garmin Hub
    </div>
  )
}

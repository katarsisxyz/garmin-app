import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { navigate } from './App'

/* ---------- icons (24px stroke paths) ---------- */

const paths = {
  today: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  body: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  dumbbell: 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  plus: 'M12 5v14M5 12h14',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  watch: 'M12 9v3l1.5 1.5M7 6l1-4h8l1 4M7 18l1 4h8l1-4M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  back: 'M15 18l-6-6 6-6',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  x: 'M18 6 6 18M6 6l12 12',
  drop: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z',
}
export type IconName = keyof typeof paths

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  )
}

/* ---------- navigation ---------- */

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}

/* ---------- controls ---------- */

const variants = {
  primary: 'bg-accent text-white hover:bg-[#0d6f5c]',
  secondary: 'border border-line bg-white text-ink hover:border-[#c9d1cc]',
  ghost: 'text-muted hover:bg-black/5 hover:text-ink',
  danger: 'bg-heart text-white hover:bg-[#c43a3f]',
}

export function Button({
  variant = 'secondary',
  icon,
  busy,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; icon?: IconName; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl whitespace-nowrap px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {busy ? 'Memproses…' : children}
    </button>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#a3aca7] focus:border-accent focus:ring-3 focus:ring-accent/15'

export const dateClass = inputClass.replace('w-full ', '') + ' w-auto'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

/** A destructive button that asks once more in place instead of a dialog. */
export function ConfirmButton({ label, confirmLabel, onConfirm, compact }: { label: string; confirmLabel: string; onConfirm: () => Promise<unknown>; compact?: boolean }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!asking) {
    return (
      <Button variant="ghost" icon="trash" onClick={() => setAsking(true)} aria-label={label}>
        <span className={compact ? 'sr-only' : 'sr-only sm:not-sr-only'}>{label}</span>
      </Button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        variant="danger"
        busy={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onConfirm()
          } finally {
            setBusy(false)
            setAsking(false)
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Batal
      </Button>
    </span>
  )
}

/* ---------- layout pieces ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="space-y-1">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight lg:text-[32px]">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ title, action, className = '', children }: { title?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 lg:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** A number with its unit; the number is the hero, the label stays quiet. */
export function Stat({ label, value, unit, sub, tone, size = 'md' }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: string; size?: 'md' | 'lg' }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        {tone && <span className="size-1.5 rounded-full" style={{ background: tone }} />}
        {label}
      </p>
      <p className={`font-extrabold tracking-tight ${size === 'lg' ? 'text-4xl' : 'text-[26px]'}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-muted">{unit}</span>}
      </p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-[#e8ece9] ${className}`} />
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#fdeeee] px-4 py-3 text-sm text-[#a2282d]">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline underline-offset-2">
          Coba lagi
        </button>
      )}
    </div>
  )
}

/* ---------- toasts ---------- */

type ToastMsg = { id: number; text: string; tone: 'ok' | 'error' }
let listeners: ((t: ToastMsg) => void)[] = []
let nextId = 1

export function toast(text: string, tone: ToastMsg['tone'] = 'ok') {
  const t = { id: nextId++, text, tone }
  listeners.forEach((l) => l(t))
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    const add = (t: ToastMsg) => {
      setItems((xs) => [...xs, t])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 3500)
    }
    listeners.push(add)
    return () => {
      listeners = listeners.filter((l) => l !== add)
    }
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {items.map((t) => (
        <div key={t.id} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${t.tone === 'ok' ? 'bg-ink' : 'bg-heart'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

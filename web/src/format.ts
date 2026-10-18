// Formatting for Garmin's raw JSON values (metres, seconds, m/s, grams). Missing values render as "–".

const nf = new Intl.NumberFormat('id-ID')
export const DASH = '–'

export const num = (n?: number | null, digits = 0) =>
  n == null || Number.isNaN(n) ? DASH : n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const int = (n?: number | null) => (n == null ? DASH : nf.format(Math.round(n)))

/** Local YYYY-MM-DD (toISOString would shift to UTC). */
export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const today = () => isoDate(new Date())

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`)

export const longDate = (iso: string) =>
  asDate(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const shortDate = (iso: string) => asDate(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

export const weekday = (iso: string) => asDate(iso).toLocaleDateString('id-ID', { weekday: 'short' })

/** "Hari ini", "Kemarin", or "Sen, 13 Okt". */
export function dayLabel(iso?: string | null) {
  if (!iso) return DASH
  const d = iso.slice(0, 10)
  if (d === today()) return 'Hari ini'
  if (d === addDays(today(), -1)) return 'Kemarin'
  return asDate(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "2026-10-16 07:12:00" or epoch ms → "07.12" */
export function timeOf(v?: string | number | null) {
  if (v == null) return DASH
  const d = typeof v === 'number' ? new Date(v) : new Date(v.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? DASH : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/** 25920 → "7j 12m" */
export function hm(sec?: number | null) {
  if (!sec) return DASH
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h}j ${m}m` : `${m}m`
}

/** 1694 → "28:14", 4360 → "1:12:40" */
export function clock(sec?: number | null) {
  if (!sec) return DASH
  const s = Math.round(sec)
  const p = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`
}

export const km = (m?: number | null) => (m ? num(m / 1000, 2) : DASH)

export const kg = (grams?: number | null) => (grams ? num(grams / 1000, 1) : DASH)

const paced = (typeKey = '') => /run|walk|hik/.test(typeKey)

/** Pace for runs and walks (min/km), speed for everything else that moves (km/j). */
export function paceOrSpeed(mps?: number | null, typeKey = ''): [string, string] {
  if (!mps) return [DASH, '']
  if (paced(typeKey)) {
    const s = 1000 / mps
    return [`${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`, '/km']
  }
  return [num(mps * 3.6, 1), 'km/j']
}

const labels: Record<string, string> = {
  BALANCED: 'Seimbang', UNBALANCED: 'Tidak seimbang', LOW: 'Rendah', POOR: 'Buruk',
  PRIME: 'Prima', HIGH: 'Siap', MODERATE: 'Sedang',
  EXCELLENT: 'Sangat baik', GOOD: 'Baik', FAIR: 'Cukup',
}
export const label = (key?: string | null) => (key ? labels[key.toUpperCase()] ?? key : DASH)

/** Garmin stress bands: 0-25 rest, 26-50 low, 51-75 medium, 76-100 high. */
export function stressLabel(v?: number | null) {
  if (v == null || v < 0) return DASH
  return v <= 25 ? 'Istirahat' : v <= 50 ? 'Rendah' : v <= 75 ? 'Sedang' : 'Tinggi'
}

/** Activity type → Indonesian name and a colour. Unknown types keep Garmin's key. */
export function sport(typeKey = '') {
  if (/trail|run/.test(typeKey)) return { name: 'Lari', color: '#e0662d' }
  if (/cycl|bik|ride/.test(typeKey)) return { name: 'Bersepeda', color: '#0a7cd8' }
  if (/swim/.test(typeKey)) return { name: 'Renang', color: '#0aa5b8' }
  if (/walk|hik/.test(typeKey)) return { name: 'Jalan', color: '#2f9e5f' }
  if (/strength/.test(typeKey)) return { name: 'Strength', color: '#6e56cf' }
  if (/yoga|pilates|breath/.test(typeKey)) return { name: 'Yoga', color: '#c2418a' }
  return { name: typeKey ? typeKey.replace(/_/g, ' ') : 'Aktivitas', color: '#6b7570' }
}

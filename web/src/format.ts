// Formatting for Garmin's raw JSON values (metres, seconds, m/s). Missing values render as "–".

const nf = new Intl.NumberFormat('id-ID')
export const DASH = '–'

export const num = (n?: number | null) => (n == null ? DASH : nf.format(Math.round(n)))

/** Local YYYY-MM-DD (toISOString would shift to UTC). */
export function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

export const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short' })

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

export const km = (m?: number | null) =>
  m ? `${(m / 1000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km` : DASH

/** Pace for runs and walks (min/km), speed for everything else that moves (km/j). */
export function paceOrSpeed(mps?: number | null, typeKey = '') {
  if (!mps) return DASH
  if (/run|walk|hik/.test(typeKey)) {
    const s = 1000 / mps
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`
  }
  return `${(mps * 3.6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km/j`
}

const labels: Record<string, string> = {
  // HRV status
  BALANCED: 'Seimbang', UNBALANCED: 'Tidak seimbang', LOW: 'Rendah', POOR: 'Buruk',
  // training readiness level
  PRIME: 'Prima', HIGH: 'Siap', MODERATE: 'Sedang',
  // sleep score qualifier
  EXCELLENT: 'Sangat baik', GOOD: 'Baik', FAIR: 'Cukup',
}
export const label = (key?: string | null) => (key ? labels[key.toUpperCase()] ?? key : DASH)

/** Garmin stress bands: 0-25 rest, 26-50 low, 51-75 medium, 76-100 high. */
export function stressLabel(v?: number | null) {
  if (v == null || v < 0) return DASH
  return v <= 25 ? 'Istirahat' : v <= 50 ? 'Rendah' : v <= 75 ? 'Sedang' : 'Tinggi'
}

import { useEffect, useState } from 'react'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Opts = { method?: string; json?: unknown; form?: FormData }

// Same-origin fetch: the HttpOnly session cookie rides along, no token in JS.
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.json !== undefined || opts.form ? 'POST' : 'GET') }
  if (opts.json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(opts.json)
  } else if (opts.form) {
    init.body = opts.form
  }
  const res = await fetch(path, init)
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText)
  }
  return data as T
}

/** Call an endpoint of the logged-in account, e.g. me('/daily/summary?date=2026-10-16'). */
export const me = <T = any>(path: string, opts?: Opts) => api<T>(`/api/v1/accounts/me${path}`, opts)

export const isAuthError = (e: unknown) =>
  e instanceof ApiError && (e.status === 401 || e.code === 'garmin_reauth_required' || e.code === 'account_not_connected')

const messages: Record<string, string> = {
  garmin_reauth_required: 'Email, password, atau kode verifikasi salah.',
  garmin_rate_limited: 'Garmin membatasi permintaan. Coba lagi beberapa menit lagi.',
  rate_limited: 'Terlalu banyak percobaan. Tunggu satu menit.',
  mfa_not_pending: 'Sesi verifikasi sudah kedaluwarsa. Login ulang untuk kode baru.',
  garmin_unavailable: 'Garmin sedang tidak bisa dihubungi. Coba lagi nanti.',
  invalid_file_format: 'File harus berformat FIT, GPX, atau TCX.',
  not_found: 'Data tidak ditemukan di Garmin.',
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return messages[e.code] ?? e.message
  return 'Tidak bisa terhubung ke server.'
}

/** Runs promises side by side; a failed one yields undefined instead of failing the page. */
export async function settle<T extends readonly unknown[]>(ps: { [K in keyof T]: Promise<T[K]> }) {
  const rs = await Promise.allSettled(ps)
  const auth = rs.find((r) => r.status === 'rejected' && isAuthError(r.reason))
  if (auth) throw (auth as PromiseRejectedResult).reason
  if (rs.length && rs.every((r) => r.status === 'rejected')) throw (rs[0] as PromiseRejectedResult).reason
  return rs.map((r) => (r.status === 'fulfilled' ? r.value : undefined)) as { [K in keyof T]: T[K] | undefined }
}

/** Loads data for a page; reload() fetches again. Auth failures send the user to /login. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (e) => {
        if (!live) return
        if (isAuthError(e)) {
          history.pushState(null, '', '/login')
          dispatchEvent(new PopStateEvent('popstate'))
          return
        }
        setState((s) => ({ ...s, error: errorText(e), loading: false }))
      },
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1) }
}

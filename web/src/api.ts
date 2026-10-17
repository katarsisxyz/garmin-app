export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Same-origin fetch: the HttpOnly session cookie rides along, no token in JS.
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText)
  }
  return data as T
}

/** GET an endpoint of the logged-in account, e.g. me('/daily/summary?date=2026-10-16'). */
export const me = <T = any>(path: string) => api<T>(`/api/v1/accounts/me${path}`)

const messages: Record<string, string> = {
  garmin_reauth_required: 'Email, password, atau kode verifikasi salah.',
  garmin_rate_limited: 'Garmin membatasi percobaan login. Coba lagi beberapa menit lagi.',
  rate_limited: 'Terlalu banyak percobaan. Tunggu satu menit.',
  mfa_not_pending: 'Sesi verifikasi sudah kedaluwarsa. Silakan login ulang.',
  garmin_unavailable: 'Garmin sedang tidak bisa dihubungi. Coba lagi nanti.',
  invalid_argument: 'Data yang dikirim tidak valid.',
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return messages[e.code] ?? e.message
  return 'Tidak bisa terhubung ke server.'
}

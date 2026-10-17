import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { api, ApiError, errorText } from '../api'
import { navigate } from '../App'
import AuthLayout, { Alert, SubmitButton } from './AuthLayout'

const LEN = 6

export default function Mfa() {
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setFrom(i: number, value: string) {
    const chars = value.replace(/\D/g, '').slice(0, LEN - i).split('')
    if (chars.length === 0) return
    const next = [...digits]
    chars.forEach((ch, k) => (next[i + k] = ch))
    setDigits(next)
    refs.current[Math.min(i + chars.length, LEN - 1)]?.focus()
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]
      next[i - 1] = ''
      setDigits(next)
      refs.current[i - 1]?.focus()
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    setFrom(i, e.clipboardData.getData('text'))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/auth/mfa', { code: digits.join('') })
      navigate('/')
    } catch (err) {
      setExpired(err instanceof ApiError && err.code === 'mfa_not_pending')
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  const complete = digits.every(Boolean)

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="space-y-2 pb-2">
          <h1 className="text-[26px] font-bold lg:text-[28px]">Masukkan kode verifikasi</h1>
          <p className="text-[15px] leading-normal text-gray-500">
            Garmin mengirim kode 6 digit ke email atau aplikasi autentikator kamu. Kode berlaku 10 menit.
          </p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <fieldset className="space-y-2">
          <legend className="pb-2 text-sm font-semibold">Kode verifikasi</legend>
          <div className="flex gap-2.5 lg:gap-3">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el
                }}
                value={d}
                onChange={(e) => (e.target.value ? setFrom(i, e.target.value) : setDigits(digits.map((x, k) => (k === i ? '' : x))))}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={(e) => onPaste(i, e)}
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                autoFocus={i === 0}
                aria-label={`Digit ${i + 1}`}
                className="h-16 w-full min-w-0 rounded-[10px] border border-gray-300 text-center text-2xl font-semibold outline-none focus:border-2 focus:border-blue-600"
              />
            ))}
          </div>
        </fieldset>

        <SubmitButton loading={loading} disabled={!complete || expired}>Verifikasi</SubmitButton>

        <Alert tone="info">
          Tidak menerima kode? Cek folder spam, atau kembali dan login ulang untuk mendapatkan kode baru.
        </Alert>
        <button type="button" onClick={() => navigate('/login')} className="self-start text-sm font-semibold text-blue-600">
          ←&nbsp;&nbsp;Kembali ke login
        </button>
      </form>
    </AuthLayout>
  )
}

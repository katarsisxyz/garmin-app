import { useState, type FormEvent } from 'react'
import { api, errorText } from '../api'
import { navigate } from '../App'
import AuthLayout, { Alert, SubmitButton } from './AuthLayout'

const input =
  'w-full rounded-[10px] border border-gray-300 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const r = await api<{ mfa_required: boolean }>('/auth/login', { email, password })
      navigate(r.mfa_required ? '/mfa' : '/')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="space-y-2 pb-2">
          <h1 className="text-[26px] font-bold lg:text-[28px]">Hubungkan akun Garmin</h1>
          <p className="text-[15px] leading-normal text-gray-500">Masuk dengan email dan password Garmin Connect kamu.</p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <label className="space-y-2">
          <span className="text-sm font-semibold">Email</span>
          <input
            className={input}
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold">Password</span>
          <div className="relative">
            <input
              className={`${input} pr-24`}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-4 text-[13px] font-semibold text-blue-600"
            >
              {show ? 'Sembunyikan' : 'Tampilkan'}
            </button>
          </div>
        </label>

        <SubmitButton loading={loading}>Hubungkan akun</SubmitButton>

        <Alert tone="success">
          Password hanya dipakai untuk login ke Garmin dan tidak disimpan. Yang kami simpan hanya token, dalam keadaan terenkripsi.
        </Alert>
        <p className="text-[13px] leading-normal text-gray-500">
          Akunmu memakai verifikasi 2 langkah? Kami akan meminta kode setelah langkah ini.
        </p>
      </form>
    </AuthLayout>
  )
}

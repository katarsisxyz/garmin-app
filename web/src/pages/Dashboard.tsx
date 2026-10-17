import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, errorText, me } from '../api'
import { navigate } from '../App'
import * as f from '../format'

// Raw Garmin JSON is forwarded as is by the API; only the fields read here are typed.
type Data = {
  name?: string
  summary?: any
  sleep?: any
  hrv?: any
  readiness?: any
  steps?: { calendarDate: string; totalSteps?: number }[]
  activities?: any[]
}

const today = f.isoDate(new Date())

export default function Dashboard() {
  const [date, setDate] = useState(today)
  const [data, setData] = useState<Data>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<Date>()

  const load = useCallback(async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const status = await me<{ connected: boolean; display_name?: string; full_name?: string }>('/status')
      if (!status.connected) return navigate('/login')
      // One failing Garmin call shouldn't blank the whole page.
      const [summary, sleep, hrv, readiness, steps, activities] = await Promise.allSettled([
        me(`/daily/summary?date=${d}`),
        me(`/daily/sleep?date=${d}`),
        me(`/daily/hrv?date=${d}`),
        me(`/performance/training-readiness?date=${d}`),
        me(`/daily/steps/range?start=${f.addDays(d, -6)}&end=${d}`),
        me('/activities?start=0&limit=5'),
      ])
      const v = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : undefined)
      if ([summary, sleep, hrv, readiness, steps, activities].every((r) => r.status === 'rejected')) {
        setError(errorText((summary as PromiseRejectedResult).reason))
      }
      setData({
        name: status.full_name || status.display_name,
        summary: v(summary),
        sleep: v(sleep),
        hrv: v(hrv),
        readiness: v(readiness),
        steps: v(steps),
        activities: v(activities),
      })
      setUpdated(new Date())
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === 'garmin_reauth_required')) return navigate('/login')
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  async function logout() {
    await api('/auth/logout', {}).catch(() => {})
    navigate('/login')
  }

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar name={data.name} onLogout={logout} />

      <main className="flex-1 space-y-4 px-5 pt-14 pb-28 lg:space-y-6 lg:px-10 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-gray-500 lg:hidden">{f.longDate(date)}</p>
            <h1 className="text-[30px] font-bold lg:text-[28px]">
              <span className="lg:hidden">{date === today ? 'Hari ini' : 'Dashboard'}</span>
              <span className="hidden lg:inline">Dashboard</span>
            </h1>
            <p className="hidden text-sm text-gray-500 lg:block">{f.longDate(date)} · data dari Garmin Connect</p>
          </div>
          <div className="flex items-center gap-3">
            {updated && <span className="hidden text-[13px] text-gray-400 lg:inline">Diperbarui {updated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-[10px] border border-gray-200 bg-white px-3.5 py-2.5 text-sm"
            />
            <button
              onClick={() => load(date)}
              disabled={loading}
              className="rounded-[10px] bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Memuat…' : 'Muat ulang'}
            </button>
            <button onClick={logout} className="text-sm font-semibold text-gray-500 lg:hidden">
              Keluar
            </button>
          </div>
        </header>

        {error && <div className="rounded-[10px] bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-12 lg:gap-5 ${loading ? 'opacity-60' : ''}`}>
          <Kpis data={data} />
          <StepsChart steps={data.steps} date={date} />
          <BodyBattery summary={data.summary} readiness={data.readiness} />
          <Activities items={data.activities} />
          <Sleep sleep={data.sleep} />
        </div>
      </main>

      <TabBar />
    </div>
  )
}

/* ---------- layout ---------- */

const nav = ['Dashboard', 'Aktivitas', 'Tidur & recovery', 'Body', 'Workout']

function Sidebar({ name, onLogout }: { name?: string; onLogout: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-62 shrink-0 flex-col gap-1 border-r border-gray-200 bg-white px-4 pt-7 pb-6 lg:flex">
      <div className="mb-5 px-1 text-xl font-bold">Garmin Hub</div>
      {nav.map((item, i) => (
        <div
          key={item}
          title={i ? 'Segera hadir' : undefined}
          className={i ? 'cursor-not-allowed rounded-[10px] px-3 py-2.5 text-sm text-gray-400' : 'rounded-[10px] bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-600'}
        >
          {item}
        </div>
      ))}
      <div className="mt-auto space-y-0.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="truncate text-sm font-semibold">{name ?? 'Akun Garmin'}</div>
        <div className="text-xs text-green-600">● Garmin terhubung</div>
        <button onClick={onLogout} className="pt-2 text-xs font-semibold text-gray-500 hover:text-gray-900">
          Keluar
        </button>
      </div>
    </aside>
  )
}

function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 flex h-20 justify-around border-t border-gray-200 bg-white px-2 pt-3 text-xs lg:hidden">
      {['Hari ini', 'Aktivitas', 'Workout', 'Akun'].map((t, i) => (
        <span key={t} className={i ? 'text-gray-400' : 'font-semibold text-blue-600'}>
          {t}
        </span>
      ))}
    </nav>
  )
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`rounded-2xl bg-white p-4 lg:p-6 ${className}`}>{children}</section>
}

/* ---------- sections ---------- */

function Kpis({ data }: { data: Data }) {
  const s = data.summary
  const d = data.sleep?.dailySleepDTO
  const score = d?.sleepScores?.overall
  const rhrDelta = s?.restingHeartRate && s?.lastSevenDaysAvgRestingHeartRate ? s.restingHeartRate - s.lastSevenDaysAvgRestingHeartRate : null
  const stepPct = s?.totalSteps != null && s?.dailyStepGoal ? Math.round((s.totalSteps / s.dailyStepGoal) * 100) : null

  const items = [
    {
      label: 'Langkah',
      value: f.num(s?.totalSteps),
      sub: stepPct == null ? f.DASH : `${stepPct}% dari target ${f.num(s.dailyStepGoal)}`,
      tone: 'text-blue-600',
    },
    {
      label: 'Detak istirahat',
      value: s?.restingHeartRate ? `${s.restingHeartRate} bpm` : f.DASH,
      sub: rhrDelta == null ? f.DASH : `${rhrDelta > 0 ? '+' : rhrDelta < 0 ? '−' : '±'}${Math.abs(rhrDelta)} vs rata-rata 7 hari`,
      tone: rhrDelta != null && rhrDelta > 0 ? 'text-amber-600' : 'text-green-600',
    },
    {
      label: 'Tidur',
      value: f.hm(d?.sleepTimeSeconds),
      sub: score?.value ? `Skor ${score.value} · ${f.label(score.qualifierKey)}` : f.DASH,
      tone: 'text-violet-600',
    },
    {
      label: 'HRV semalam',
      value: data.hrv?.hrvSummary?.lastNightAvg ? `${data.hrv.hrvSummary.lastNightAvg} ms` : f.DASH,
      sub: f.label(data.hrv?.hrvSummary?.status),
      tone: data.hrv?.hrvSummary?.status === 'BALANCED' ? 'text-green-600' : 'text-amber-600',
    },
  ]
  return items.map((k) => (
    <Card key={k.label} className="space-y-1.5 lg:col-span-3 lg:p-5">
      <p className="text-[13px] text-gray-500">{k.label}</p>
      <p className="text-2xl font-bold lg:text-[28px]">{k.value}</p>
      <p className={`text-xs ${k.tone}`}>{k.sub}</p>
    </Card>
  ))
}

function StepsChart({ steps = [], date }: { steps?: Data['steps']; date: string }) {
  const max = Math.max(1, ...steps.map((s) => s.totalSteps ?? 0))
  const avg = steps.length ? steps.reduce((a, s) => a + (s.totalSteps ?? 0), 0) / steps.length : null
  return (
    <Card className="col-span-2 space-y-3 lg:col-span-8 lg:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold lg:text-base">Langkah 7 hari terakhir</h2>
        <span className="text-xs text-gray-500 lg:text-[13px]">Rata-rata {f.num(avg)} / hari</span>
      </div>
      <div className="flex h-28 items-end gap-3.5 border-b border-gray-200 lg:h-44 lg:gap-7 lg:px-3">
        {steps.map((s) => (
          <div
            key={s.calendarDate}
            title={`${f.shortDate(s.calendarDate)}: ${f.num(s.totalSteps)} langkah`}
            className={`flex-1 rounded-t-md ${s.calendarDate === date ? 'bg-blue-600' : 'bg-blue-200'}`}
            style={{ height: `${((s.totalSteps ?? 0) / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-3.5 lg:gap-7 lg:px-3">
        {steps.map((s) => (
          <span key={s.calendarDate} className={`flex-1 text-center text-[11px] lg:text-xs ${s.calendarDate === date ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
            {s.calendarDate === today ? <><span className="lg:hidden">Ini</span><span className="hidden lg:inline">Hari ini</span></> : f.weekday(s.calendarDate)}
          </span>
        ))}
      </div>
    </Card>
  )
}

function BodyBattery({ summary: s, readiness }: { summary?: any; readiness?: any }) {
  const bb: number | undefined = s?.bodyBatteryMostRecentValue
  const r = Array.isArray(readiness) ? readiness[0] : readiness
  return (
    <section className="order-first col-span-2 flex flex-col gap-3 rounded-[20px] bg-navy p-5 text-white lg:order-none lg:col-span-4 lg:rounded-2xl lg:p-6">
      <p className="text-sm font-semibold text-white/70">Body Battery</p>
      <p className="flex items-baseline gap-1">
        <span className="text-[52px] leading-none font-bold lg:text-[56px]">{bb ?? f.DASH}</span>
        <span className="text-white/50">/ 100</span>
      </p>
      <div className="h-2 rounded bg-white/15">
        <div className="h-2 rounded bg-green-400" style={{ width: `${bb ?? 0}%` }} />
      </div>
      <p className="text-[13px] text-white/70">
        {s?.bodyBatteryChargedValue != null
          ? `Naik ${s.bodyBatteryChargedValue} saat istirahat, turun ${s.bodyBatteryDrainedValue ?? 0} sepanjang hari.`
          : 'Belum ada data Body Battery.'}
      </p>
      <div className="mt-auto space-y-2.5 border-t border-white/15 pt-3.5 text-[13px]">
        <Row label="Training readiness" value={r?.score != null ? `${r.score} · ${f.label(r.level)}` : f.DASH} />
        <Row label="Stress rata-rata" value={s?.averageStressLevel >= 0 ? `${s.averageStressLevel} · ${f.stressLabel(s.averageStressLevel)}` : f.DASH} />
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

const stages = [
  { key: 'deepSleepSeconds', name: 'Deep', color: 'bg-violet-900' },
  { key: 'lightSleepSeconds', name: 'Light', color: 'bg-violet-500' },
  { key: 'remSleepSeconds', name: 'REM', color: 'bg-violet-300' },
  { key: 'awakeSleepSeconds', name: 'Terjaga', color: 'bg-pink-400' },
]

function Sleep({ sleep }: { sleep?: any }) {
  const d = sleep?.dailySleepDTO
  const score = d?.sleepScores?.overall
  return (
    <Card className="col-span-2 space-y-3 lg:col-span-4 lg:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold lg:text-base">Tidur semalam</h2>
        {score?.value && <span className="text-xs font-semibold text-violet-600 lg:text-[13px]">Skor {score.value} · {f.label(score.qualifierKey)}</span>}
      </div>
      <p className="hidden text-[32px] font-bold lg:block">{f.hm(d?.sleepTimeSeconds)}</p>
      {d?.sleepTimeSeconds ? (
        <>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-md lg:h-3.5">
            {stages.map((s) => d[s.key] > 0 && <div key={s.key} className={s.color} style={{ flexGrow: d[s.key] }} />)}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2.5">
            {stages.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-xs lg:text-sm">
                <span className={`size-2 rounded-full lg:size-2.5 ${s.color}`} />
                <span className="text-gray-600 lg:flex-1">{s.name}</span>
                <span className="font-semibold">{f.hm(d[s.key])}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-gray-500">Belum ada data tidur untuk tanggal ini.</p>
      )}
    </Card>
  )
}

const iconTint = (typeKey = '') =>
  /run/.test(typeKey) ? 'bg-orange-100' : /cycl|bik/.test(typeKey) ? 'bg-blue-100' : /strength/.test(typeKey) ? 'bg-green-100' : 'bg-gray-100'

function Activities({ items }: { items?: any[] }) {
  const list = Array.isArray(items) ? items : []
  return (
    <section className="order-last col-span-2 space-y-3 lg:order-none lg:col-span-8 lg:space-y-0 lg:rounded-2xl lg:bg-white lg:px-6 lg:pt-6 lg:pb-2">
      <h2 className="pt-1 text-base font-semibold lg:pt-0">Aktivitas terbaru</h2>
      {list.length === 0 && <p className="text-sm text-gray-500 lg:py-4">Belum ada aktivitas.</p>}

      {/* mobile: cards */}
      <div className="space-y-3 lg:hidden">
        {list.map((a) => (
          <div key={a.activityId} className="flex items-center gap-3 rounded-2xl bg-white p-4">
            <div className={`size-11 shrink-0 rounded-full ${iconTint(a.activityType?.typeKey)}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{a.activityName}</p>
              <p className="truncate text-[13px] text-gray-500">
                {[a.distance ? f.km(a.distance) : null, f.clock(a.duration), a.averageHR ? `${Math.round(a.averageHR)} bpm` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            <span className="text-[13px] text-gray-400">{a.startTimeLocal ? f.weekday(a.startTimeLocal.slice(0, 10)) : ''}</span>
          </div>
        ))}
      </div>

      {/* desktop: table */}
      {list.length > 0 && (
        <table className="hidden w-full text-left text-sm lg:table">
          <thead className="border-b border-gray-200 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="pt-4 pb-2.5 font-semibold">Aktivitas</th>
              <th className="w-32 font-semibold">Tanggal</th>
              <th className="w-24 font-semibold">Jarak</th>
              <th className="w-22 font-semibold">Durasi</th>
              <th className="w-28 font-semibold">Pace / kec.</th>
              <th className="w-20 font-semibold">HR rata2</th>
            </tr>
          </thead>
          <tbody className="text-gray-600">
            {list.map((a) => (
              <tr key={a.activityId} className="border-b border-gray-100 last:border-0">
                <td className="py-3.5 font-semibold text-gray-900">{a.activityName}</td>
                <td>{a.startTimeLocal ? f.shortDate(a.startTimeLocal.slice(0, 10)) : f.DASH}</td>
                <td>{f.km(a.distance)}</td>
                <td>{f.clock(a.duration)}</td>
                <td>{a.distance ? f.paceOrSpeed(a.averageSpeed, a.activityType?.typeKey) : f.DASH}</td>
                <td>{a.averageHR ? `${Math.round(a.averageHR)} bpm` : f.DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

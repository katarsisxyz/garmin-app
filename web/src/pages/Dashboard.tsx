import { useState } from 'react'
import { me, settle, useLoad } from '../api'
import * as f from '../format'
import { ActivityRow } from './Activities'
import { Button, Empty, ErrorNote, Link, PageHeader, Panel, Skeleton, Stat, dateClass } from '../ui'

export default function Dashboard() {
  const [date, setDate] = useState(f.today())
  const { data, loading, error, reload } = useLoad(
    () =>
      settle([
        me(`/daily/summary?date=${date}`),
        me(`/daily/sleep?date=${date}`),
        me(`/daily/hrv?date=${date}`),
        me(`/performance/training-readiness?date=${date}`),
        me(`/daily/steps/range?start=${f.addDays(date, -6)}&end=${date}`),
        me('/activities?start=0&limit=4'),
      ] as const),
    [date],
  )
  const [summary, sleep, hrv, readiness, steps, activities] = data ?? []
  const s = summary as any
  const d = (sleep as any)?.dailySleepDTO
  const score = d?.sleepScores?.overall
  const h = (hrv as any)?.hrvSummary
  const r = Array.isArray(readiness) ? readiness[0] : (readiness as any)
  const isToday = date === f.today()

  return (
    <>
      <PageHeader
        title={isToday ? 'Hari ini' : f.dayLabel(date)}
        subtitle={f.longDate(date)}
        actions={
          <>
            <input type="date" value={date} max={f.today()} onChange={(e) => e.target.value && setDate(e.target.value)} className={dateClass} aria-label="Tanggal" />
            <Button icon="refresh" onClick={reload} busy={loading} aria-label="Muat ulang">
              <span className="hidden sm:inline">Muat ulang</span>
            </Button>
          </>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          {/* The one bold element: Body Battery as a dial, the day's numbers beside it. */}
          <section className="grid overflow-hidden rounded-3xl border border-line bg-white lg:grid-cols-[340px_1fr]">
            <div className="flex flex-col items-center justify-center gap-2 bg-ink px-6 py-8 text-white">
              <Gauge value={s?.bodyBatteryMostRecentValue} />
              <p className="text-center text-sm text-white/70">
                {s?.bodyBatteryChargedValue != null
                  ? `Terisi ${s.bodyBatteryChargedValue} saat istirahat, terpakai ${s.bodyBatteryDrainedValue ?? 0}`
                  : 'Belum ada data Body Battery'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-7 p-6 lg:grid-cols-3 lg:p-8">
              <Stat
                label="Langkah"
                tone="var(--color-steps)"
                value={f.int(s?.totalSteps)}
                sub={s?.dailyStepGoal ? `Target ${f.int(s.dailyStepGoal)}` : undefined}
              />
              <Stat label="Detak istirahat" tone="var(--color-heart)" value={s?.restingHeartRate ?? f.DASH} unit="bpm" sub={s?.lastSevenDaysAvgRestingHeartRate ? `Rata-rata 7 hari ${s.lastSevenDaysAvgRestingHeartRate}` : undefined} />
              <Stat label="Tidur" tone="var(--color-sleep)" value={f.hm(d?.sleepTimeSeconds)} sub={score?.value ? `Skor ${score.value}, ${f.label(score.qualifierKey).toLowerCase()}` : undefined} />
              <Stat label="HRV semalam" tone="var(--color-battery)" value={h?.lastNightAvg ?? f.DASH} unit="ms" sub={h?.status ? f.label(h.status) : undefined} />
              <Stat label="Stress rata-rata" tone="var(--color-stress)" value={s?.averageStressLevel >= 0 ? s.averageStressLevel : f.DASH} sub={f.stressLabel(s?.averageStressLevel)} />
              <Stat label="Training readiness" tone="var(--color-accent)" value={r?.score ?? f.DASH} sub={r?.level ? f.label(r.level) : undefined} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
            <Panel title="Langkah 7 hari" action={<span className="text-xs text-muted">Target {f.int(s?.dailyStepGoal)}</span>}>
              <StepBars steps={(steps as any[]) ?? []} date={date} goal={s?.dailyStepGoal} />
            </Panel>
            <Panel title="Tidur semalam" action={<Link to="/sleep" className="text-sm font-semibold text-accent">Detail tidur</Link>}>
              {d?.sleepTimeSeconds ? (
                <div className="space-y-4">
                  <p className="text-[32px] font-extrabold tracking-tight">{f.hm(d.sleepTimeSeconds)}</p>
                  <StageBar d={d} />
                </div>
              ) : (
                <Empty title="Belum ada data tidur">Pakai jam saat tidur untuk melihat fase tidurmu.</Empty>
              )}
            </Panel>
          </div>

          <Panel title="Aktivitas terbaru" action={<Link to="/activities" className="text-sm font-semibold text-accent">Semua aktivitas</Link>}>
            {Array.isArray(activities) && activities.length ? (
              <ul className="-my-1 divide-y divide-line">
                {activities.map((a: any) => (
                  <ActivityRow key={a.activityId} a={a} />
                ))}
              </ul>
            ) : (
              <Empty title="Belum ada aktivitas">Aktivitas yang direkam jam akan muncul di sini.</Empty>
            )}
          </Panel>
        </>
      )}
    </>
  )
}

/** Half-ring dial, 0-100. */
function Gauge({ value }: { value?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const len = Math.PI * 80
  return (
    <div className="relative w-56">
      <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={`Body Battery ${value ?? 'tidak ada data'}`}>
        <path d="M20 100a80 80 0 0 1 160 0" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 100a80 80 0 0 1 160 0"
          fill="none"
          stroke="#43c47f"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * len} ${len}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-6xl leading-none font-extrabold tracking-tight">{value ?? f.DASH}</p>
        <p className="mt-1 text-sm font-semibold text-white/70">Body Battery</p>
      </div>
    </div>
  )
}

export function StepBars({ steps, date, goal }: { steps: { calendarDate: string; totalSteps?: number }[]; date: string; goal?: number }) {
  if (!steps.length) return <Empty title="Belum ada data langkah" />
  const max = Math.max(1, goal ?? 0, ...steps.map((s) => s.totalSteps ?? 0))
  return (
    <div>
      <div className="relative flex h-44 items-end gap-2.5 border-b border-line sm:gap-4">
        {goal ? <div className="absolute inset-x-0 border-t border-dashed border-[#b9c2bd]" style={{ bottom: `${(goal / max) * 100}%` }} /> : null}
        {steps.map((s) => {
          const reached = goal && (s.totalSteps ?? 0) >= goal
          return (
            <div key={s.calendarDate} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-lg transition-[height] duration-500"
                style={{ height: `${((s.totalSteps ?? 0) / max) * 100}%`, background: s.calendarDate === date ? 'var(--color-steps)' : reached ? '#9ccbf2' : '#d3e6f7' }}
              />
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                {f.int(s.totalSteps)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-2.5 sm:gap-4">
        {steps.map((s) => (
          <span key={s.calendarDate} className={`flex-1 text-center text-xs ${s.calendarDate === date ? 'font-bold text-steps' : 'text-muted'}`}>
            {f.weekday(s.calendarDate)}
          </span>
        ))}
      </div>
    </div>
  )
}

export const stages = [
  { key: 'deepSleepSeconds', name: 'Deep', color: '#3b2a8c' },
  { key: 'lightSleepSeconds', name: 'Light', color: '#8b74e6' },
  { key: 'remSleepSeconds', name: 'REM', color: '#c3b6f5' },
  { key: 'awakeSleepSeconds', name: 'Terjaga', color: '#f08bb4' },
]

export function StageBar({ d }: { d: any }) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {stages.map((s) => d[s.key] > 0 && <div key={s.key} style={{ flexGrow: d[s.key], background: s.color }} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {stages.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            <span className="flex-1 text-muted">{s.name}</span>
            <span className="font-semibold">{f.hm(d[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

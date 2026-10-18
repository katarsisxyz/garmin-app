import { useState } from 'react'
import { me, settle, useLoad } from '../api'
import * as f from '../format'
import { StageBar } from './Dashboard'
import { Button, Empty, ErrorNote, PageHeader, Panel, Skeleton, Stat, dateClass } from '../ui'

export default function Sleep() {
  const [date, setDate] = useState(f.today())
  const { data, loading, error, reload } = useLoad(
    () =>
      settle([
        me(`/daily/sleep?date=${date}`),
        me(`/daily/hrv?date=${date}`),
        me(`/performance/training-readiness?date=${date}`),
        me(`/daily/body-battery?start=${f.addDays(date, -6)}&end=${date}`),
        me(`/daily/stress?date=${date}`),
        me(`/daily/respiration?date=${date}`),
        me(`/daily/spo2?date=${date}`),
      ] as const),
    [date],
  )
  const [sleep, hrv, readiness, battery, stress, resp, spo2] = (data ?? []) as any[]
  const d = sleep?.dailySleepDTO
  const score = d?.sleepScores?.overall
  const h = hrv?.hrvSummary
  const r = Array.isArray(readiness) ? readiness[0] : readiness

  return (
    <>
      <PageHeader
        title="Tidur & recovery"
        subtitle={`Malam sebelum ${f.longDate(date)}`}
        actions={
          <>
            <input type="date" value={date} max={f.today()} onChange={(e) => e.target.value && setDate(e.target.value)} className={dateClass} aria-label="Tanggal" />
            <Button icon="refresh" onClick={reload} busy={loading} aria-label="Muat ulang" />
          </>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {loading && !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <section className="rounded-3xl border border-line bg-white p-6 lg:p-8">
            {d?.sleepTimeSeconds ? (
              <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
                <div className="space-y-5">
                  <div>
                    <p className="text-[13px] text-muted">Total tidur</p>
                    <p className="text-5xl font-extrabold tracking-tight">{f.hm(d.sleepTimeSeconds)}</p>
                    <p className="mt-1 text-sm text-muted">
                      {f.timeOf(d.sleepStartTimestampLocal)} sampai {f.timeOf(d.sleepEndTimestampLocal)}
                    </p>
                  </div>
                  {score?.value && (
                    <div className="flex items-center gap-3">
                      <span className="grid size-14 place-items-center rounded-full border-4 text-lg font-extrabold" style={{ borderColor: 'var(--color-sleep)', color: 'var(--color-sleep)' }}>
                        {score.value}
                      </span>
                      <div>
                        <p className="font-bold">Skor tidur</p>
                        <p className="text-sm text-muted">{f.label(score.qualifierKey)}</p>
                      </div>
                    </div>
                  )}
                  <StageBar d={d} />
                </div>
                <Hypnogram levels={sleep?.sleepLevels ?? []} />
              </div>
            ) : (
              <Empty title="Belum ada data tidur untuk malam ini">Pakai jam saat tidur, lalu sinkronkan di aplikasi Garmin Connect.</Empty>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="HRV semalam">
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <Stat label={h?.status ? f.label(h.status) : 'Status belum ada'} tone="var(--color-battery)" value={h?.lastNightAvg ?? f.DASH} unit="ms" />
                  <Stat label="Rata-rata 7 hari" value={h?.weeklyAvg ?? f.DASH} unit="ms" />
                </div>
                <HrvBand h={h} />
              </div>
            </Panel>
            <Panel title="Training readiness">
              <div className="flex items-center gap-5">
                <span className="text-5xl font-extrabold tracking-tight text-accent">{r?.score ?? f.DASH}</span>
                <div className="space-y-1 text-sm">
                  <p className="font-bold">{r?.level ? f.label(r.level) : 'Belum ada data'}</p>
                  {r?.recoveryTime != null && <p className="text-muted">Pemulihan {f.hm(r.recoveryTime * 60)} lagi</p>}
                  {sleep?.restingHeartRate && <p className="text-muted">Detak istirahat {sleep.restingHeartRate} bpm</p>}
                </div>
              </div>
            </Panel>
            <Panel title="Tanda vital saat tidur">
              <div className="grid grid-cols-2 gap-5">
                <Stat label="Stress rata-rata" tone="var(--color-stress)" value={stress?.avgStressLevel >= 0 ? stress.avgStressLevel : f.DASH} sub={f.stressLabel(stress?.avgStressLevel)} />
                <Stat label="Stress tertinggi" value={stress?.maxStressLevel >= 0 ? stress.maxStressLevel : f.DASH} />
                <Stat label="Napas" value={resp?.avgSleepRespirationValue ? f.num(resp.avgSleepRespirationValue) : f.DASH} unit="/mnt" />
                <Stat label="SpO2" value={spo2?.averageSpO2 ?? f.DASH} unit="%" sub={spo2?.lowestSpO2 ? `Terendah ${spo2.lowestSpO2}%` : undefined} />
              </div>
            </Panel>
          </div>

          <Panel title="Body Battery 7 hari">
            <BatteryWeek days={Array.isArray(battery) ? battery : []} date={date} />
          </Panel>
        </>
      )}
    </>
  )
}

const rows = [
  { level: 3, name: 'Terjaga', color: '#f08bb4' },
  { level: 2, name: 'REM', color: '#c3b6f5' },
  { level: 1, name: 'Light', color: '#8b74e6' },
  { level: 0, name: 'Deep', color: '#3b2a8c' },
]

/** Sleep stages through the night as a step chart: deeper sleep sits lower. */
function Hypnogram({ levels }: { levels: { startGMT: string; endGMT: string; activityLevel: number }[] }) {
  if (!levels.length) return <Empty title="Rincian fase per menit tidak tersedia" />
  const t = (s: string) => Date.parse(s.endsWith('Z') ? s : `${s}Z`)
  const start = t(levels[0].startGMT)
  const end = t(levels[levels.length - 1].endGMT)
  const W = 640
  const rowH = 40
  const x = (ms: number) => ((ms - start) / (end - start)) * W
  const y = (lvl: number) => rows.findIndex((r) => r.level === Math.round(lvl)) * rowH
  const hours: number[] = []
  for (let h = Math.ceil(start / 3.6e6) * 3.6e6; h < end; h += 3.6e6) hours.push(h)

  return (
    <figure className="min-w-0">
      <div className="flex gap-3">
        <div className="flex flex-col text-xs text-muted">
          {rows.map((r) => (
            <span key={r.level} className="flex h-10 items-center">
              {r.name}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${rowH * 4}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Grafik fase tidur sepanjang malam">
          {rows.map((r, i) => (
            <line key={r.level} x1="0" x2={W} y1={i * rowH + rowH / 2} y2={i * rowH + rowH / 2} stroke="#eef1ef" />
          ))}
          {levels.map((l, i) => {
            const row = rows.find((r) => r.level === Math.round(l.activityLevel)) ?? rows[2]
            return <rect key={i} x={x(t(l.startGMT))} y={y(l.activityLevel) + 8} width={Math.max(1, x(t(l.endGMT)) - x(t(l.startGMT)))} height={rowH - 16} rx="3" fill={row.color} />
          })}
        </svg>
      </div>
      <div className="relative mt-2 ml-14 h-4 text-xs text-muted">
        {hours.map((h, i) => (
          <span key={h} className={`absolute -translate-x-1/2 ${i % 2 ? 'hidden sm:block' : ''}`} style={{ left: `${((h - start) / (end - start)) * 100}%` }}>
            {new Date(h).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Last night's HRV against the personal balanced range. */
function HrvBand({ h }: { h?: any }) {
  const lo = h?.baseline?.balancedLow
  const hi = h?.baseline?.balancedUpper
  const v = h?.lastNightAvg
  if (!lo || !hi || !v) return <p className="text-sm text-muted">Rentang normal muncul setelah sekitar 3 minggu pemakaian.</p>
  const min = Math.min(lo, v) - 15
  const max = Math.max(hi, v) + 15
  const pos = (n: number) => `${((n - min) / (max - min)) * 100}%`
  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 rounded-full bg-paper">
        <div className="absolute inset-y-0 rounded-full bg-[#cdebd9]" style={{ left: pos(lo), right: `calc(100% - ${pos(hi)})` }} />
        <div className="absolute -top-1 size-4.5 -translate-x-1/2 rounded-full border-[3px] border-white bg-battery shadow" style={{ left: pos(v) }} />
      </div>
      <p className="text-xs text-muted">
        Rentang seimbang kamu {lo}–{hi} ms
      </p>
    </div>
  )
}

function BatteryWeek({ days, date }: { days: any[]; date: string }) {
  if (!days.length) return <Empty title="Belum ada data Body Battery" />
  const peak = (d: any) => {
    const vals: number[] = (d.bodyBatteryValuesArray ?? []).map((p: any[]) => p[p.length - 1]).filter((n: any) => typeof n === 'number')
    return vals.length ? Math.max(...vals) : null
  }
  return (
    <ul className="grid grid-cols-7 gap-2 sm:gap-4">
      {days.map((d) => {
        const p = peak(d)
        return (
          <li key={d.date} className="flex flex-col items-center gap-2">
            <div className="flex h-36 w-full max-w-14 items-end overflow-hidden rounded-xl bg-paper">
              <div className="w-full rounded-xl" style={{ height: `${p ?? 0}%`, background: d.date === date ? 'var(--color-battery)' : '#a9dcbf' }} />
            </div>
            <span className="text-sm font-bold">{p ?? f.DASH}</span>
            <span className="text-center text-[11px] leading-tight text-muted">
              {f.weekday(d.date)}
              <br />
              <span className="text-battery">+{d.charged ?? 0}</span> <span className="text-stress">−{d.drained ?? 0}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

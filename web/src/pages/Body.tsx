import { useState, type FormEvent } from 'react'
import { errorText, me, settle, useLoad } from '../api'
import * as f from '../format'
import { Button, ConfirmButton, Empty, ErrorNote, Field, PageHeader, Panel, Skeleton, Stat, inputClass, toast } from '../ui'

const ranges = [
  { days: 30, label: '30 hari' },
  { days: 90, label: '90 hari' },
  { days: 365, label: '1 tahun' },
]

export default function Body() {
  const [days, setDays] = useState(30)
  const end = f.today()
  const start = f.addDays(end, -days + 1)
  const { data, loading, error, reload } = useLoad(
    () => settle([me(`/body/weigh-ins?start=${start}&end=${end}`), me(`/body/blood-pressure?start=${start}&end=${end}`), me(`/daily/hydration?date=${end}`)] as const),
    [days],
  )
  const [weights, bp, water] = (data ?? []) as any[]

  // Newest first, one entry per weigh-in.
  const weighIns: any[] = (weights?.dailyWeightSummaries ?? [])
    .flatMap((d: any) => (d.allWeightMetrics?.length ? d.allWeightMetrics : [d.latestWeight]).map((w: any) => ({ ...w, day: d.summaryDate })))
    .filter((w: any) => w?.weight)
    .sort((a: any, b: any) => b.day.localeCompare(a.day) || (b.date ?? 0) - (a.date ?? 0))
  const readings: any[] = (bp?.measurementSummaries ?? [])
    .flatMap((s: any) => s.measurements ?? [])
    .sort((a: any, b: any) => String(b.measurementTimestampLocal).localeCompare(String(a.measurementTimestampLocal)))

  return (
    <>
      <PageHeader
        title="Body"
        subtitle="Berat badan, tekanan darah, dan minum hari ini"
        actions={
          <div className="flex rounded-xl border border-line bg-white p-1">
            {ranges.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === r.days ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}

      {loading && !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
            <Weight list={weighIns} onChange={reload} />
            <Hydration water={water} date={end} onChange={reload} />
          </div>
          <BloodPressure list={readings} onChange={reload} />
        </>
      )}
    </>
  )
}

function Weight({ list, onChange }: { list: any[]; onChange: () => void }) {
  const latest = list[0]
  const oldest = list[list.length - 1]
  const delta = latest && oldest && latest !== oldest ? (latest.weight - oldest.weight) / 1000 : null

  return (
    <Panel title="Berat badan">
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat size="lg" label={latest ? `Terakhir, ${f.dayLabel(latest.day).toLowerCase()}` : 'Belum ada data'} value={f.kg(latest?.weight)} unit="kg" />
            {delta != null && <Stat label="Perubahan di periode ini" value={`${delta > 0 ? '+' : delta < 0 ? '−' : ''}${f.num(Math.abs(delta), 1)}`} unit="kg" />}
            {latest?.bmi && <Stat label="BMI" value={f.num(latest.bmi, 1)} />}
            {latest?.bodyFat && <Stat label="Lemak tubuh" value={f.num(latest.bodyFat, 1)} unit="%" />}
          </div>
          <Sparkline values={[...list].reverse().map((w) => w.weight / 1000)} />
          {list.length > 0 && (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto text-sm">
              {list.map((w) => (
                <li key={`${w.samplePk}-${w.day}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted">
                    {f.dayLabel(w.day)}
                    {w.date ? `, ${f.timeOf(w.date)}` : ''}
                  </span>
                  <span className="ml-auto font-semibold">{f.kg(w.weight)} kg</span>
                  {w.samplePk && (
                    <ConfirmButton
 compact
                      label="Hapus"
                      confirmLabel="Hapus"
                      onConfirm={async () => {
                        try {
                          await me(`/body/weigh-ins/${w.samplePk}?date=${w.day}`, { method: 'DELETE' })
                          toast('Penimbangan dihapus')
                          onChange()
                        } catch (e) {
                          toast(errorText(e), 'error')
                        }
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <AddWeight onAdded={onChange} />
      </div>
    </Panel>
  )
}

function AddWeight({ onAdded }: { onAdded: () => void }) {
  const [weight, setWeight] = useState('')
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await me('/body/weigh-ins', { json: { weight: Number(weight.replace(',', '.')), unit: 'kg', ...(when ? { timestamp: new Date(when).toISOString() } : {}) } })
      toast(`Berat ${weight} kg dicatat`)
      setWeight('')
      setWhen('')
      onAdded()
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-paper p-4">
      <p className="text-sm font-bold">Catat penimbangan</p>
      <Field label="Berat (kg)">
        <input required inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" placeholder="70,5" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Waktu" hint="Kosongkan untuk sekarang">
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
      </Field>
      <Button variant="primary" type="submit" busy={busy} className="w-full">
        Simpan berat
      </Button>
    </form>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(' ')
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-20 w-full" role="img" aria-label="Tren berat badan">
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Hydration({ water, date, onChange }: { water?: any; date: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const ml = water?.valueInML ?? 0
  const goal = water?.goalInML || 2000
  async function add(v: number) {
    setBusy(true)
    try {
      await me('/daily/hydration', { json: { value_ml: v, date } })
      toast(v > 0 ? `+${v} ml dicatat` : `${v} ml dikoreksi`)
      onChange()
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel title="Minum hari ini">
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold tracking-tight">{f.int(ml)}</span>
          <span className="pb-1 text-sm font-semibold text-muted">/ {f.int(goal)} ml</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-[#2b9fd9] transition-[width] duration-500" style={{ width: `${Math.min(100, (ml / goal) * 100)}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button disabled={busy} onClick={() => add(250)}>
            +250
          </Button>
          <Button disabled={busy} onClick={() => add(500)}>
            +500
          </Button>
          <Button variant="ghost" disabled={busy || ml < 250} onClick={() => add(-250)}>
            −250
          </Button>
        </div>
      </div>
    </Panel>
  )
}

function BloodPressure({ list, onChange }: { list: any[]; onChange: () => void }) {
  const [form, setForm] = useState({ systolic: '', diastolic: '', pulse: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const latest = list[0]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await me('/body/blood-pressure', {
        json: { systolic: Number(form.systolic), diastolic: Number(form.diastolic), pulse: Number(form.pulse) || 0, notes: form.notes },
      })
      toast(`Tekanan darah ${form.systolic}/${form.diastolic} dicatat`)
      setForm({ systolic: '', diastolic: '', pulse: '', notes: '' })
      onChange()
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <Panel title="Tekanan darah">
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          {latest ? (
            <Stat size="lg" label={`Terakhir, ${f.dayLabel(latest.measurementTimestampLocal).toLowerCase()}`} tone="var(--color-heart)" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" sub={latest.pulse ? `Nadi ${latest.pulse} bpm` : undefined} />
          ) : (
            <Empty title="Belum ada pengukuran">Catat hasil tensimeter di formulir ini.</Empty>
          )}
          {list.length > 0 && (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto text-sm">
              {list.map((m) => (
                <li key={m.version} className="flex items-center gap-3 py-2">
                  <span className="text-muted">
                    {f.dayLabel(m.measurementTimestampLocal)}, {f.timeOf(m.measurementTimestampLocal)}
                  </span>
                  <span className="ml-auto font-semibold">
                    {m.systolic}/{m.diastolic}
                  </span>
                  <span className="w-16 text-right text-muted">{m.pulse ? `${m.pulse} bpm` : ''}</span>
                  <ConfirmButton
 compact
                    label="Hapus"
                    confirmLabel="Hapus"
                    onConfirm={async () => {
                      try {
                        await me(`/body/blood-pressure/${m.version}?date=${String(m.measurementTimestampLocal).slice(0, 10)}`, { method: 'DELETE' })
                        toast('Pengukuran dihapus')
                        onChange()
                      } catch (e) {
                        toast(errorText(e), 'error')
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-paper p-4">
          <p className="text-sm font-bold">Catat pengukuran</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Sistolik">
              <input required type="number" min={70} max={260} placeholder="120" value={form.systolic} onChange={set('systolic')} className={inputClass} />
            </Field>
            <Field label="Diastolik">
              <input required type="number" min={40} max={150} placeholder="80" value={form.diastolic} onChange={set('diastolic')} className={inputClass} />
            </Field>
          </div>
          <Field label="Nadi (opsional)">
            <input type="number" min={30} max={250} placeholder="65" value={form.pulse} onChange={set('pulse')} className={inputClass} />
          </Field>
          <Field label="Catatan (opsional)">
            <input value={form.notes} onChange={set('notes')} className={inputClass} />
          </Field>
          <Button variant="primary" type="submit" busy={busy} className="w-full">
            Simpan pengukuran
          </Button>
        </form>
      </div>
    </Panel>
  )
}

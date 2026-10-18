import { useState, type FormEvent } from 'react'
import { errorText, me, settle, useLoad } from '../api'
import * as f from '../format'
import { Button, ConfirmButton, Empty, ErrorNote, Field, Icon, PageHeader, Panel, Skeleton, inputClass, toast } from '../ui'

const sports = [
  { key: 'running', id: 1, label: 'Lari' },
  { key: 'cycling', id: 2, label: 'Bersepeda' },
  { key: 'strength_training', id: 5, label: 'Strength' },
]

export default function Workouts() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const [creating, setCreating] = useState(false)
  const { data, loading, error, reload } = useLoad(
    () =>
      settle([
        me('/workouts?start=0&limit=50'),
        me(`/workouts/scheduled?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
        me(`/workouts/scheduled?year=${next.getFullYear()}&month=${next.getMonth() + 1}`),
        me('/devices'),
      ] as const),
    [],
  )
  const [library, cal1, cal2, devices] = (data ?? []) as any[]
  const workouts: any[] = Array.isArray(library) ? library : []
  const upcoming: any[] = [...(cal1?.calendarItems ?? []), ...(cal2?.calendarItems ?? [])]
    .filter((i) => i.itemType === 'workout' && i.date >= f.today())
    .sort((a, b) => a.date.localeCompare(b.date))
  const deviceList: any[] = Array.isArray(devices) ? devices : []

  return (
    <>
      <PageHeader
        title="Workout"
        subtitle="Rencanakan latihan, lalu kirim ke jam"
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(!creating)}>
            Buat workout
          </Button>
        }
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {creating && <CreateWorkout onDone={() => (setCreating(false), reload())} onCancel={() => setCreating(false)} />}

      {loading && !data ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Panel title="Workout tersimpan">
            {workouts.length ? (
              <ul className="-my-1 divide-y divide-line">
                {workouts.map((w) => (
                  <WorkoutRow key={w.workoutId} w={w} devices={deviceList} onChange={reload} />
                ))}
              </ul>
            ) : (
              <Empty title="Belum ada workout">Buat workout pertama, lalu jadwalkan atau kirim ke jam.</Empty>
            )}
          </Panel>

          <Panel title="Jadwal mendatang">
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
                    <span className="w-14 shrink-0 text-center">
                      <span className="block text-xs text-muted">{f.weekday(u.date)}</span>
                      <span className="block text-lg leading-tight font-extrabold">{Number(u.date.slice(8))}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{u.title ?? 'Workout'}</span>
                    <ConfirmButton
 compact
                      label="Batalkan"
                      confirmLabel="Batalkan"
                      onConfirm={async () => {
                        try {
                          await me(`/workouts/scheduled/${u.id}`, { method: 'DELETE' })
                          toast('Jadwal dibatalkan')
                          reload()
                        } catch (e) {
                          toast(errorText(e), 'error')
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Tidak ada jadwal">Pilih Jadwalkan di salah satu workout.</Empty>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

function WorkoutRow({ w, devices, onChange }: { w: any; devices: any[]; onChange: () => void }) {
  const [mode, setMode] = useState<'' | 'schedule' | 'push'>('')
  const [date, setDate] = useState(f.today())
  const [device, setDevice] = useState('')
  const [busy, setBusy] = useState(false)
  const sp = f.sport(w.sportType?.sportTypeKey)

  async function act(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'schedule') {
        await me(`/workouts/${w.workoutId}/schedule`, { json: { date } })
        toast(`${w.workoutName} dijadwalkan ${f.dayLabel(date).toLowerCase()}`)
        onChange()
      } else {
        await me(`/workouts/${w.workoutId}/push`, { json: { device_id: Number(device) } })
        toast(`${w.workoutName} dikirim. Sinkronkan jam untuk menerimanya.`)
      }
      setMode('')
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: sp.color }}>
          <Icon name="dumbbell" className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{w.workoutName}</span>
          <span className="block text-[13px] text-muted">
            {sp.name}
            {w.estimatedDurationInSecs ? `, sekitar ${f.hm(w.estimatedDurationInSecs)}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Button variant="ghost" icon="calendar" onClick={() => setMode(mode === 'schedule' ? '' : 'schedule')} aria-expanded={mode === 'schedule'}>
            <span className="hidden sm:inline">Jadwalkan</span>
          </Button>
          <Button variant="ghost" icon="watch" onClick={() => setMode(mode === 'push' ? '' : 'push')} aria-expanded={mode === 'push'} disabled={!devices.length} title={devices.length ? undefined : 'Tidak ada jam terhubung'}>
            <span className="hidden sm:inline">Kirim ke jam</span>
          </Button>
          <ConfirmButton
 compact
            label="Hapus"
            confirmLabel="Hapus"
            onConfirm={async () => {
              try {
                await me(`/workouts/${w.workoutId}`, { method: 'DELETE' })
                toast('Workout dihapus')
                onChange()
              } catch (e) {
                toast(errorText(e), 'error')
              }
            }}
          />
        </span>
      </div>
      {mode && (
        <form onSubmit={act} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-paper p-3 sm:ml-13">
          {mode === 'schedule' ? (
            <Field label="Tanggal">
              <input type="date" required min={f.today()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          ) : (
            <Field label="Jam">
              <select required value={device} onChange={(e) => setDevice(e.target.value)} className={inputClass}>
                <option value="">Pilih perangkat</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.displayName || d.productDisplayName || d.deviceId}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button variant="primary" type="submit" busy={busy}>
            {mode === 'schedule' ? 'Jadwalkan' : 'Kirim'}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setMode('')}>
            Batal
          </Button>
        </form>
      )}
    </li>
  )
}

/** Builds Garmin's workout JSON: optional warm-up, one main timed step, optional cool-down. */
function workoutJSON(name: string, sportKey: string, minutes: number, warm: boolean) {
  const sp = sports.find((s) => s.key === sportKey) ?? sports[0]
  const sportType = { sportTypeId: sp.id, sportTypeKey: sp.key }
  const step = (order: number, id: number, key: string, secs: number) => ({
    type: 'ExecutableStepDTO',
    stepOrder: order,
    stepType: { stepTypeId: id, stepTypeKey: key },
    endCondition: { conditionTypeId: 2, conditionTypeKey: 'time' },
    endConditionValue: secs,
    targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  })
  const steps = warm
    ? [step(1, 1, 'warmup', 300), step(2, 3, 'interval', minutes * 60), step(3, 2, 'cooldown', 300)]
    : [step(1, 3, 'interval', minutes * 60)]
  return {
    workoutName: name,
    sportType,
    estimatedDurationInSecs: minutes * 60 + (warm ? 600 : 0),
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: steps }],
  }
}

function CreateWorkout({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [sport, setSport] = useState('running')
  const [minutes, setMinutes] = useState('30')
  const [warm, setWarm] = useState(true)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await me('/workouts', { json: workoutJSON(name, sport, Number(minutes), warm) })
      toast(`Workout ${name} dibuat`)
      onDone()
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Workout baru">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <Field label="Nama">
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Easy run 30 menit" className={inputClass} />
        </Field>
        <Field label="Olahraga">
          <select value={sport} onChange={(e) => setSport(e.target.value)} className={inputClass}>
            {sports.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Durasi inti (menit)">
          <input required type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Pemanasan + pendinginan 5 menit
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <Button variant="primary" type="submit" busy={busy}>
            Simpan workout
          </Button>
          <Button variant="ghost" type="button" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </form>
    </Panel>
  )
}

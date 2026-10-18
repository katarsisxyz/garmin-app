import { useState } from 'react'
import { errorText, me, settle, useLoad } from '../api'
import { navigate } from '../App'
import * as f from '../format'
import { Button, ConfirmButton, Empty, ErrorNote, Icon, Link, Panel, Skeleton, Stat, inputClass, toast } from '../ui'

const zoneColors = ['#9fb3ab', '#4fa3e0', '#2f9e5f', '#e8a317', '#e0484d']

export default function ActivityDetail({ id }: { id: string }) {
  const { data, loading, error, reload } = useLoad(
    () => settle([me(`/activities/${id}`), me(`/activities/${id}/splits`), me(`/activities/${id}/hr-zones`), me(`/activities/${id}/weather`)] as const),
    [id],
  )
  const [act, splits, zones, weather] = (data ?? []) as any[]
  const s = act?.summaryDTO ?? {}
  const t = act?.activityTypeDTO?.typeKey ?? ''
  const sp = f.sport(t)
  const [pace, paceUnit] = f.paceOrSpeed(s.averageSpeed, t)
  const laps: any[] = splits?.lapDTOs ?? []
  const zoneList: any[] = Array.isArray(zones) ? zones : []
  const zoneTotal = zoneList.reduce((n, z) => n + (z.secsInZone ?? 0), 0)

  return (
    <>
      <Link to="/activities" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <Icon name="back" className="size-4" />
        Aktivitas
      </Link>
      {error && <ErrorNote message={error} onRetry={reload} />}

      {loading && !act ? (
        <Skeleton className="h-64" />
      ) : act ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: sp.color }}>
                <span className="size-2 rounded-full" style={{ background: sp.color }} />
                {sp.name}
              </p>
              <Title id={id} name={act.activityName} onSaved={reload} />
              <p className="text-sm text-muted">
                {f.longDate(s.startTimeLocal ?? '')}, pukul {f.timeOf(s.startTimeLocal)}
                {act.locationName ? ` di ${act.locationName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Download id={id} />
              <ConfirmButton
                label="Hapus"
                confirmLabel="Hapus dari Garmin"
                onConfirm={async () => {
                  try {
                    await me(`/activities/${id}`, { method: 'DELETE' })
                    toast('Aktivitas dihapus')
                    navigate('/activities')
                  } catch (e) {
                    toast(errorText(e), 'error')
                  }
                }}
              />
            </div>
          </header>

          <section className="grid grid-cols-2 gap-x-6 gap-y-7 rounded-3xl border border-line bg-white p-6 sm:grid-cols-3 lg:grid-cols-6 lg:p-8">
            <Stat size="lg" label="Jarak" value={s.distance ? f.km(s.distance) : f.DASH} unit={s.distance ? 'km' : undefined} />
            <Stat size="lg" label="Durasi" value={f.clock(s.duration)} sub={s.movingDuration ? `Bergerak ${f.clock(s.movingDuration)}` : undefined} />
            <Stat size="lg" label={/run|walk|hik/.test(t) ? 'Pace rata-rata' : 'Kecepatan'} value={s.distance ? pace : f.DASH} unit={s.distance ? paceUnit : undefined} />
            <Stat size="lg" label="Detak rata-rata" tone="var(--color-heart)" value={s.averageHR ? Math.round(s.averageHR) : f.DASH} unit="bpm" sub={s.maxHR ? `Maks ${Math.round(s.maxHR)}` : undefined} />
            <Stat size="lg" label="Kalori" value={f.int(s.calories)} unit="kkal" />
            <Stat size="lg" label="Elevasi naik" value={s.elevationGain ? Math.round(s.elevationGain) : f.DASH} unit="m" />
          </section>

          <Description id={id} text={act.description} onSaved={reload} />

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Panel title="Split per km">
              {laps.length ? (
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr className="border-b border-line">
                        <th className="px-1 pb-2 font-semibold">Split</th>
                        <th className="px-1 pb-2 font-semibold">Jarak</th>
                        <th className="px-1 pb-2 font-semibold">Waktu</th>
                        <th className="px-1 pb-2 font-semibold">{/run|walk|hik/.test(t) ? 'Pace' : 'Kecepatan'}</th>
                        <th className="px-1 pb-2 font-semibold">HR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {laps.map((l, i) => {
                        const [lp, lu] = f.paceOrSpeed(l.averageSpeed, t)
                        return (
                          <tr key={i}>
                            <td className="px-1 py-2.5 font-semibold">{i + 1}</td>
                            <td className="px-1">{f.km(l.distance)} km</td>
                            <td className="px-1">{f.clock(l.duration)}</td>
                            <td className="px-1">
                              {lp} <span className="text-muted">{lu}</span>
                            </td>
                            <td className="px-1">{l.averageHR ? Math.round(l.averageHR) : f.DASH}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Tidak ada split untuk aktivitas ini" />
              )}
            </Panel>

            <div className="space-y-4">
              <Panel title="Zona detak jantung">
                {zoneTotal ? (
                  <ul className="space-y-2.5">
                    {zoneList.map((z, i) => (
                      <li key={z.zoneNumber ?? i} className="grid grid-cols-[52px_1fr_56px] items-center gap-3 text-sm">
                        <span className="font-semibold">Zona {z.zoneNumber ?? i + 1}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-paper">
                          <span className="block h-full rounded-full" style={{ width: `${((z.secsInZone ?? 0) / zoneTotal) * 100}%`, background: zoneColors[i] ?? '#9fb3ab' }} />
                        </span>
                        <span className="text-right text-muted">{f.clock(z.secsInZone) === f.DASH ? '0:00' : f.clock(z.secsInZone)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="Tidak ada data detak jantung" />
                )}
              </Panel>
              {weather?.temp != null && (
                <Panel title="Cuaca saat itu">
                  <div className="grid grid-cols-3 gap-4">
                    <Stat label="Suhu" value={f.num(((weather.temp - 32) * 5) / 9)} unit="°C" />
                    <Stat label="Kelembapan" value={weather.relativeHumidity ?? f.DASH} unit="%" />
                    <Stat label="Angin" value={weather.windSpeed != null ? f.num(weather.windSpeed * 1.609) : f.DASH} unit="km/j" />
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

function Title({ id, name, onSaved }: { id: string; name: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [busy, setBusy] = useState(false)
  if (!editing) {
    return (
      <h1 className="group flex items-center gap-2 text-[28px] leading-tight font-extrabold tracking-tight lg:text-[32px]">
        <span className="truncate">{name}</span>
        <button onClick={() => (setValue(name), setEditing(true))} className="rounded-lg p-1.5 text-muted hover:bg-black/5 hover:text-ink" title="Ganti nama">
          <Icon name="pencil" className="size-4" />
          <span className="sr-only">Ganti nama</span>
        </button>
      </h1>
    )
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await me(`/activities/${id}`, { method: 'PATCH', json: { name: value } })
          toast('Nama aktivitas disimpan')
          setEditing(false)
          onSaved()
        } catch (err) {
          toast(errorText(err), 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      <input autoFocus required value={value} onChange={(e) => setValue(e.target.value)} className={`${inputClass} max-w-md text-lg font-bold`} />
      <Button variant="primary" type="submit" busy={busy}>
        Simpan
      </Button>
      <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
        Batal
      </Button>
    </form>
  )
}

function Description({ id, text, onSaved }: { id: string; text?: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(text ?? '')
  const [busy, setBusy] = useState(false)
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-3">
        <p className={`text-sm ${text ? '' : 'text-muted'}`}>{text || 'Belum ada catatan untuk latihan ini.'}</p>
        <Button variant="ghost" icon="pencil" onClick={() => (setValue(text ?? ''), setEditing(true))}>
          {text ? 'Ubah catatan' : 'Tambah catatan'}
        </Button>
      </div>
    )
  }
  return (
    <form
      className="space-y-2 rounded-2xl border border-line bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await me(`/activities/${id}`, { method: 'PATCH', json: { description: value } })
          toast('Catatan disimpan')
          setEditing(false)
          onSaved()
        } catch (err) {
          toast(errorText(err), 'error')
        } finally {
          setBusy(false)
        }
      }}
    >
      <textarea autoFocus rows={3} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} placeholder="Bagaimana rasanya latihan ini?" />
      <div className="flex gap-2">
        <Button variant="primary" type="submit" busy={busy}>
          Simpan catatan
        </Button>
        <Button variant="ghost" type="button" onClick={() => setEditing(false)}>
          Batal
        </Button>
      </div>
    </form>
  )
}

function Download({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const formats = [
    { key: 'gpx', label: 'GPX (rute)' },
    { key: 'tcx', label: 'TCX' },
    { key: 'original', label: 'FIT asli (.zip)' },
    { key: 'csv', label: 'CSV split' },
  ]
  return (
    <div className="relative">
      <Button icon="download" onClick={() => setOpen(!open)} aria-expanded={open}>
        Unduh
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg">
          {formats.map((fm) => (
            <a
              key={fm.key}
              href={`/api/v1/accounts/me/activities/${id}/download?format=${fm.key}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-paper"
            >
              {fm.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

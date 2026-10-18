import { useEffect, useRef, useState } from 'react'
import { errorText, isAuthError, me } from '../api'
import { navigate } from '../App'
import * as f from '../format'
import { Button, Empty, ErrorNote, Icon, Link, PageHeader, Panel, Skeleton, toast } from '../ui'

const PAGE = 20
const filters = [
  { key: '', label: 'Semua' },
  { key: 'running', label: 'Lari' },
  { key: 'cycling', label: 'Bersepeda' },
  { key: 'walking', label: 'Jalan' },
  { key: 'swimming', label: 'Renang' },
  { key: 'strength_training', label: 'Strength' },
]

export default function Activities() {
  const [type, setType] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  async function load(start: number) {
    setLoading(true)
    setError('')
    try {
      const page = (await me<any[]>(`/activities?start=${start}&limit=${PAGE}&type=${type}`)) ?? []
      setItems((xs) => (start === 0 ? page : [...xs, ...page]))
      setMore(page.length === PAGE)
    } catch (e) {
      if (isAuthError(e)) return navigate('/login')
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function upload(fl: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', fl)
      await me('/activities/upload', { form })
      toast(`${fl.name} diunggah. Garmin butuh beberapa detik untuk memprosesnya.`)
      setTimeout(() => load(0), 3000)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <>
      <PageHeader
        title="Aktivitas"
        subtitle="Semua latihan yang tercatat di Garmin Connect"
        actions={
          <>
            <input ref={file} type="file" accept=".fit,.gpx,.tcx" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button variant="primary" icon="upload" busy={uploading} onClick={() => file.current?.click()}>
              Unggah file
            </Button>
          </>
        }
      />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0" role="tablist">
        {filters.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={type === t.key}
            onClick={() => setType(t.key)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              type === t.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorNote message={error} onRetry={() => load(0)} />}

      <Panel>
        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty title="Belum ada aktivitas di sini">Rekam latihan dengan jam, atau unggah file FIT, GPX, atau TCX.</Empty>
        ) : (
          <ul className="-my-1 divide-y divide-line">
            {items.map((a) => (
              <ActivityRow key={a.activityId} a={a} />
            ))}
          </ul>
        )}
        {more && (
          <div className="mt-4 text-center">
            <Button busy={loading} onClick={() => load(items.length)}>
              Muat lebih banyak
            </Button>
          </div>
        )}
      </Panel>
    </>
  )
}

/** One activity as a list row; links to its detail page. */
export function ActivityRow({ a }: { a: any }) {
  const t = a.activityType?.typeKey
  const sp = f.sport(t)
  const [pace, unit] = f.paceOrSpeed(a.averageSpeed, t)
  return (
    <li>
      <Link to={`/activities/${a.activityId}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-paper">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: sp.color }}>
          <Icon name="activity" className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{a.activityName}</span>
          <span className="block text-[13px] text-muted">
            {f.dayLabel(a.startTimeLocal)}, {f.timeOf(a.startTimeLocal)}
          </span>
        </span>
        <span className="hidden w-24 text-right sm:block">
          <span className="block font-bold">{a.distance ? `${f.km(a.distance)} km` : f.DASH}</span>
          <span className="block text-xs text-muted">Jarak</span>
        </span>
        <span className="w-20 text-right">
          <span className="block font-bold">{f.clock(a.duration)}</span>
          <span className="block text-xs text-muted">Durasi</span>
        </span>
        <span className="hidden w-24 text-right md:block">
          <span className="block font-bold">
            {a.distance ? pace : f.DASH}
            {a.distance && unit ? <span className="ml-0.5 text-xs font-semibold text-muted">{unit}</span> : null}
          </span>
          <span className="block text-xs text-muted">{/run|walk|hik/.test(t ?? '') ? 'Pace' : 'Kecepatan'}</span>
        </span>
        <span className="hidden w-16 text-right md:block">
          <span className="block font-bold">{a.averageHR ? Math.round(a.averageHR) : f.DASH}</span>
          <span className="block text-xs text-muted">HR</span>
        </span>
      </Link>
    </li>
  )
}

// Hour, week, country, world clock, colour and button columns.
import { useEffect, useMemo, useState } from 'react'
import { addDays, format, getISOWeek, getISOWeekYear, setISOWeek, startOfISOWeek } from 'date-fns'
import { MousePointerClick } from 'lucide-react'
import { setValue, useCanEdit, useStore } from '../lib/store'
import type { Column, Item } from '../lib/types'
import { PopCell } from './cells'
import { cx } from './ui'

type P = { col: Column; item: Item }
const FIELD = 'h-8 w-full rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent'
const EMPTY = 'block h-full w-full'

// ---------- hour ----------
export function HourCell({ col, item }: P) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  return (
    <input
      type="time"
      aria-label={col.title}
      value={v}
      onChange={(e) => setValue(item.id, col.id, e.target.value)}
      className="h-full w-full bg-transparent px-3 font-mono text-[13px] text-fg outline-none hover:bg-hover focus:ring-2 focus:ring-inset focus:ring-accent [&:not(:focus)]:[color-scheme:inherit]"
    />
  )
}

// ---------- week: stored as "2026-W47" ----------
export function weekRange(v: string): [Date, Date] | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(v)
  if (!m) return null
  const start = startOfISOWeek(setISOWeek(new Date(Number(m[1]), 5, 1), Number(m[2])))
  return [start, addDays(start, 6)]
}
const weekOf = (d: Date) => `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`

export function WeekCell({ col, item }: P) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  const r = weekRange(v)
  return (
    <PopCell
      width={240}
      className="px-3 hover:bg-hover"
      pop={(close) => (
        <div className="grid gap-2 p-1">
          <label className="caps text-[12px] font-semibold tracking-[0.12em] text-muted" htmlFor={`wk-${item.id}`}>
            Any day in the week
          </label>
          <input id={`wk-${item.id}`} type="date" className={FIELD} onChange={(e) => e.target.value && (setValue(item.id, col.id, weekOf(new Date(e.target.value))), close())} />
          <div className="flex gap-1">
            <button className="h-7 flex-1 rounded-md border border-line text-[12.5px] hover:bg-hover" onClick={() => (setValue(item.id, col.id, weekOf(new Date())), close())}>
              This week
            </button>
            <button className="h-7 flex-1 rounded-md border border-line text-[12.5px] hover:bg-hover" onClick={() => (setValue(item.id, col.id, weekOf(addDays(new Date(), 7))), close())}>
              Next week
            </button>
            {v && (
              <button className="h-7 rounded-md px-2 text-[12.5px] text-muted hover:bg-hover" onClick={() => (setValue(item.id, col.id, ''), close())}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    >
      {r ? (
        <span className="block truncate text-left font-mono text-[12.5px]">
          <span className="font-semibold">W{v.split('-W')[1]}</span> <span className="text-muted">{format(r[0], 'd MMM').toUpperCase()}–{format(r[1], 'd MMM').toUpperCase()}</span>
        </span>
      ) : (
        <span className={EMPTY} />
      )}
    </PopCell>
  )
}

// ---------- country: ISO 3166 code ----------
const REGIONS = (() => {
  const names = new Intl.DisplayNames(undefined, { type: 'region' })
  const out: { code: string; name: string }[] = []
  for (let a = 65; a <= 90; a++)
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      const name = names.of(code)
      if (name && name !== code) out.push({ code, name })
    }
  return out.sort((x, y) => x.name.localeCompare(y.name))
})()
export const countryName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? code

export function CountryCell({ col, item }: P) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  const [q, setQ] = useState('')
  const hits = useMemo(() => REGIONS.filter((r) => (r.name + ' ' + r.code).toLowerCase().includes(q.toLowerCase())).slice(0, 60), [q])
  return (
    <PopCell
      width={260}
      className="px-3 hover:bg-hover"
      pop={(close) => (
        <div>
          <input autoFocus aria-label="Find a country" placeholder="Find a country" value={q} onChange={(e) => setQ(e.target.value)} className={cx(FIELD, 'mb-1')} />
          <ul className="max-h-60 overflow-auto">
            {hits.map((r) => (
              <li key={r.code}>
                <button onClick={() => (setValue(item.id, col.id, r.code), setQ(''), close())} className={cx('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover', r.code === v && 'bg-hover font-medium')}>
                  <span className="w-6 font-mono text-[11.5px] text-faint">{r.code}</span>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    >
      {v ? (
        <span className="flex items-center gap-2 truncate text-left text-[13.5px]">
          <span className="rounded-sm border border-line-strong px-1 font-mono text-[11px] font-semibold">{v}</span>
          <span className="truncate">{countryName(v)}</span>
        </span>
      ) : (
        <span className={EMPTY} />
      )}
    </PopCell>
  )
}

// ---------- world clock: IANA time zone, shows the live local time ----------
const ZONES: string[] = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo']
const useMinute = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}
export const clockIn = (zone: string, at = new Date()) => {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  } catch {
    return ''
  }
}

export function WorldClockCell({ col, item }: P) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  const now = useMinute()
  const [q, setQ] = useState('')
  const hits = useMemo(() => ZONES.filter((z) => z.toLowerCase().replace(/_/g, ' ').includes(q.toLowerCase())).slice(0, 80), [q])
  return (
    <PopCell
      width={280}
      className="px-3 hover:bg-hover"
      pop={(close) => (
        <div>
          <input autoFocus aria-label="Find a city or time zone" placeholder="City or time zone" value={q} onChange={(e) => setQ(e.target.value)} className={cx(FIELD, 'mb-1')} />
          <ul className="max-h-60 overflow-auto">
            {hits.map((z) => (
              <li key={z}>
                <button onClick={() => (setValue(item.id, col.id, z), setQ(''), close())} className={cx('flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] hover:bg-hover', z === v && 'bg-hover font-medium')}>
                  <span className="truncate">{z.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-[12px] text-faint">{clockIn(z, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    >
      {v ? (
        <span className="flex items-center justify-between gap-2 text-left" title={v}>
          <span className="truncate text-[13px] text-muted">{v.split('/').pop()!.replace(/_/g, ' ')}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums">{clockIn(v, now)}</span>
        </span>
      ) : (
        <span className={EMPTY} />
      )}
    </PopCell>
  )
}

// ---------- colour ----------
export function ColorCell({ col, item }: P) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  const editable = useCanEdit()
  return (
    <label className={cx('flex h-full w-full items-center gap-2 px-3', editable && 'cursor-pointer hover:bg-hover')}>
      <input type="color" aria-label={col.title} disabled={!editable} value={v || '#121212'} onChange={(e) => setValue(item.id, col.id, e.target.value)} className="sr-only" />
      {v ? (
        <>
          <span className="size-4 shrink-0 rounded-sm border border-line-strong" style={{ background: v }} />
          <span className="font-mono text-[12px] uppercase text-muted">{v}</span>
        </>
      ) : null}
    </label>
  )
}

// ---------- button: a click stamps the time, so "When column changes" automations run on it ----------
export function ButtonCell({ col, item }: P) {
  const last = item.values[col.id] as number | undefined
  const by = useStore((s) => s.user[item.updatedBy ?? ''])
  return (
    <div className="flex h-full items-center px-2" title={last ? `Last clicked ${format(last, 'd MMM, HH:mm')}${by ? ' by ' + by.name : ''}` : undefined}>
      <button
        onClick={() => setValue(item.id, col.id, Date.now())}
        className="flex h-7 max-w-full items-center gap-1.5 truncate rounded-md bg-ink px-2.5 text-[12.5px] font-semibold text-on-ink transition-colors hover:bg-ink/85 active:translate-y-px dark:bg-signal dark:text-on-signal"
      >
        <MousePointerClick className="size-3.5 shrink-0" />
        {col.title}
      </button>
    </div>
  )
}

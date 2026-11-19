import { useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { ChartColumnBig } from 'lucide-react'
import { openItem, useStore } from '../lib/store'
import { useViewSetting } from '../lib/filters'
import type { Board, Item, View } from '../lib/types'
import { Avatar, Popover, cx } from '../components/ui'
import { fmtNumber } from '../components/cells'
import { EmptyView } from './KanbanView'

const WEEKS = 8
const sel = 'h-8 rounded-md border border-line bg-panel px-2 text-[13.5px] text-fg outline-none focus:border-accent'
const GRID = (n: number) => ({ gridTemplateColumns: `220px repeat(${n}, 96px)` })
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function rangeOf(v: unknown): [string, string] | null {
  if (typeof v === 'string' && v) return [v, v]
  const r = v as { start?: string; end?: string } | null
  return r?.start ? [r.start, r.end ?? r.start] : null
}

/** People x next 8 weeks; each cell sums a number column (or counts items) dated in that week. */
export function WorkloadView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const users = useStore((s) => s.user)
  const [peopleId, setPeople] = useViewSetting(board, view, 'columnId')
  const [dateId, setDate] = useViewSetting(board, view, 'dateColumnId')
  const [valueId, setValueCol] = useViewSetting(board, view, 'valueColumnId')
  const [capacity, setCapacity] = useViewSetting(board, view, 'capacity')
  const [open, setOpen] = useState<{ el: HTMLElement; list: Item[]; title: string } | null>(null)

  const peopleCols = board.columns.filter((c) => c.type === 'people')
  const dateCols = board.columns.filter((c) => c.type === 'date' || c.type === 'timeline')
  const numCols = board.columns.filter((c) => c.type === 'number')
  const pc = peopleCols.find((c) => c.id === peopleId) ?? peopleCols[0]
  const dc = dateCols.find((c) => c.id === dateId) ?? dateCols[0]
  const vc = numCols.find((c) => c.id === valueId)
  const cap = capacity && capacity > 0 ? capacity : 5

  const weeks = useMemo(() => {
    const first = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = addDays(first, i * 7)
      return { start: iso(start), end: iso(addDays(start, 6)), label: format(start, 'MMM d'), stamp: format(start, 'dd MMM').toUpperCase() }
    })
  }, [])

  const rows = useMemo(() => {
    if (!pc || !dc) return []
    const m = new Map<string, Item[][]>()
    for (const it of items) {
      const r = rangeOf(it.values[dc.id])
      if (!r) continue
      for (const u of (it.values[pc.id] as string[]) ?? []) {
        if (!m.has(u)) m.set(u, weeks.map(() => []))
        weeks.forEach((w, wi) => r[0] <= w.end && r[1] >= w.start && m.get(u)![wi].push(it))
      }
    }
    return [...m.entries()].filter(([u]) => users[u]).sort((a, b) => users[a[0]].name.localeCompare(users[b[0]].name))
  }, [items, pc, dc, weeks, users])

  const load = (list: Item[]) => (vc ? list.reduce((s, i) => s + (Number(i.values[vc.id]) || 0), 0) : list.length)

  if (!pc || !dc)
    return (
      <EmptyView icon={<ChartColumnBig />} title="Workload needs people and dates">
        Add a People column and a Date or Timeline column to see who is loaded each week.
      </EmptyView>
    )

  return (
    <div className="h-full overflow-auto px-6 pt-4 pb-16">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted">
        <label className="flex items-center gap-1.5">
          People
          <select aria-label="People column" className={sel} value={pc.id} onChange={(e) => setPeople(e.target.value)}>
            {peopleCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Date
          <select aria-label="Date column" className={sel} value={dc.id} onChange={(e) => setDate(e.target.value)}>
            {dateCols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Measure
          <select aria-label="Measure" className={sel} value={vc?.id ?? ''} onChange={(e) => setValueCol(e.target.value || undefined)}>
            <option value="">Item count</option>
            {numCols.map((c) => <option key={c.id} value={c.id}>Sum of {c.title}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Capacity / week
          <input aria-label="Capacity per week" type="number" min={1} className={sel + ' w-20'} defaultValue={cap} onBlur={(e) => Number(e.target.value) > 0 && setCapacity(Number(e.target.value))} />
        </label>
      </div>

      <div className="w-max min-w-full overflow-hidden rounded-lg border border-line bg-panel">
        <div className="grid border-b-2 border-fg" style={GRID(WEEKS)}>
          <div className="caps px-3 pt-2.5 pb-1.5 text-[13px] font-bold tracking-[0.14em] text-fg">Person</div>
          {weeks.map((w, wi) => (
            <div key={w.start} className={cx('border-l border-line px-2 pt-2.5 pb-1.5 text-center font-mono text-[12px] tabular-nums', wi === 0 ? 'font-semibold text-fg' : 'text-muted')}>
              {w.stamp}
            </div>
          ))}
        </div>
        {rows.map(([u, cells]) => (
          <div key={u} className="grid border-b border-line last:border-b-0" style={GRID(WEEKS)}>
            <div className="flex items-center gap-2 px-3 py-2 text-[13.5px]">
              <Avatar user={users[u]} size={22} /> <span className="truncate">{users[u].name}</span>
            </div>
            {cells.map((list, wi) => {
              const n = load(list)
              const ratio = n / cap
              const over = ratio > 1
              // shade runs paper -> ink with load; text flips to paper once the ground passes mid-tone
              const mix = Math.round(Math.min(ratio, 1) * 80)
              return (
                <button
                  key={wi}
                  disabled={!list.length}
                  onClick={(e) => setOpen({ el: e.currentTarget, list, title: `${users[u].name} · week of ${weeks[wi].label}` })}
                  title={`${vc ? fmtNumber(n, vc.unit) : n} of ${cap}`}
                  aria-label={`${users[u].name}, week of ${weeks[wi].label}: ${vc ? fmtNumber(n, vc.unit) : n} of ${cap}${over ? ', over capacity' : ''}`}
                  className={cx(
                    'grid h-11 place-items-center border-l border-line font-mono text-[13px] font-medium tabular-nums transition-[filter] enabled:hover:brightness-95 disabled:cursor-default',
                    over ? 'bg-alert-soft font-semibold text-alert' : n && mix >= 52 ? 'text-bg' : 'text-fg',
                  )}
                  style={n && !over ? { background: `color-mix(in oklab, var(--fg) ${mix}%, var(--bg))` } : undefined}
                >
                  {n ? (vc ? fmtNumber(n, vc.unit) : n) : ''}
                </button>
              )
            })}
          </div>
        ))}
        {!rows.length && <p className="p-6 text-[13.5px] text-muted">No assigned items are dated in the next {WEEKS} weeks.</p>}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          Load
          <span aria-hidden className="flex border border-line">
            {[0, 20, 40, 60, 80].map((m) => (
              <span key={m} className="h-2.5 w-3" style={{ background: `color-mix(in oklab, var(--fg) ${m}%, var(--bg))` }} />
            ))}
          </span>
          capacity
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[1px] bg-alert" />
          over capacity
        </span>
        <span className="text-faint">Items spanning several weeks count in each.</span>
      </p>

      <Popover anchor={open?.el ?? null} open={!!open} onClose={() => setOpen(null)} width={280}>
        <div className="caps mx-1.5 mb-1 border-b-2 border-fg pt-1 pb-1 text-[13px] font-bold tracking-[0.1em] text-fg">{open?.title}</div>
        {open?.list.map((i) => (
          <button key={i.id} onClick={() => (openItem(i.id), setOpen(null))} className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] hover:bg-hover">
            <span className="truncate">{i.name}</span>
            {vc && <span className="font-mono text-[12px] text-muted">{fmtNumber(Number(i.values[vc.id]) || 0, vc.unit)}</span>}
          </button>
        ))}
      </Popover>
    </div>
  )
}

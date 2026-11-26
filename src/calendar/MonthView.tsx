import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { addDays, dayDiff, lanes, type Occ } from '../lib/calendar'
import { cx } from '../components/ui'
import { cellAt, fmtDay, fmtTime, mine, occId, pressable, tint, track, type CalApi } from './parts'

const HEAD = 28 // day number strip
const LANE = 22

/** Six weeks of the month; events run as bars across the days they cover, timed ones as a dot, time and title. */
export function MonthView({ days, month, occs, today, api }: { days: string[]; month: string; occs: Occ[]; today: string; api: CalApi }) {
  const box = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(110)
  const [moving, setMoving] = useState<{ id: string; day: string } | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setRowH(Math.max(84, (el.clientHeight - 24) / 6)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fit = Math.max(1, Math.floor((rowH - HEAD - 4) / LANE)) // lanes that fit in a cell

  const weeks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, w) => {
        const wd = days.slice(w * 7, w * 7 + 7)
        const bars = lanes(
          occs
            .map((o) => ({ o, first: Math.max(0, dayDiff(o.start, wd[0])), last: Math.min(6, dayDiff(lastDay(o), wd[0])) }))
            .filter((b) => b.last >= 0 && b.first <= 6 && b.first <= b.last),
        )
        return { wd, bars }
      }),
    [days, occs],
  )

  const down = (e: React.PointerEvent<HTMLElement>, o: Occ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget
    const id = occId(o)
    const from = cellAt(e.nativeEvent, 'day')?.day ?? o.start.slice(0, 10)
    let to = from
    track(
      e,
      (ev) => {
        if (!mine(o, api)) return
        const at = cellAt(ev, 'day')
        if (at) setMoving({ id, day: (to = at.day) })
      },
      (_, moved) => {
        setMoving(null)
        if (!moved) return api.open(o, el)
        const shift = dayDiff(to, from)
        if (shift) api.move(o, shiftDate(o.start, shift), shiftDate(o.end, shift))
      },
    )
  }

  return (
    <div ref={box} className="flex min-h-0 flex-1 select-none flex-col overflow-hidden bg-panel">
      <div className="grid grid-cols-7 border-b-2 border-fg bg-bg">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1.5 text-center font-mono text-[11px] font-medium uppercase text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map(({ wd, bars }) => {
          const cap = bars.some((b) => b.lane >= fit) ? fit - 1 : fit // keep a lane for "+n more"
          const hidden = wd.map((_, i) => bars.filter((b) => b.lane >= cap && b.first <= i && b.last >= i).length)
          return (
            <div key={wd[0]} className="relative grid grid-cols-7 border-b border-line">
              {wd.map((d, i) => {
                const out = d.slice(0, 7) !== month.slice(0, 7)
                return (
                  <div
                    key={d}
                    data-day={d}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || api.busy || !api.canCreate || e.target !== e.currentTarget) return
                      track(e, () => {}, () => api.create(d + 'T00:00', d + 'T23:59', true))
                    }}
                    className={cx('relative border-l border-line first:border-l-0', out && 'bg-panel-2/70', moving?.day === d && 'bg-accent-soft', api.canCreate && 'cursor-cell')}
                  >
                    <button
                      onClick={() => api.goDay(d)}
                      title="Open this day"
                      className={cx(
                        'absolute left-1.5 top-1 grid h-6 min-w-6 place-items-center rounded-md px-1 font-mono text-[12.5px] font-semibold transition-colors',
                        d === today ? 'bg-ink text-on-ink dark:bg-signal dark:text-on-signal' : out ? 'text-faint hover:bg-hover' : 'text-fg hover:bg-hover',
                      )}
                    >
                      {+d.slice(8) === 1 ? fmtDay(d, 'd MMM') : +d.slice(8)}
                    </button>
                    {hidden[i] > 0 && (
                      <button
                        onClick={() => api.goDay(d)}
                        className="absolute left-1 right-1 h-5 rounded-sm px-1 text-left font-mono text-[11px] font-medium text-muted hover:bg-hover hover:text-fg"
                        style={{ top: HEAD + cap * LANE }}
                      >
                        +{hidden[i]} more
                      </button>
                    )}
                  </div>
                )
              })}
              {bars
                .filter((b) => b.lane < cap)
                .map(({ o, first, last, lane }) => {
                  const c = api.colors[o.ev.ownerId] ?? '#8a8a84'
                  const id = occId(o)
                  const bar = o.ev.allDay || last > first
                  return (
                    <div
                      key={id}
                      {...pressable((el) => api.open(o, el))}
                      onPointerDown={(e) => down(e, o)}
                      className={cx(
                        'absolute flex h-5 min-w-0 items-center gap-1 truncate rounded-sm px-1.5 text-[12px] text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        bar ? 'border-l-[3px] font-semibold' : 'hover:bg-hover',
                        mine(o, api) ? 'cursor-grab' : 'cursor-pointer',
                        moving?.id === id && 'opacity-40',
                        api.selected === id && 'ring-2 ring-accent',
                      )}
                      style={{
                        top: HEAD + lane * LANE,
                        left: `calc(${(first / 7) * 100}% + 3px)`,
                        width: `calc(${((last - first + 1) / 7) * 100}% - 6px)`,
                        ...(bar ? { background: tint(c), borderLeftColor: c } : {}),
                      }}
                    >
                      {!bar && <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: c }} />}
                      {!o.ev.allDay && <span className="shrink-0 font-mono text-[11px] text-muted">{fmtTime(o.start)}</span>}
                      <span className="truncate">{o.ev.title}</span>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The last date an occurrence shows on: a timed one ending at 00:00 belongs to the day before. */
const lastDay = (o: Occ) => (!o.ev.allDay && o.end > o.start && o.end.slice(11) === '00:00' ? addDays(o.end, -1) : o.end)
const shiftDate = (wall: string, n: number) => addDays(wall, n) + wall.slice(10)

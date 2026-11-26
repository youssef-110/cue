import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import { addDays, atMinutes, dayDiff, layoutDay, lanes, minutesOf, segment, shiftWall, snap, wallDiff, weekday, type Occ } from '../lib/calendar'
import { cx } from '../components/ui'
import { HOUR, cellAt, fmtDay, fmtTime, mine, occId, pressable, tint, track, type CalApi } from './parts'

type Drag =
  | { kind: 'create'; day: string; a: number; b: number }
  | { kind: 'move' | 'resize'; id: string; allDay?: boolean; start: string; end: string }

const GUTTER = 56

/** Day and week views: an all-day row over a 24-hour grid with half-hour rules, a now line, and side-by-side overlaps. */
export function TimeGrid({ days, occs, today, now, api }: { days: string[]; occs: Occ[]; today: string; now: string; api: CalApi }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const cols = `${GUTTER}px repeat(${days.length}, minmax(0, 1fr))`
  const showsToday = days.includes(today)

  // open on the working day: two hours before now when today is shown, else 07:00
  const first = days[0]
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = ((showsToday ? Math.max(0, minutesOf(now) - 120) : 7 * 60) / 60) * HOUR
    // only when the shown dates change, not on every tick of the clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, days.length])

  const allDay = useMemo(
    () =>
      lanes(
        occs
          .filter((o) => o.ev.allDay)
          .map((o) => ({ o, first: Math.max(0, dayDiff(o.start, days[0])), last: Math.min(days.length - 1, dayDiff(o.end, days[0])) }))
          .filter((b) => b.last >= 0 && b.first < days.length),
      ),
    [occs, days],
  )
  const rows = allDay.reduce((n, b) => Math.max(n, b.lane + 1), 0)
  const timed = occs.filter((o) => !o.ev.allDay)

  // ---------- pointer gestures ----------
  const createDown = (e: React.PointerEvent<HTMLDivElement>, day: string) => {
    if (e.button !== 0 || api.busy || !api.canCreate || e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const a = Math.floor((((e.clientY - r.top) / HOUR) * 60) / 15) * 15
    let b = a
    track(
      e,
      (ev) => {
        const at = cellAt(ev, 'col')
        if (!at) return
        b = snap(at.day === day ? at.min : at.day > day ? 1440 : 0)
        setDrag({ kind: 'create', day, a, b })
      },
      (_, moved) => {
        setDrag(null)
        const lo = Math.min(a, b)
        const hi = Math.max(a, b)
        if (moved) return api.create(atMinutes(day, lo), atMinutes(day, hi > lo ? hi : lo + 15))
        const start = Math.min(Math.floor(a / 30) * 30, 1380)
        api.create(atMinutes(day, start), atMinutes(day, start + 60)) // a click: one hour from the half hour
      },
    )
  }

  const eventDown = (e: React.PointerEvent<HTMLElement>, o: Occ, resize = false) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget.closest<HTMLElement>('[data-occ]') ?? e.currentTarget
    const id = occId(o)
    const canDrag = mine(o, api)
    const down = cellAt(e.nativeEvent, o.ev.allDay ? 'day' : 'col')
    const grab = down && !o.ev.allDay ? wallDiff(atMinutes(down.day, down.min), o.start) : 0
    const grabDays = down && o.ev.allDay ? dayDiff(down.day, o.start) : 0
    let last: Drag | null = null
    track(
      e,
      (ev) => {
        if (!canDrag) return
        let next: Drag | null = null
        if (o.ev.allDay) {
          const at = cellAt(ev, 'day')
          if (at) {
            const start = addDays(at.day, -grabDays)
            next = { kind: 'move', id, allDay: true, start: start + 'T00:00', end: addDays(start, dayDiff(o.end, o.start)) + 'T23:59' }
          }
        } else {
          const at = cellAt(ev, 'col')
          if (!at) return
          if (resize) {
            const end = atMinutes(at.day, snap(at.min))
            next = { kind: 'resize', id, start: o.start, end: end > shiftWall(o.start, 15) ? end : shiftWall(o.start, 15) }
          } else {
            const raw = shiftWall(atMinutes(at.day, at.min), -grab)
            const start = atMinutes(raw, Math.min(1425, Math.max(0, snap(minutesOf(raw)))))
            next = { kind: 'move', id, start, end: shiftWall(start, wallDiff(o.end, o.start)) }
          }
        }
        last = next
        setDrag(next)
      },
      (_, moved) => {
        setDrag(null)
        if (!moved || !last || last.kind === 'create') return api.open(o, el)
        if (last.start !== o.start || last.end !== o.end) api.move(o, last.start, last.end)
      },
    )
  }

  // ---------- rendering ----------
  const preview = drag && drag.kind !== 'create' ? drag : null
  const block = (o: Occ, day: string, seg: { top: number; bottom: number }, place: { col: number; cols: number } | null, ghost = false) => {
    const c = api.colors[o.ev.ownerId] ?? '#8a8a84'
    const id = occId(o)
    const h = Math.max(((seg.bottom - seg.top) / 60) * HOUR, 18)
    const tall = h >= 40
    const own = mine(o, api)
    const start = ghost && preview ? preview.start : o.start
    const end = ghost && preview ? preview.end : o.end
    return (
      <div
        key={`${id}${ghost ? ':ghost' : ''}`}
        data-occ={ghost ? undefined : id}
        {...(ghost ? {} : pressable((el) => api.open(o, el)))}
        aria-label={ghost ? undefined : `${o.ev.title}, ${fmtDay(o.start)} ${fmtTime(o.start)} to ${fmtTime(o.end)}, ${api.users[o.ev.ownerId]?.name ?? ''}`}
        onPointerDown={ghost ? undefined : (e) => eventDown(e, o)}
        className={cx(
          'group absolute overflow-hidden rounded-sm border-l-[3px] px-1.5 text-left text-fg outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-accent',
          own ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
          ghost && 'pointer-events-none z-30 shadow-pop',
          !ghost && preview?.id === id && 'opacity-40',
          api.selected === id && 'z-20 ring-2 ring-accent',
        )}
        style={{
          top: (seg.top / 60) * HOUR + 1,
          height: h - 2,
          left: place ? `calc(${(place.col / place.cols) * 100}% + 2px)` : 2,
          width: place ? `calc(${100 / place.cols}% - 4px)` : 'calc(100% - 4px)',
          background: ghost ? tint(c, true) : tint(c),
          borderLeftColor: c,
        }}
      >
        <div className={cx('flex min-w-0 gap-1', tall ? 'flex-col pt-1' : 'items-center pt-px')}>
          <span className={cx('min-w-0 text-[12.5px] font-semibold leading-tight', tall ? 'line-clamp-2' : 'truncate')}>
            {o.ev.repeat?.days.length ? <Repeat aria-hidden className="mb-px mr-1 inline size-3 text-muted" /> : null}
            {o.ev.title}
          </span>
          <span className="shrink-0 font-mono text-[11px] leading-none text-muted">
            {fmtTime(start)}
            {tall && `–${fmtTime(end)}`}
          </span>
          {tall && h >= 64 && o.ev.location && <span className="truncate text-[11.5px] leading-none text-muted">{o.ev.location}</span>}
        </div>
        {own && !ghost && seg.bottom === minutesOf(o.end) && day === o.end.slice(0, 10) && (
          <span
            aria-hidden
            onPointerDown={(e) => eventDown(e, o, true)}
            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-current after:opacity-0 group-hover:after:opacity-40"
          />
        )}
      </div>
    )
  }

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 select-none overflow-y-auto overscroll-contain bg-panel">
      {/* day names + all-day row stay on top while the hours scroll */}
      <div className="sticky top-0 z-40 border-b-2 border-fg bg-bg">
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const isToday = d === today
            return (
              <button
                key={d}
                onClick={() => api.goDay(d)}
                title={`Open ${fmtDay(d, 'EEEE d MMMM')}`}
                className="flex min-w-0 items-end justify-center gap-1.5 px-1 pb-1.5 pt-2 font-mono transition-colors hover:bg-hover"
              >
                <span className={cx('text-[11px] font-medium uppercase', isToday ? 'text-fg' : 'text-faint')}>{fmtDay(d, 'EEE')}</span>
                <span
                  className={cx(
                    'grid h-7 min-w-7 place-items-center rounded-md px-1 text-[17px] font-semibold leading-none',
                    isToday ? 'bg-ink text-on-ink dark:bg-signal dark:text-on-signal' : d < today ? 'text-muted' : 'text-fg',
                  )}
                >
                  {+d.slice(8)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="grid border-t border-line" style={{ gridTemplateColumns: cols }}>
          <div className="caps flex items-start justify-end pr-2 pt-1.5 text-[10.5px] font-semibold tracking-[0.1em] text-faint">All day</div>
          <div className="relative" style={{ gridColumn: `2 / span ${days.length}`, height: Math.max(1, rows) * 24 + 6 }}>
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => (
                <div
                  key={d}
                  data-day={d}
                  onPointerDown={(e) => {
                    if (e.button !== 0 || api.busy || !api.canCreate || e.target !== e.currentTarget) return
                    track(e, () => {}, () => api.create(d + 'T00:00', d + 'T23:59', true))
                  }}
                  className={cx('border-l border-line', api.canCreate && 'cursor-cell')}
                />
              ))}
            </div>
            {allDay.map(({ o, first: f, last: l, lane }) => {
              const c = api.colors[o.ev.ownerId] ?? '#8a8a84'
              const id = occId(o)
              const moving = preview?.id === id ? preview : null
              const pf = moving ? dayDiff(moving.start, days[0]) : f
              const pl = moving ? dayDiff(moving.end, days[0]) : l
              return (
                <div
                  key={id}
                  data-occ={id}
                  {...pressable((el) => api.open(o, el))}
                  onPointerDown={(e) => eventDown(e, o)}
                  className={cx(
                    'absolute flex h-[22px] items-center truncate rounded-sm border-l-[3px] px-1.5 text-[12.5px] font-semibold text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    mine(o, api) ? 'cursor-grab' : 'cursor-pointer',
                    moving && 'z-10 shadow-pop',
                    api.selected === id && 'ring-2 ring-accent',
                  )}
                  style={{
                    top: lane * 24 + 3,
                    left: `calc(${(Math.max(0, pf) / days.length) * 100}% + 2px)`,
                    width: `calc(${((Math.min(days.length - 1, pl) - Math.max(0, pf) + 1) / days.length) * 100}% - 4px)`,
                    background: tint(c, !!moving),
                    borderLeftColor: c,
                  }}
                >
                  {o.ev.title}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* the hours */}
      <div className="relative grid" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
        <div className="relative">
          {Array.from({ length: 23 }, (_, i) => (
            <span key={i} className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-faint" style={{ top: (i + 1) * HOUR }}>
              {String(i + 1).padStart(2, '0')}:00
            </span>
          ))}
          {showsToday && (
            <span
              className="absolute right-1 z-10 -translate-y-1/2 rounded-sm bg-ink px-1 py-0.5 font-mono text-[11px] font-semibold leading-none text-on-ink dark:bg-signal dark:text-on-signal"
              style={{ top: (minutesOf(now) / 60) * HOUR }}
            >
              {fmtTime(now)}
            </span>
          )}
        </div>
        {days.map((d) => {
          const placed = layoutDay(
            timed.flatMap((o) => {
              const seg = segment(o, d)
              return seg ? [{ o, ...seg }] : []
            }),
          )
          const ghosts = preview && !preview.allDay ? timed.filter((o) => occId(o) === preview.id).flatMap((o) => {
            const seg = segment(preview, d)
            return seg ? [block(o, d, seg, null, true)] : []
          }) : []
          const weekend = [0, 6].includes(weekday(d))
          return (
            <div
              key={d}
              data-col={d}
              onPointerDown={(e) => createDown(e, d)}
              className={cx('relative border-l border-line', weekend && 'bg-panel-2/60', api.canCreate && 'cursor-cell')}
              style={{
                backgroundImage: `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--line) 55%, transparent) 1px, transparent 1px)`,
                backgroundSize: `100% ${HOUR}px, 100% ${HOUR / 2}px`,
              }}
            >
              {placed.map(({ o, top, bottom, col, cols: n }) => block(o, d, { top, bottom }, { col, cols: n }))}
              {ghosts}
              {drag?.kind === 'create' && drag.day === d && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-30 rounded-sm border-l-[3px] border-accent bg-accent-soft px-1.5 pt-1 font-mono text-[11px] font-semibold text-accent shadow-pop"
                  style={{ top: (Math.min(drag.a, drag.b) / 60) * HOUR + 1, height: Math.max(15, Math.abs(drag.b - drag.a)) / 60 * HOUR - 2 }}
                >
                  {fmtTime(atMinutes(d, Math.min(drag.a, drag.b)))} – {fmtTime(atMinutes(d, Math.max(drag.a, drag.b, Math.min(drag.a, drag.b) + 15)))}
                </div>
              )}
              {d === today && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-fg" style={{ top: (minutesOf(now) / 60) * HOUR - 1 }}>
                  <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-fg" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

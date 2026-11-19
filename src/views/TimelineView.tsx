import { Fragment, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addDays, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, format, isWeekend, max as maxDate, min as minDate, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarPlus, ChartGantt, ChevronRight, LocateFixed } from 'lucide-react'
import { addColumn, canEdit, labelOf, openItem, setValue, updateBoard, useStore } from '../lib/store'
import { inkOn } from '../lib/seed'
import type { Board, Column, Item, View } from '../lib/types'
import { Avatar, Button, cx } from '../components/ui'
import { dependenciesOf } from '../components/cellsExtra'
import { ColumnPicker, EmptyView } from './KanbanView'

type Zoom = 'day' | 'week' | 'month'
type Range = { start: string; end: string }
type DragMode = 'move' | 'start' | 'end'

const PPD: Record<Zoom, number> = { day: 40, week: 18, month: 5 } // pixels per day
const PAD: Record<Zoom, number> = { day: 14, week: 35, month: 120 } // days of air around the data
const LEFT_W = 272
const ROW_H = 40
const GROUP_H = 40
const GAP_H = 8 // spacer under each group
const HEAD_H = 56
const DIAMOND = 16
const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const stamp = (d: Date) => format(d, 'EEE dd MMM').toUpperCase()

function rangeOf(col: Column, v: unknown): Range | undefined {
  if (col.type === 'timeline') {
    const r = v as Partial<Range> | undefined
    if (!r?.start) return undefined
    return { start: r.start, end: r.end && r.end >= r.start ? r.end : r.start }
  }
  return typeof v === 'string' && v ? { start: v, end: v } : undefined
}

export function TimelineView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const users = useStore((s) => s.user)
  const [zoom, setZoom] = useState<Zoom>('day')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<{ id: string; range: Range } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const dateCols = board.columns.filter((c) => c.type === 'timeline' || c.type === 'date')
  const col = dateCols.find((c) => c.id === view.columnId) ?? dateCols.find((c) => c.type === 'timeline') ?? dateCols[0]
  const ppd = PPD[zoom]
  const todayD = new Date()
  const todayIso = iso(todayD)

  // Visible window: all scheduled work + today, padded and aligned to the zoom's unit.
  const ranges = col ? items.map((it) => rangeOf(col, it.values[col.id])).filter((r): r is Range => !!r) : []
  const lo = minDate([todayD, ...ranges.map((r) => parseISO(r.start))])
  const hi = maxDate([todayD, ...ranges.map((r) => parseISO(r.end))])
  const start = zoom === 'month' ? startOfMonth(addDays(lo, -PAD[zoom])) : startOfWeek(addDays(lo, -PAD[zoom]), { weekStartsOn: 1 })
  const days = Math.max(differenceInCalendarDays(hi, start) + PAD[zoom], Math.ceil(2400 / ppd))
  const end = addDays(start, days - 1)
  const totalW = days * ppd
  const x = (d: string) => differenceInCalendarDays(parseISO(d), start) * ppd
  const todayX = differenceInCalendarDays(todayD, start) * ppd

  const centerToday = (behavior: ScrollBehavior) => {
    const el = scroller.current
    if (el) el.scrollTo({ left: todayX + ppd / 2 - (el.clientWidth - LEFT_W) / 2, behavior })
  }
  // Re-center on today when the zoom or column changes; keep the view still when the window grows to the left.
  const prev = useRef<{ zoom: Zoom; colId?: string; start: number }>(undefined)
  useLayoutEffect(() => {
    const p = prev.current
    const s = start.getTime()
    if (!p || p.zoom !== zoom || p.colId !== col?.id) centerToday('instant')
    else if (p.start !== s && scroller.current) scroller.current.scrollLeft += differenceInCalendarDays(p.start, s) * ppd
    prev.current = { zoom, colId: col?.id, start: s }
  })

  if (!col)
    return (
      <EmptyView icon={<ChartGantt />} title="Nothing to plot yet">
        The timeline draws items from a timeline or date column.{' '}
        <button
          className="font-medium text-accent hover:underline"
          onClick={() => {
            const c = addColumn(board.id, 'timeline')
            updateBoard(board.id, { views: useStore.getState().board[board.id].views.map((v) => (v.id === view.id ? { ...v, columnId: c.id } : v)) })
          }}
        >
          Add a timeline column
        </button>{' '}
        to start planning.
      </EmptyView>
    )

  const status = board.columns.find((c) => c.type === 'status')
  const people = board.columns.find((c) => c.type === 'people')
  const progress = board.columns.find((c) => c.type === 'progress')
  const editable = col.type === 'timeline'

  // ---------- drag (pointer events, snapped to days) ----------
  const startDrag = (e: ReactPointerEvent, it: Item, r: Range, mode: DragMode) => {
    if (!canEdit()) return
    if (e.button !== 0) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const x0 = e.clientX
    let moved = false
    let next = r
    const shift = (d: string, n: number) => iso(addDays(parseISO(d), n))
    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 3) moved = true
      if (!moved) return
      const n = Math.round((ev.clientX - x0) / ppd)
      next =
        mode === 'move'
          ? { start: shift(r.start, n), end: shift(r.end, n) }
          : mode === 'start'
            ? { start: minIso(shift(r.start, n), r.end), end: r.end }
            : { start: r.start, end: maxIso(shift(r.end, n), r.start) }
      setDrag({ id: it.id, range: next })
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!moved) return openItem(it.id)
      if (next.start !== r.start || next.end !== r.end) setValue(it.id, col.id, editable ? next : next.start)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const schedule = (it: Item) => setValue(it.id, col.id, editable ? { start: todayIso, end: iso(addDays(todayD, 2)) } : todayIso)

  // ---------- header ticks ----------
  const interval = { start, end }
  const top =
    zoom === 'month'
      ? eachMonthOfInterval(interval)
          .filter((d) => d.getMonth() % 3 === 0 || +d === +start)
          .map((d) => ({ d, label: `Q${Math.floor(d.getMonth() / 3) + 1} ${format(d, 'yyyy')}` }))
      : eachMonthOfInterval(interval).map((d) => ({ d: maxDate([d, start]), label: format(d, 'MMMM yyyy') }))
  const bottom =
    zoom === 'day'
      ? eachDayOfInterval(interval).map((d) => ({ d, label: format(d, 'dd'), sub: format(d, 'EEEEE') }))
      : zoom === 'week'
        ? eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((d) => ({ d, label: format(d, 'dd MMM').toUpperCase(), sub: '' }))
        : eachMonthOfInterval(interval).map((d) => ({ d, label: format(d, 'MMM').toUpperCase(), sub: '' }))
  const unitW = zoom === 'day' ? ppd : zoom === 'week' ? 7 * ppd : 0

  // ---------- rows ----------
  const groups = board.groups.map((g) => ({ g, items: items.filter((i) => i.groupId === g.id) })).filter((x) => x.items.length)
  const unscheduled = items.filter((i) => !rangeOf(col, i.values[col.id])).length
  const isDone = (it: Item) => !!(status && labelOf(status, it.values[status.id])?.done)
  const lateDays = (it: Item, r: Range) => (isDone(it) || r.end >= todayIso ? 0 : differenceInCalendarDays(todayD, parseISO(r.end)))
  const barWidth = (r: Range) => (differenceInCalendarDays(parseISO(r.end), parseISO(r.start)) + 1) * ppd

  // Where each visible bar sits, for dependency connectors (mirrors the row layout below).
  const pos = new Map<string, { y: number; x1: number; x2: number }>()
  let contentH = HEAD_H
  for (const { g, items: gItems } of groups) {
    contentH += GROUP_H
    if (!collapsed.has(g.id))
      for (const it of gItems) {
        const r = drag?.id === it.id ? drag.range : rangeOf(col, it.values[col.id])
        if (r) {
          const l = x(r.start)
          const w = barWidth(r)
          pos.set(it.id, editable ? { y: contentH + ROW_H / 2, x1: l, x2: l + Math.max(w, 6) } : { y: contentH + ROW_H / 2, x1: l + w / 2 - 6, x2: l + w / 2 + 6 })
        }
        contentH += ROW_H
      }
    contentH += GAP_H
  }
  const links = board.columns.some((c) => c.type === 'dependency')
    ? items.flatMap((it) => {
        const to = pos.get(it.id)
        return to ? dependenciesOf(it, board).flatMap((d) => (pos.has(d.id) ? [{ key: `${d.id}>${it.id}`, from: pos.get(d.id)!, to }] : [])) : []
      })
    : []

  // weekends on the paper tone (the grid starts on a Monday)
  const weekendShade = zoom === 'month' ? undefined : `repeating-linear-gradient(90deg, transparent 0 ${5 * ppd}px, var(--panel-2) ${5 * ppd}px ${7 * ppd}px)`

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-4 pb-3">
        <div role="radiogroup" aria-label="Zoom" className="relative flex rounded-md border border-line bg-panel p-0.5">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              role="radio"
              aria-checked={zoom === z}
              onClick={() => setZoom(z)}
              className={cx('caps relative h-7 rounded-sm px-3 text-[13px] font-semibold tracking-[0.1em] transition-colors', zoom === z ? 'text-bg' : 'text-muted hover:text-fg')}
            >
              {zoom === z && <motion.span layoutId={`tl-zoom-${view.id}`} className="absolute inset-0 rounded-sm bg-fg" transition={{ duration: 0.14, ease: 'easeOut' }} />}
              <span className="relative">{z}s</span>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => centerToday('smooth')}>
          <LocateFixed /> Today
        </Button>
        <p className="ml-1 hidden text-[13px] text-muted sm:block">
          <span className="font-mono font-medium text-fg tabular-nums">{items.length - unscheduled}</span> scheduled
          {unscheduled > 0 && (
            <>
              {' '}· <span className="font-mono font-medium text-fg tabular-nums">{unscheduled}</span> without dates
            </>
          )}
        </p>
        <span className="flex-1" />
        <ColumnPicker board={board} view={view} columns={dateCols} current={col} label="Plot by" />
      </div>

      {/* grid */}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto border-t border-line bg-panel">
        <div className="relative flex flex-col" style={{ width: LEFT_W + totalW, minHeight: '100%' }}>
          {/* sticky date header */}
          <div className="sticky top-0 z-30 flex border-b-2 border-fg bg-panel" style={{ height: HEAD_H }}>
            <div className="caps sticky left-0 z-10 flex shrink-0 items-end border-r border-line bg-panel px-4 pb-2 text-[13px] font-bold tracking-[0.14em] text-fg" style={{ width: LEFT_W }}>
              {col.title}
            </div>
            <div className="relative" style={{ width: totalW }}>
              {top.map(({ d, label }, i) => (
                <div
                  key={+d}
                  className="caps absolute top-0 h-6 border-l border-line text-[13px] leading-6 font-bold tracking-[0.12em] whitespace-nowrap text-fg"
                  style={{ left: x(iso(d)), width: (i + 1 < top.length ? x(iso(top[i + 1].d)) : totalW) - x(iso(d)) }}
                >
                  {/* sticky inside its own segment: the label follows the scroll until the next segment pushes it out */}
                  <span className="sticky inline-block px-2" style={{ left: LEFT_W }}>
                    {label}
                  </span>
                </div>
              ))}
              {bottom.map(({ d, label, sub }) => {
                const isToday = iso(d) === todayIso
                return (
                  <div
                    key={+d}
                    className={cx(
                      'absolute bottom-2 flex h-[22px] items-center gap-1 font-mono text-[11.5px] whitespace-nowrap tabular-nums',
                      zoom === 'day' ? 'justify-center' : 'border-l border-line pl-2',
                      isToday ? 'font-semibold text-fg' : zoom === 'day' && isWeekend(d) ? 'text-faint' : 'text-muted',
                    )}
                    style={{ left: x(iso(d)), width: zoom === 'day' ? ppd : undefined }}
                  >
                    {sub && <span className="text-[10px] text-faint">{sub}</span>}
                    <span>{label}</span>
                  </div>
                )
              })}
              {/* NOW flag on the header rule, above the today line */}
              <span
                aria-label={`Today, ${stamp(todayD)}`}
                className="absolute -bottom-[9px] z-10 -translate-x-1/2 rounded-sm bg-signal px-1 font-mono text-[10px] leading-[15px] font-semibold tracking-[0.06em] text-on-signal ring-1 ring-fg"
                style={{ left: todayX + ppd / 2 }}
              >
                NOW
              </span>
            </div>
          </div>

          {/* backdrop: weekends, gridlines, today */}
          <div aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: LEFT_W, top: HEAD_H, width: totalW, background: weekendShade }}>
            {unitW > 0 ? (
              <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px ${unitW}px)` }} />
            ) : (
              bottom.map(({ d }) => <div key={+d} className="absolute inset-y-0 w-px bg-line" style={{ left: x(iso(d)) }} />)
            )}
            <div className="absolute inset-y-0 z-[1] w-[2px] bg-fg" style={{ left: todayX + ppd / 2 - 1 }} />
          </div>

          {/* dependency connectors: predecessor end -> successor start, thin ink elbows */}
          {links.length > 0 && (
            <svg aria-hidden className="pointer-events-none absolute top-0 z-[5] text-fg" style={{ left: LEFT_W }} width={totalW} height={contentH}>
              <defs>
                <marker id={`tl-arrow-${view.id}`} viewBox="0 0 6 6" refX="5.5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0L6 3L0 6z" fill="currentColor" />
                </marker>
              </defs>
              {links.map(({ key, from, to }) => (
                <path
                  key={key}
                  d={elbow(from.x2, from.y, to.x1, to.y)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeOpacity={0.75}
                  markerEnd={`url(#tl-arrow-${view.id})`}
                />
              ))}
            </svg>
          )}

          {/* rows */}
          {groups.length === 0 && (
            <div className="sticky left-0 px-5 py-10 text-[13.5px] text-muted" style={{ width: 'min(100%, 100vw)' }}>
              No items match the current filters.
            </div>
          )}
          {groups.map(({ g, items: gItems }) => {
            const isOpen = !collapsed.has(g.id)
            const gr = gItems.map((i) => rangeOf(col, i.values[col.id])).filter((r): r is Range => !!r)
            const span = gr.length ? { start: gr.reduce((a, r) => minIso(a, r.start), gr[0].start), end: gr.reduce((a, r) => maxIso(a, r.end), gr[0].end) } : undefined
            return (
              <Fragment key={g.id}>
                <div className="relative flex border-b border-line" style={{ height: GROUP_H }}>
                  <button
                    onClick={() => setCollapsed((s) => (s.has(g.id) ? new Set([...s].filter((id) => id !== g.id)) : new Set([...s, g.id])))}
                    aria-expanded={isOpen}
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-line bg-panel px-3 text-left transition-colors hover:bg-hover"
                    style={{ width: LEFT_W }}
                  >
                    <ChevronRight className={cx('size-4 shrink-0 text-muted transition-transform duration-150', isOpen && 'rotate-90')} />
                    <span className="size-2.5 shrink-0 rounded-[1px]" style={{ background: g.color }} />
                    <span className="caps truncate text-[15px] font-bold tracking-[0.1em] text-fg">{g.title}</span>
                    <span className="font-mono text-[12px] text-muted tabular-nums">{gItems.length}</span>
                  </button>
                  <div className="relative" style={{ width: totalW }}>
                    {span && (
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2"
                        style={{ left: x(span.start), width: barWidth(span), background: `color-mix(in oklab, ${g.color} 40%, transparent)` }}
                      />
                    )}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      // clip (not hidden) so the sticky name column keeps working mid-animation
                      initial={{ height: 0, opacity: 0, overflow: 'clip' }}
                      animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                      exit={{ height: 0, opacity: 0, overflow: 'clip' }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    >
                      {gItems.map((it, idx) => {
                        const saved = rangeOf(col, it.values[col.id])
                        const r = drag?.id === it.id ? drag.range : saved
                        const owner = people && users[((it.values[people.id] as string[]) ?? [])[0]]
                        const label = status && labelOf(status, it.values[status.id])
                        const color = label?.color ?? g.color
                        const pct = progress ? Math.max(0, Math.min(100, Number(it.values[progress.id]) || 0)) : undefined
                        return (
                          <div key={it.id} className="group/row relative flex border-b border-line" style={{ height: ROW_H }}>
                            <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-r border-line bg-panel px-3 transition-colors group-hover/row:bg-hover" style={{ width: LEFT_W }}>
                              <button onClick={() => openItem(it.id)} className="min-w-0 flex-1 truncate text-left text-[13.5px] text-fg hover:underline">
                                {it.name}
                              </button>
                              {owner ? <Avatar user={owner} size={22} /> : <span className="size-[22px] shrink-0 rounded-full border border-dashed border-line-strong" />}
                            </div>
                            <div className="relative" style={{ width: totalW }}>
                              {r ? (
                                <Bar
                                  key={col.id}
                                  name={it.name}
                                  range={r}
                                  left={x(r.start)}
                                  width={barWidth(r)}
                                  color={color}
                                  pct={pct}
                                  late={lateDays(it, r)}
                                  diamond={!editable}
                                  dragging={drag?.id === it.id}
                                  showTip={hover === it.id || drag?.id === it.id}
                                  tipBelow={idx === 0}
                                  onHover={(h) => setHover(h ? it.id : null)}
                                  onDown={(e, mode) => startDrag(e, it, saved!, mode)}
                                  onOpen={() => openItem(it.id)}
                                  resizable={editable}
                                />
                              ) : (
                                <button
                                  onClick={() => schedule(it)}
                                  className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded-md border border-dashed border-line-strong bg-panel px-2.5 text-[12.5px] whitespace-nowrap text-muted opacity-70 transition-colors group-hover/row:opacity-100 hover:border-accent hover:bg-accent-soft hover:text-accent"
                                  style={{ left: todayX + ppd / 2 + 8 }}
                                >
                                  <CalendarPlus className="size-3.5" /> Schedule from today
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex shrink-0" style={{ height: GAP_H }}>
                  <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-panel" style={{ width: LEFT_W }} />
                </div>
              </Fragment>
            )
          })}
          <div className="flex flex-1">
            <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-panel" style={{ width: LEFT_W }} />
          </div>
        </div>
      </div>
    </div>
  )
}

const minIso = (a: string, b: string) => (a < b ? a : b)
const maxIso = (a: string, b: string) => (a > b ? a : b)

/** Elbow from (x1,y1) to (x2,y2): out right, down, in from the left; doubles back between rows when the successor starts earlier. */
function elbow(x1: number, y1: number, x2: number, y2: number) {
  const out = x1 + 8
  if (x2 - 8 >= out) return `M${x1} ${y1}H${out}V${y2}H${x2}`
  const mid = y1 + (y2 > y1 ? ROW_H / 2 : -ROW_H / 2)
  return `M${x1} ${y1}H${out}V${mid}H${x2 - 8}V${y2}H${x2}`
}

function Bar(p: {
  name: string
  range: Range
  left: number
  width: number
  color: string
  pct?: number
  late: number
  diamond: boolean
  resizable: boolean
  dragging: boolean
  showTip: boolean
  tipBelow: boolean
  onHover: (h: boolean) => void
  onDown: (e: ReactPointerEvent, mode: DragMode) => void
  onOpen: () => void
}) {
  const ink = inkOn(p.color)
  const s = parseISO(p.range.start)
  const e = parseISO(p.range.end)
  const days = differenceInCalendarDays(e, s) + 1
  const dates = days === 1 ? stamp(s) : `${stamp(s)} → ${stamp(e)} · ${days}D`
  const nameFits = !p.diamond && p.width > p.name.length * 6.6 + (p.pct !== undefined ? 64 : 24)
  const w = p.diamond ? Math.max(DIAMOND, p.width) : Math.max(p.width, 6)
  const handle = 'absolute inset-y-0 w-2 cursor-ew-resize after:absolute after:inset-y-1.5 after:w-[2px] after:bg-current after:opacity-0 hover:after:opacity-60'

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${p.name}, ${dates}${p.late ? `, ${p.late} days late` : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, left: p.left + (p.diamond ? (p.width - w) / 2 : 0), width: w }}
      transition={p.dragging ? { duration: 0 } : { duration: 0.14, ease: 'easeOut' }}
      onHoverStart={() => p.onHover(true)}
      onHoverEnd={() => p.onHover(false)}
      onFocus={() => p.onHover(true)}
      onBlur={() => p.onHover(false)}
      onKeyDown={(ev) => ev.key === 'Enter' && p.onOpen()}
      onPointerDown={(ev) => p.onDown(ev, 'move')}
      className={cx('absolute top-1/2 z-10 -mt-[12px] h-[24px] touch-none select-none', p.dragging ? 'cursor-grabbing' : 'cursor-grab', p.showTip && 'z-20')}
    >
      {p.diamond ? (
        <div className="flex h-full items-center">
          <span
            className={cx('mx-auto block rotate-45 rounded-[2px] ring-2', p.late ? 'ring-alert' : p.showTip ? 'ring-fg' : 'ring-panel')}
            style={{ width: DIAMOND * 0.72, height: DIAMOND * 0.72, background: p.color }}
          />
          <span className="pointer-events-none absolute left-full ml-2 text-[13px] whitespace-nowrap text-muted">{p.name}</span>
        </div>
      ) : (
        <div className="relative h-full overflow-hidden rounded-sm" style={{ background: p.color, color: ink, boxShadow: p.showTip ? '0 0 0 1px var(--fg)' : undefined }}>
          {p.pct !== undefined && (
            <div className="absolute inset-x-1.5 bottom-[3px] h-[3px]" style={{ background: `color-mix(in oklab, ${ink} 25%, transparent)` }}>
              <div className="h-full transition-[width] duration-300" style={{ width: `${p.pct}%`, background: ink }} />
            </div>
          )}
          {nameFits && (
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center gap-2 pb-px text-[12.5px] font-medium whitespace-nowrap">
              {p.name}
              {p.pct !== undefined && <span className="font-mono text-[10.5px] opacity-80">{p.pct}%</span>}
            </span>
          )}
          {/* overdue: red end cap where the bar should have arrived */}
          {p.late > 0 && <span className="absolute inset-y-0 right-0 w-[4px] bg-alert" />}
          {p.resizable && (
            <>
              <span onPointerDown={(ev) => p.onDown(ev, 'start')} className={cx(handle, 'left-0 after:left-[3px]')} />
              <span onPointerDown={(ev) => p.onDown(ev, 'end')} className={cx(handle, 'right-0 after:right-[3px]')} />
            </>
          )}
        </div>
      )}
      {!p.diamond && !nameFits && <span className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 text-[13px] whitespace-nowrap text-muted">{p.name}</span>}

      <AnimatePresence>
        {p.showTip && (
          <motion.div
            initial={{ opacity: 0, y: p.tipBelow ? -3 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={cx(
              'pointer-events-none absolute left-0 z-40 rounded-md border border-line-strong bg-panel px-2.5 py-1.5 whitespace-nowrap shadow-pop',
              p.tipBelow ? 'top-full mt-2' : 'bottom-full mb-2',
            )}
          >
            <div className="flex items-center gap-2 font-mono text-[12px] font-semibold text-fg tabular-nums">
              {dates}
              {p.late > 0 && <span className="rounded-sm bg-alert px-1 text-[10.5px] text-white dark:text-ink">+{p.late}d</span>}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted">
              <span className="size-2 rounded-[1px]" style={{ background: p.color }} />
              {p.name}
              {p.pct !== undefined && <span className="font-mono">· {p.pct}%</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

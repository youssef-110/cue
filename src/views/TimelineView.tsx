import { Fragment, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addDays, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, eachWeekOfInterval, format, isWeekend, max as maxDate, min as minDate, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarPlus, ChartGantt, ChevronRight, LocateFixed } from 'lucide-react'
import { addColumn, labelOf, openItem, setValue, updateBoard, useStore } from '../lib/store'
import type { Board, Column, Item, View } from '../lib/types'
import { Avatar, Button, cx } from '../components/ui'
import { ColumnPicker, EmptyView } from './KanbanView'

type Zoom = 'day' | 'week' | 'month'
type Range = { start: string; end: string }
type DragMode = 'move' | 'start' | 'end'

const PPD: Record<Zoom, number> = { day: 40, week: 18, month: 5 } // pixels per day
const PAD: Record<Zoom, number> = { day: 14, week: 35, month: 120 } // days of air around the data
const LEFT_W = 272
const ROW_H = 40
const GROUP_H = 40
const HEAD_H = 52
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** White or near-black text for a label set inside a colored fill. */
export function inkOn(hex: string) {
  const m = /^#?([\da-f]{6})$/i.exec(hex)
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return L > 0.42 ? '#171a2b' : '#fff'
}

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
      ? eachDayOfInterval(interval).map((d) => ({ d, label: format(d, 'd'), sub: format(d, 'EEEEE') }))
      : zoom === 'week'
        ? eachWeekOfInterval(interval, { weekStartsOn: 1 }).map((d) => ({ d, label: format(d, 'MMM d'), sub: '' }))
        : eachMonthOfInterval(interval).map((d) => ({ d, label: format(d, 'MMM'), sub: '' }))
  const unitW = zoom === 'day' ? ppd : zoom === 'week' ? 7 * ppd : 0

  // ---------- rows ----------
  const groups = board.groups.map((g) => ({ g, items: items.filter((i) => i.groupId === g.id) })).filter((x) => x.items.length)
  const unscheduled = items.filter((i) => !rangeOf(col, i.values[col.id])).length

  const weekendShade =
    zoom === 'month'
      ? undefined
      : `repeating-linear-gradient(90deg, transparent 0 ${5 * ppd}px, color-mix(in oklab, var(--fg) 3.5%, transparent) ${5 * ppd}px ${7 * ppd}px)`

  return (
    <div className="flex h-full flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-4 pb-3">
        <div role="radiogroup" aria-label="Zoom" className="relative flex rounded-lg border border-line bg-panel p-0.5">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => (
            <button
              key={z}
              role="radio"
              aria-checked={zoom === z}
              onClick={() => setZoom(z)}
              className={cx('relative h-7 rounded-md px-3 text-[12.5px] font-medium capitalize transition-colors', zoom === z ? 'text-fg' : 'text-muted hover:text-fg')}
            >
              {zoom === z && <motion.span layoutId={`tl-zoom-${view.id}`} className="absolute inset-0 rounded-md bg-panel-2 shadow-card" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <span className="relative">{z}s</span>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => centerToday('smooth')}>
          <LocateFixed /> Today
        </Button>
        <p className="ml-1 hidden text-[12.5px] text-muted sm:block">
          <span className="font-medium text-fg tabular-nums">{items.length - unscheduled}</span> scheduled
          {unscheduled > 0 && (
            <>
              {' '}· <span className="font-medium text-fg tabular-nums">{unscheduled}</span> without dates
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
          <div className="sticky top-0 z-30 flex border-b border-line bg-panel/95 backdrop-blur" style={{ height: HEAD_H }}>
            <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-line bg-panel px-4 pb-2 text-[11.5px] font-medium tracking-wide text-faint uppercase" style={{ width: LEFT_W }}>
              {col.title}
            </div>
            <div className="relative" style={{ width: totalW }}>
              {top.map(({ d, label }, i) => (
                <div
                  key={+d}
                  className="absolute top-0 h-6 border-l border-line text-[12px] leading-6 font-semibold whitespace-nowrap text-fg"
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
                      'absolute bottom-0 flex h-[26px] items-center gap-1 text-[11.5px] whitespace-nowrap tabular-nums',
                      zoom === 'day' ? 'justify-center' : 'border-l border-line pl-2',
                      zoom === 'day' && isWeekend(d) ? 'text-faint' : 'text-muted',
                    )}
                    style={{ left: x(iso(d)), width: zoom === 'day' ? ppd : undefined }}
                  >
                    {sub && <span className="text-[10px] text-faint">{sub}</span>}
                    <span className={cx(isToday && 'grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-semibold text-white')}>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* backdrop: weekends, gridlines, today */}
          <div aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: LEFT_W, top: HEAD_H, width: totalW, background: weekendShade }}>
            {unitW > 0 ? (
              <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px ${unitW}px)`, opacity: 0.55 }} />
            ) : (
              bottom.map(({ d }) => <div key={+d} className="absolute inset-y-0 w-px bg-line opacity-60" style={{ left: x(iso(d)) }} />)
            )}
            <div className="absolute inset-y-0 z-[1]" style={{ left: todayX + ppd / 2 - 1 }}>
              <div className="absolute inset-y-0 w-[2px] rounded-full bg-accent shadow-[0_0_10px_2px_color-mix(in_oklab,var(--accent)_45%,transparent)]" />
              <div className="absolute -top-1 -left-[3px] size-2 rounded-full bg-accent ring-2 ring-panel" />
            </div>
          </div>

          {/* rows */}
          {groups.length === 0 && (
            <div className="sticky left-0 px-5 py-10 text-[13px] text-muted" style={{ width: 'min(100%, 100vw)' }}>
              No items match the current filters.
            </div>
          )}
          {groups.map(({ g, items: gItems }) => {
            const isOpen = !collapsed.has(g.id)
            const gr = gItems.map((i) => rangeOf(col, i.values[col.id])).filter((r): r is Range => !!r)
            const span = gr.length ? { start: gr.reduce((a, r) => minIso(a, r.start), gr[0].start), end: gr.reduce((a, r) => maxIso(a, r.end), gr[0].end) } : undefined
            return (
              <Fragment key={g.id}>
                <div className="relative flex" style={{ height: GROUP_H }}>
                  <button
                    onClick={() => setCollapsed((s) => (s.has(g.id) ? new Set([...s].filter((id) => id !== g.id)) : new Set([...s, g.id])))}
                    aria-expanded={isOpen}
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-line bg-panel px-3 text-left transition-colors hover:bg-hover"
                    style={{ width: LEFT_W }}
                  >
                    <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 34 }} className="grid place-items-center" style={{ color: g.color }}>
                      <ChevronRight className="size-4" />
                    </motion.span>
                    <span className="truncate text-[13.5px] font-semibold" style={{ color: g.color }}>
                      {g.title}
                    </span>
                    <span className="rounded-full bg-panel-2 px-1.5 font-mono text-[11px] text-muted tabular-nums">{gItems.length}</span>
                  </button>
                  <div className="relative" style={{ width: totalW }}>
                    {span && (
                      <div
                        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
                        style={{ left: x(span.start), width: (differenceInCalendarDays(parseISO(span.end), parseISO(span.start)) + 1) * ppd, background: `color-mix(in oklab, ${g.color} 30%, transparent)` }}
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
                      exit={{ height: 0, opacity: 0, overflow: 'clip' }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
                      {gItems.map((it, idx) => {
                        const saved = rangeOf(col, it.values[col.id])
                        const r = drag?.id === it.id ? drag.range : saved
                        const owner = people && users[((it.values[people.id] as string[]) ?? [])[0]]
                        const label = status && labelOf(status, it.values[status.id])
                        const color = label?.color ?? g.color
                        const pct = progress ? Math.max(0, Math.min(100, Number(it.values[progress.id]) || 0)) : undefined
                        return (
                          <div key={it.id} className="group/row relative flex border-t border-line/60" style={{ height: ROW_H }}>
                            <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2.5 border-r border-line bg-panel pr-3 pl-3 transition-colors group-hover/row:bg-hover" style={{ width: LEFT_W }}>
                              <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: g.color }} />
                              <button onClick={() => openItem(it.id)} className="min-w-0 flex-1 truncate text-left text-[13px] text-fg hover:underline">
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
                                  width={(differenceInCalendarDays(parseISO(r.end), parseISO(r.start)) + 1) * ppd}
                                  color={color}
                                  pct={pct}
                                  diamond={!editable}
                                  dragging={drag?.id === it.id}
                                  showTip={hover === it.id || drag?.id === it.id}
                                  tipBelow={idx === 0}
                                  delay={Math.min(idx * 0.03, 0.3)}
                                  onHover={(h) => setHover(h ? it.id : null)}
                                  onDown={(e, mode) => startDrag(e, it, saved!, mode)}
                                  onOpen={() => openItem(it.id)}
                                  resizable={editable}
                                />
                              ) : (
                                <button
                                  onClick={() => schedule(it)}
                                  className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-2.5 text-[12px] whitespace-nowrap text-faint opacity-60 transition-all group-hover/row:opacity-100 hover:border-accent hover:bg-accent-soft hover:text-accent"
                                  style={{ left: todayX + ppd / 2 + 6 }}
                                >
                                  <CalendarPlus className="size-3.5" /> Click to schedule
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex h-2 shrink-0 border-t border-line/60">
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

function Bar(p: {
  name: string
  range: Range
  left: number
  width: number
  color: string
  pct?: number
  diamond: boolean
  resizable: boolean
  dragging: boolean
  showTip: boolean
  tipBelow: boolean
  delay: number
  onHover: (h: boolean) => void
  onDown: (e: ReactPointerEvent, mode: DragMode) => void
  onOpen: () => void
}) {
  const ink = inkOn(p.color)
  const s = parseISO(p.range.start)
  const e = parseISO(p.range.end)
  const days = differenceInCalendarDays(e, s) + 1
  const dates = days === 1 ? format(s, 'EEE, MMM d') : `${format(s, 'MMM d')} → ${format(e, 'MMM d')} · ${days} days`
  const nameFits = !p.diamond && p.width > p.name.length * 6.6 + (p.pct !== undefined ? 64 : 24)
  const tween = p.dragging ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 38 }
  const D = 16 // diamond size
  const w = p.diamond ? Math.max(D, p.width) : Math.max(p.width, 6)

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label={`${p.name}, ${dates}`}
      initial={{ opacity: 0, scaleX: p.diamond ? 1 : 0.5, scale: p.diamond ? 0.4 : 1 }}
      animate={{ opacity: 1, scaleX: 1, scale: 1, left: p.left + (p.diamond ? (p.width - w) / 2 : 0), width: w }}
      transition={{ ...tween, opacity: { duration: 0.25, delay: p.delay }, scaleX: { ...tween, delay: p.delay }, scale: { ...tween, delay: p.delay } }}
      whileHover={p.dragging ? undefined : { y: -1 }}
      onHoverStart={() => p.onHover(true)}
      onHoverEnd={() => p.onHover(false)}
      onFocus={() => p.onHover(true)}
      onBlur={() => p.onHover(false)}
      onKeyDown={(ev) => ev.key === 'Enter' && p.onOpen()}
      onPointerDown={(ev) => p.onDown(ev, 'move')}
      className={cx('absolute top-1/2 z-10 -mt-[13px] h-[26px] origin-left touch-none select-none', p.dragging ? 'cursor-grabbing' : 'cursor-grab', p.showTip && 'z-20')}
    >
      {p.diamond ? (
        <div className="flex h-full items-center">
          <span
            className="mx-auto block rotate-45 rounded-[4px] ring-2 ring-panel transition-shadow"
            style={{ width: D * 0.78, height: D * 0.78, background: p.color, boxShadow: p.showTip ? `0 0 0 4px color-mix(in oklab, ${p.color} 25%, transparent)` : undefined }}
          />
          <span className="pointer-events-none absolute left-full ml-2 text-[12.5px] whitespace-nowrap text-muted">{p.name}</span>
        </div>
      ) : (
        <div
          className="relative h-full overflow-hidden rounded-lg transition-shadow"
          style={{
            background: p.color,
            boxShadow: p.showTip
              ? `0 6px 16px -6px color-mix(in oklab, ${p.color} 70%, transparent), 0 0 0 1px color-mix(in oklab, ${p.color} 60%, #000 10%)`
              : `0 1px 2px color-mix(in oklab, ${p.color} 40%, transparent)`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/18 to-transparent" />
          {p.pct !== undefined && (
            <div className="absolute inset-x-1.5 bottom-[3px] h-[3px] overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${ink} 25%, transparent)` }}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p.pct}%`, background: ink }} />
            </div>
          )}
          {nameFits && (
            <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center gap-2 pb-px text-[12px] font-medium whitespace-nowrap" style={{ color: ink }}>
              {p.name}
              {p.pct !== undefined && <span className="font-mono text-[10.5px] opacity-75">{p.pct}%</span>}
            </span>
          )}
          {p.resizable && (
            <>
              <span onPointerDown={(ev) => p.onDown(ev, 'start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize after:absolute after:inset-y-1.5 after:left-[3px] after:w-[2px] after:rounded-full after:bg-white/0 hover:after:bg-white/70" />
              <span onPointerDown={(ev) => p.onDown(ev, 'end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize after:absolute after:inset-y-1.5 after:right-[3px] after:w-[2px] after:rounded-full after:bg-white/0 hover:after:bg-white/70" />
            </>
          )}
        </div>
      )}
      {!p.diamond && !nameFits && <span className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 text-[12.5px] whitespace-nowrap text-muted">{p.name}</span>}

      <AnimatePresence>
        {p.showTip && (
          <motion.div
            initial={{ opacity: 0, y: p.tipBelow ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14 }}
            className={cx(
              'pointer-events-none absolute left-0 z-40 rounded-lg border border-line bg-panel px-2.5 py-1.5 whitespace-nowrap shadow-pop',
              p.tipBelow ? 'top-full mt-2' : 'bottom-full mb-2',
            )}
          >
            <div className="text-[12.5px] font-semibold text-fg tabular-nums">{dates}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className="h-[2px] w-2.5 rounded-full" style={{ background: p.color }} />
              {p.name}
              {p.pct !== undefined && <span className="font-mono">· {p.pct}%</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

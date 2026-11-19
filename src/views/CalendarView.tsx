import { useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { motion } from 'motion/react'
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Plus } from 'lucide-react'
import { addItem, labelOf, openItem, setValue } from '../lib/store'
import type { Board, CellValue, Column, Item, View } from '../lib/types'
import { Button, Popover, cx } from '../components/ui'
import { ColumnPicker, EmptyView } from './KanbanView'

const UNSCHEDULED = '__unscheduled'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function Chip({ item, color, dim }: { item: Item; color: string; dim?: boolean }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: item.id })
  return (
    <motion.button
      layout="position"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: isDragging ? 0.35 : dim ? 0.6 : 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 36 }}
      ref={setNodeRef}
      {...listeners}
      onClick={() => openItem(item.id)}
      title={item.name}
      className="block w-full cursor-grab touch-none truncate rounded-md px-1.5 py-[3px] text-left text-[12px] font-medium text-fg transition-[filter] hover:brightness-95 dark:hover:brightness-125"
      style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, boxShadow: `inset 2px 0 0 ${color}` }}
    >
      {item.name}
    </motion.button>
  )
}

function Day({
  day,
  items,
  inMonth,
  isToday,
  colorOf,
  onAdd,
  onMore,
}: {
  day: Date
  items: Item[]
  inMonth: boolean
  isToday: boolean
  colorOf: (it: Item) => string
  onAdd: (anchor: HTMLElement) => void
  onMore: (anchor: HTMLElement) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso(day) })
  const extra = items.length - MAX_CHIPS
  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative flex min-h-0 flex-col gap-0.5 overflow-hidden border-r border-b border-line p-1.5 transition-colors',
        !inMonth && 'bg-panel-2/50',
        isOver && 'bg-accent-soft/70',
        isToday && 'ring-2 ring-accent/60 ring-inset',
      )}
    >
      <div className="mb-0.5 flex items-center justify-between px-0.5">
        <span
          className={cx(
            'grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] tabular-nums',
            isToday ? 'bg-accent font-semibold text-white' : inMonth ? 'font-medium text-fg' : 'text-faint',
          )}
        >
          {format(day, 'd')}
        </span>
      </div>
      {items.slice(0, MAX_CHIPS).map((it) => (
        <Chip key={it.id} item={it} color={colorOf(it)} dim={!inMonth} />
      ))}
      {extra > 0 && (
        <button onClick={(e) => onMore(e.currentTarget)} className="self-start rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-muted hover:bg-hover hover:text-fg">
          +{extra} more
        </button>
      )}
      <button
        aria-label={`Add item on ${format(day, 'MMMM d')}`}
        onClick={(e) => onAdd(e.currentTarget)}
        className="group grid min-h-4 flex-1 place-items-center rounded-md text-faint transition-colors hover:bg-hover/70 focus-visible:bg-hover/70"
      >
        <Plus className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </div>
  )
}

function Unscheduled({ items, colorOf }: { items: Item[]; colorOf: (it: Item) => string }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED })
  return (
    <aside
      ref={setNodeRef}
      aria-label="Unscheduled items"
      className={cx('hidden w-60 shrink-0 flex-col border-l border-line transition-colors lg:flex', isOver ? 'bg-accent-soft/60' : 'bg-panel')}
    >
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Inbox className="size-4 text-muted" />
        <h3 className="text-[13px] font-semibold text-fg">Unscheduled</h3>
        <span className="rounded-full bg-panel-2 px-1.5 font-mono text-[11px] text-muted tabular-nums">{items.length}</span>
      </header>
      <p className="px-4 pb-3 text-[12px] leading-relaxed text-faint">Drag onto a day to schedule. Drop here to clear a date.</p>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {items.map((it) => (
          <Chip key={it.id} item={it} color={colorOf(it)} />
        ))}
        {items.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-faint">Everything has a date</p>}
      </div>
    </aside>
  )
}

export function CalendarView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ date: string; anchor: HTMLElement } | null>(null)
  const [more, setMore] = useState<{ date: string; anchor: HTMLElement } | null>(null)
  const [name, setName] = useState('')

  const dateCols = board.columns.filter((c) => c.type === 'date' || c.type === 'timeline')
  const col: Column | undefined = dateCols.find((c) => c.id === view.columnId) ?? dateCols.find((c) => c.type === 'date') ?? dateCols[0]
  if (!col)
    return (
      <EmptyView icon={<CalendarDays />} title="No dates to plot yet">
        The calendar places items by a date or timeline column. Add one to this board and scheduled items will appear here.
      </EmptyView>
    )

  const status = board.columns.find((c) => c.type === 'status')
  const colorOf = (it: Item) => (status && labelOf(status, it.values[status.id])?.color) || 'var(--accent)'
  const dateOf = (it: Item): string | undefined => {
    const v = it.values[col.id]
    const d = col.type === 'timeline' ? (v as { start?: string } | undefined)?.start : v
    return typeof d === 'string' && d ? d : undefined
  }
  const valueFor = (it: Item | undefined, date: string): CellValue => {
    if (col.type !== 'timeline') return date
    const cur = it?.values[col.id] as { start?: string; end?: string } | undefined
    const span = cur?.start && cur.end ? differenceInCalendarDays(parseISO(cur.end), parseISO(cur.start)) : 0
    return { start: date, end: iso(addDays(parseISO(date), Math.max(0, span))) } // keep the duration when moving
  }

  const byDay = new Map<string, Item[]>()
  const unscheduled: Item[] = []
  items.forEach((it) => {
    const d = dateOf(it)
    if (!d) return unscheduled.push(it)
    byDay.set(d, [...(byDay.get(d) ?? []), it])
  })
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const todayIso = iso(new Date())
  const active = activeId ? items.find((i) => i.id === activeId) : undefined
  const group = board.groups[0]

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const item = items.find((i) => i.id === active.id)
    if (!item || !over || over.id === (dateOf(item) ?? UNSCHEDULED)) return
    setValue(item.id, col.id, over.id === UNSCHEDULED ? null : valueFor(item, String(over.id)))
  }
  const submitAdd = () => {
    if (adding && group && name.trim()) addItem(board.id, group.id, name.trim(), { values: { [col.id]: valueFor(undefined, adding.date) } })
    setName('')
    setAdding(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pt-4 pb-3">
            <h2 className="mr-2 font-display text-[20px] font-semibold tracking-tight text-fg">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex items-center">
              <Button aria-label="Previous month" className="w-8 px-0" onClick={() => setMonth((m) => addMonths(m, -1))}>
                <ChevronLeft />
              </Button>
              <Button aria-label="Next month" className="w-8 px-0" onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight />
              </Button>
            </div>
            <Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <span className="flex-1" />
            <ColumnPicker board={board} view={view} columns={dateCols} current={col} label="Date" />
          </div>
          <div className="mx-5 mb-5 flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-line bg-panel shadow-card">
            <div className="grid shrink-0 grid-cols-7 border-b border-line">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2.5 py-2 text-[11.5px] font-medium tracking-wide text-faint uppercase">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid min-h-[480px] flex-1 auto-rows-fr grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
              {days.map((day) => {
                const key = iso(day)
                return (
                  <Day
                    key={key}
                    day={day}
                    items={byDay.get(key) ?? []}
                    inMonth={isSameMonth(day, month)}
                    isToday={key === todayIso}
                    colorOf={colorOf}
                    onAdd={(anchor) => group && (setName(''), setAdding({ date: key, anchor }))}
                    onMore={(anchor) => setMore({ date: key, anchor })}
                  />
                )
              })}
            </div>
          </div>
        </div>
        <Unscheduled items={unscheduled} colorOf={colorOf} />
      </div>

      <Popover anchor={adding?.anchor ?? null} open={!!adding} onClose={() => setAdding(null)} width={260}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitAdd()
          }}
          className="p-1"
        >
          <label className="mb-1.5 block px-0.5 text-[11.5px] font-medium text-muted">
            New item · {adding && format(parseISO(adding.date), 'EEE, MMM d')}
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name, then Enter"
              className="mt-1.5 w-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] font-normal text-fg outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
            />
          </label>
        </form>
      </Popover>

      <Popover anchor={more?.anchor ?? null} open={!!more} onClose={() => setMore(null)} width={240}>
        <p className="px-1.5 pt-1 pb-2 text-[12px] font-semibold text-fg">{more && format(parseISO(more.date), 'EEEE, MMMM d')}</p>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {(more ? (byDay.get(more.date) ?? []) : []).map((it) => (
            <button
              key={it.id}
              onClick={() => (setMore(null), openItem(it.id))}
              className="truncate rounded-md px-2 py-1 text-left text-[12.5px] font-medium text-fg hover:brightness-95"
              style={{ background: `color-mix(in oklab, ${colorOf(it)} 16%, transparent)`, boxShadow: `inset 2px 0 0 ${colorOf(it)}` }}
            >
              {it.name}
            </button>
          ))}
        </div>
      </Popover>

      <DragOverlay dropAnimation={null}>
        {active && (
          <motion.div
            initial={{ scale: 1, rotate: 0 }}
            animate={{ scale: 1.05, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="w-44 cursor-grabbing truncate rounded-md border border-line-strong bg-panel px-2 py-1 text-[12px] font-medium text-fg"
            style={{ boxShadow: `inset 3px 0 0 ${colorOf(active)}, 0 14px 32px -10px rgb(15 18 40 / 0.35)` }}
          >
            {active.name}
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

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
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Plus, Video } from 'lucide-react'
import { addItem, labelOf, openItem, setValue, useCanEdit } from '../lib/store'
import { inkOn } from '../lib/seed'
import type { Board, CellValue, Column, Item, View } from '../lib/types'
import { Button, Popover, cx } from '../components/ui'
import { ColumnPicker, EmptyView } from './KanbanView'

const UNSCHEDULED = '__unscheduled'
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_CHIPS = 3
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Label-coloured tag; items without a status get a dashed outline tag. */
const tagStyle = (color?: string) => (color ? { background: color, color: inkOn(color) } : undefined)
const TAG = 'block w-full truncate rounded-sm px-1.5 py-[2px] text-left text-[12px] leading-[16px] font-medium'
const TAG_NONE = 'border border-dashed border-line-strong bg-panel text-fg'

// a video-call link anywhere on the item gets a Join button on its calendar chip
const CALL = /^https:\/\/(meet\.google\.com|[\w-]+\.zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/\S*$/
const callLink = (item: Item) => Object.values(item.values).find((v): v is string => typeof v === 'string' && CALL.test(v))

function Chip({ item, color, dim }: { item: Item; color?: string; dim?: boolean }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: item.id })
  const join = callLink(item)
  const chip = (
    <motion.button
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.35 : dim ? 0.55 : 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      ref={setNodeRef}
      {...listeners}
      onClick={() => openItem(item.id)}
      title={item.name}
      className={cx(TAG, 'label-fill cursor-grab touch-none', !color && TAG_NONE)}
      style={tagStyle(color)}
    >
      {item.name}
    </motion.button>
  )
  if (!join) return chip
  return (
    <span className="flex items-stretch gap-0.5">
      <span className="min-w-0 flex-1">{chip}</span>
      <a
        href={join}
        target="_blank"
        rel="noreferrer noopener"
        title="Join the call"
        aria-label={`Join the call for ${item.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="grid w-5 shrink-0 place-items-center rounded-sm bg-ink text-on-ink hover:bg-ink/85 dark:bg-signal dark:text-on-signal"
      >
        <Video className="size-3" />
      </a>
    </span>
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
  colorOf: (it: Item) => string | undefined
  onAdd: (anchor: HTMLElement) => void
  onMore: (anchor: HTMLElement) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso(day) })
  const extra = items.length - MAX_CHIPS
  return (
    <div
      ref={setNodeRef}
      className={cx(
        'relative flex min-h-0 flex-col gap-[3px] overflow-hidden border-r border-b border-line p-1.5 transition-colors',
        !inMonth && 'bg-panel-2',
        isOver && 'bg-accent-soft',
      )}
    >
      <div className="mb-0.5 flex items-center justify-between px-0.5">
        <span
          aria-current={isToday ? 'date' : undefined}
          className={cx(
            'grid h-[22px] min-w-[22px] place-items-center rounded-sm px-1 font-mono text-[12.5px] tabular-nums',
            isToday ? 'bg-signal font-semibold text-on-signal' : inMonth ? 'font-medium text-fg' : 'text-faint',
          )}
        >
          {format(day, 'dd')}
        </span>
      </div>
      {items.slice(0, MAX_CHIPS).map((it) => (
        <Chip key={it.id} item={it} color={colorOf(it)} dim={!inMonth} />
      ))}
      {extra > 0 && (
        <button onClick={(e) => onMore(e.currentTarget)} className="self-start rounded-sm px-1 py-0.5 font-mono text-[11.5px] text-muted hover:bg-hover hover:text-fg">
          +{extra} more
        </button>
      )}
      <button
        aria-label={`Add item on ${format(day, 'MMMM d')}`}
        onClick={(e) => onAdd(e.currentTarget)}
        className="group grid min-h-4 flex-1 place-items-center rounded-sm text-faint transition-colors hover:bg-hover focus-visible:bg-hover"
      >
        <Plus className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </button>
    </div>
  )
}

function Unscheduled({ items, colorOf }: { items: Item[]; colorOf: (it: Item) => string | undefined }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED })
  return (
    <aside
      ref={setNodeRef}
      aria-label="Unscheduled items"
      className={cx('hidden w-60 shrink-0 flex-col border-l border-line transition-colors lg:flex', isOver ? 'bg-accent-soft' : 'bg-panel')}
    >
      <header className="mx-4 flex items-center gap-2 border-b-2 border-fg pt-4 pb-1.5">
        <Inbox className="size-4 text-muted" />
        <h3 className="caps text-[15px] font-bold tracking-[0.1em] text-fg">Unscheduled</h3>
        <span className="ml-auto font-mono text-[12px] text-muted tabular-nums">{String(items.length).padStart(2, '0')}</span>
      </header>
      <p className="px-4 pt-2 pb-2 text-[12.5px] leading-relaxed text-muted">Drag onto a day to schedule. Drop here to clear a date.</p>
      <div className="mx-4 flex min-h-0 flex-1 flex-col divide-y divide-line overflow-y-auto border-t border-line pb-3">
        {items.map((it) => (
          <div key={it.id} className="py-1.5">
            <Chip item={it} color={colorOf(it)} />
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-[12.5px] text-faint">Everything has a date.</p>}
      </div>
    </aside>
  )
}

export function CalendarView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const editable = useCanEdit()
  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const sensors = useSensors(editable ? pointer : null)
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
  const colorOf = (it: Item): string | undefined => (status && labelOf(status, it.values[status.id])?.color) || undefined
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
            <h2 className="mr-2 flex items-baseline gap-2 text-fg">
              <span className="caps text-[28px] leading-none font-bold">{format(month, 'MMMM')}</span>
              <span className="font-mono text-[15px] text-muted">{format(month, 'yyyy')}</span>
            </h2>
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
          <div className="mx-5 mb-5 flex min-h-0 flex-1 flex-col overflow-auto rounded-lg border border-line bg-panel">
            <div className="grid shrink-0 grid-cols-7 border-b-2 border-fg">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={cx('caps px-2.5 pt-2.5 pb-1.5 text-[13px] font-bold tracking-[0.14em]', i >= 5 ? 'text-muted' : 'text-fg')}>
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
                    onAdd={(anchor) => group && editable && (setName(''), setAdding({ date: key, anchor }))}
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
          <label className="mb-1.5 block px-0.5 text-[12.5px] font-medium text-muted">
            New item on <span className="font-mono text-fg uppercase">{adding && format(parseISO(adding.date), 'EEE dd MMM')}</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name, then Enter"
              className="mt-1.5 w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-[13.5px] font-normal text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
        </form>
      </Popover>

      <Popover anchor={more?.anchor ?? null} open={!!more} onClose={() => setMore(null)} width={240}>
        <p className="mx-1.5 mb-2 border-b-2 border-fg pt-1 pb-1 font-mono text-[12.5px] font-semibold text-fg uppercase">{more && format(parseISO(more.date), 'EEE dd MMM')}</p>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto px-1 pb-1">
          {(more ? (byDay.get(more.date) ?? []) : []).map((it) => (
            <button
              key={it.id}
              onClick={() => (setMore(null), openItem(it.id))}
              className={cx(TAG, 'label-fill py-1 text-[12.5px]', !colorOf(it) && TAG_NONE)}
              style={tagStyle(colorOf(it))}
            >
              {it.name}
            </button>
          ))}
        </div>
      </Popover>

      <DragOverlay dropAnimation={null}>
        {active && (
          <div
            className={cx(TAG, 'w-48 cursor-grabbing py-1 shadow-[0_10px_22px_-8px_rgb(18_18_18/0.32)]', !colorOf(active) && TAG_NONE)}
            style={tagStyle(colorOf(active))}
          >
            {active.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

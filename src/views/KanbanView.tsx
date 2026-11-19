import { useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { motion } from 'motion/react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Check, ChevronDown, Columns3, Plus } from 'lucide-react'
import { addItem, labelOf, openItem, setValue, updateBoard, useStore } from '../lib/store'
import { today } from '../lib/seed'
import type { Board, Column, Item, User, View } from '../lib/types'
import { AvatarStack, LabelPill, MenuItem, Popover, cx } from '../components/ui'

const NONE = '__none'

/** Dropdown that sets which column a view is driven by (persisted on the view). */
export function ColumnPicker({ board, view, columns, current, label }: { board: Board; view: View; columns: Column[]; current?: Column; label: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const pick = (columnId: string) => {
    updateBoard(board.id, { views: board.views.map((v) => (v.id === view.id ? { ...v, columnId } : v)) })
    setOpen(false)
  }
  return (
    <>
      <button
        ref={setAnchor}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-[13px] transition-colors hover:bg-hover"
      >
        <span className="text-muted">{label}</span>
        <span className="font-medium text-fg">{current?.title ?? 'None'}</span>
        <ChevronDown className="size-3.5 text-faint" />
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} width={220} align="end">
        {columns.map((c) => (
          <MenuItem key={c.id} active={c.id === current?.id} onClick={() => pick(c.id)} icon={c.id === current?.id ? <Check /> : undefined}>
            {c.title}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

export function EmptyView({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent [&>svg]:size-6">{icon}</div>
        <h3 className="font-display text-[17px] font-semibold text-fg">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  )
}

interface CardCtx {
  board: Board
  status: Column
  people?: Column
  date?: Column
  priority?: Column
  users: Record<string, User>
}

function CardBody({ item, ctx }: { item: Item; ctx: CardCtx }) {
  const owners = ((ctx.people && (item.values[ctx.people.id] as string[])) ?? []).map((id) => ctx.users[id]).filter(Boolean)
  const due = ctx.date ? (item.values[ctx.date.id] as string | undefined) : undefined
  const done = labelOf(ctx.status, item.values[ctx.status.id])?.done
  const overdue = !!due && !done && due < today()
  const prio = ctx.priority ? labelOf(ctx.priority, item.values[ctx.priority.id]) : undefined
  const group = ctx.board.groups.find((g) => g.id === item.groupId)
  return (
    <>
      <span className="flex items-start gap-2">
        {group && <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: group.color }} title={group.title} />}
        <span className="line-clamp-3 flex-1 text-[13.5px] leading-snug font-medium text-fg">{item.name}</span>
      </span>
      {(owners.length > 0 || due || prio) && (
        <span className="mt-2.5 flex items-center gap-1.5">
          {prio && <LabelPill label={prio} className="px-1.5 text-[11px]" />}
          {due && (
            <span
              className={cx(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium',
                overdue ? 'bg-red-500/12 text-red-500' : 'bg-panel-2 text-muted',
              )}
            >
              <CalendarDays className="size-3" />
              {format(parseISO(due), 'MMM d')}
            </span>
          )}
          <span className="flex-1" />
          {owners.length > 0 && <AvatarStack users={owners} size={22} />}
        </span>
      )}
    </>
  )
}

function DraggableCard({ item, ctx }: { item: Item; ctx: CardCtx }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: item.id })
  return (
    <motion.div layout="position" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 36 }}>
      <button
        ref={setNodeRef}
        {...listeners}
        onClick={() => openItem(item.id)}
        className={cx(
          'block w-full cursor-grab touch-none rounded-xl border border-line bg-panel p-3 text-left shadow-card transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-line-strong hover:shadow-pop',
          isDragging && 'opacity-35',
        )}
      >
        <CardBody item={item} ctx={ctx} />
      </button>
    </motion.div>
  )
}

function AddCard({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Plus className="size-4" /> Add item
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onAdd(name.trim())
        setName('')
      }}
    >
      <input
        autoFocus
        aria-label="New item name"
        placeholder="Item name, then Enter"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && (setName(''), setOpen(false))}
        className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-[13px] text-fg shadow-card outline-none placeholder:text-faint focus:ring-2 focus:ring-accent"
      />
    </form>
  )
}

interface StackDef {
  id: string
  name: string
  color: string
}

function Stack({ stack, items, ctx, onAdd }: { stack: StackDef; items: Item[]; ctx: CardCtx; onAdd?: (name: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stack.id })
  return (
    <section
      ref={setNodeRef}
      aria-label={stack.name}
      className={cx(
        'flex max-h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-panel-2/60 transition-[background-color,border-color,box-shadow]',
        isOver ? 'border-accent/50 bg-accent-soft/60 shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_18%,transparent)]' : 'border-line',
      )}
    >
      <div className="h-[3px] shrink-0" style={{ background: stack.color }} />
      <header className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-2">
        <span className="size-2 rounded-full" style={{ background: stack.color }} />
        <h3 className="truncate text-[13px] font-semibold text-fg">{stack.name}</h3>
        <span className="rounded-full bg-panel px-1.5 font-mono text-[11px] text-muted tabular-nums">{items.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {items.map((it) => (
          <DraggableCard key={it.id} item={it} ctx={ctx} />
        ))}
        {onAdd && <AddCard onAdd={onAdd} />}
      </div>
    </section>
  )
}

export function KanbanView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const users = useStore((s) => s.user)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeId, setActiveId] = useState<string | null>(null)

  const statusCols = board.columns.filter((c) => c.type === 'status')
  const status = statusCols.find((c) => c.id === view.columnId) ?? statusCols[0]
  if (!status)
    return (
      <EmptyView icon={<Columns3 />} title="Nothing to stack by yet">
        Kanban groups items by a status column. Add a status column to this board and your items will line up here as cards.
      </EmptyView>
    )

  const ctx: CardCtx = {
    board,
    status,
    people: board.columns.find((c) => c.type === 'people'),
    date: board.columns.find((c) => c.type === 'date'),
    priority: board.columns.find((c) => c.type === 'priority'),
    users,
  }
  const stacks: StackDef[] = [...(status.labels ?? []), { id: NONE, name: 'No status', color: 'var(--faint)' }]
  const stackOf = (it: Item) => labelOf(status, it.values[status.id])?.id ?? NONE
  const byStack = new Map<string, Item[]>(stacks.map((s) => [s.id, []]))
  items.forEach((it) => byStack.get(stackOf(it))!.push(it))
  const active = activeId ? items.find((i) => i.id === activeId) : undefined
  const group = board.groups[0]

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const item = items.find((i) => i.id === active.id)
    if (!item || !over || over.id === stackOf(item)) return
    setValue(item.id, status.id, over.id === NONE ? null : over.id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4">
        <p className="text-[12.5px] text-muted">
          <span className="font-medium text-fg tabular-nums">{items.length}</span> items · drag cards to change {status.title.toLowerCase()}
        </p>
        <ColumnPicker board={board} view={view} columns={statusCols} current={status} label="Stack by" />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="flex h-full items-start gap-3 p-5">
            {stacks.map((s) => (
              <Stack
                key={s.id}
                stack={s}
                items={byStack.get(s.id)!}
                ctx={ctx}
                onAdd={group ? (name) => addItem(board.id, group.id, name, { values: { [status.id]: s.id === NONE ? null : s.id } }) : undefined}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: 1.04, rotate: -1.5 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="w-[264px] cursor-grabbing rounded-xl border border-line-strong bg-panel p-3 shadow-[0_18px_40px_-12px_rgb(15_18_40/0.35),0_4px_12px_-4px_rgb(15_18_40/0.2)]"
            >
              <CardBody item={active} ctx={ctx} />
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Pencil,
  FolderInput,
  X,
} from 'lucide-react'
import {
  addColumn,
  addGroup,
  addItem,
  deleteItems,
  duplicateItem,
  labelOf,
  moveColumn,
  moveItem,
  openItem,
  removeColumn,
  removeGroup,
  renameItem,
  updateColumn,
  updateGroup,
  useStore,
} from '../lib/store'
import { COLOR_LIST } from '../lib/seed'
import type { Board, Column, Group, Item, View } from '../lib/types'
import { Cell, Summary } from '../components/cells'
import { COLUMN_TYPES } from '../components/columnTypes'
import { EditableText, MenuItem, Popover, cx } from '../components/ui'

const WIDTH: Record<Column['type'], number> = {
  status: 150, priority: 128, people: 112, date: 120, timeline: 200, text: 190, longtext: 200, number: 120,
  tags: 190, checkbox: 84, link: 170, rating: 128, progress: 160,
}
const NAME_W = 360
const colW = (c: Column) => c.width ?? WIDTH[c.type]

type Sort = { colId: string; dir: 1 | -1 } | null

function sortValue(col: Column | undefined, item: Item): string | number {
  if (!col) return item.name.toLowerCase()
  const v = item.values[col.id]
  if (col.type === 'status' || col.type === 'priority') return col.labels?.findIndex((l) => l.id === v) ?? 99
  if (col.type === 'timeline') return (v as { start?: string })?.start ?? '9999'
  if (Array.isArray(v)) return v.length
  if (v == null || v === '') return col.type === 'number' ? -Infinity : '￿'
  return typeof v === 'number' ? v : String(v).toLowerCase()
}

export function TableView({ board, items }: { board: Board; items: Item[]; view: View }) {
  const allItems = useStore((s) => s.item)
  const [sort, setSort] = useState<Sort>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const template = `${NAME_W}px ${board.columns.map((c) => colW(c) + 'px').join(' ')} 56px`

  const subitems = useMemo(() => {
    const m = new Map<string, Item[]>()
    Object.values(allItems)
      .filter((i) => i.boardId === board.id && i.parentId)
      .sort((a, b) => a.order - b.order)
      .forEach((i) => m.set(i.parentId!, [...(m.get(i.parentId!) ?? []), i]))
    return m
  }, [allItems, board.id])

  const byGroup = useMemo(() => {
    const sortCol = board.columns.find((c) => c.id === sort?.colId)
    const m = new Map<string, Item[]>(board.groups.map((g) => [g.id, []]))
    for (const i of items) m.get(i.groupId)?.push(i)
    if (sort)
      for (const list of m.values())
        list.sort((a, b) => {
          const x = sortValue(sort.colId === 'name' ? undefined : sortCol, a)
          const y = sortValue(sort.colId === 'name' ? undefined : sortCol, b)
          return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
        })
    return m
  }, [items, board.groups, board.columns, sort])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null)
    if (!over || active.id === over.id) return
    const overId = String(over.id)
    if (overId.startsWith('group:')) return moveItem(String(active.id), overId.slice(6), Date.now())
    const target = allItems[overId]
    if (!target) return
    const list = byGroup.get(target.groupId) ?? []
    const idx = list.findIndex((i) => i.id === target.id)
    const fromIdx = list.findIndex((i) => i.id === active.id)
    const neighbor = fromIdx !== -1 && fromIdx < idx ? list[idx + 1] : list[idx - 1]
    const order = neighbor ? (target.order + neighbor.order) / 2 : target.order + (fromIdx !== -1 && fromIdx < idx ? 1 : -1)
    moveItem(String(active.id), target.groupId, order)
    setSort(null)
  }

  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))))

  return (
    <div className="relative h-full overflow-auto px-6 pb-24 pt-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="w-max min-w-full">
          {board.groups.map((g, gi) => (
            <GroupSection
              key={g.id}
              board={board}
              group={g}
              index={gi}
              items={byGroup.get(g.id) ?? []}
              subitems={subitems}
              template={template}
              sort={sort}
              setSort={setSort}
              selected={selected}
              toggle={toggle}
              setSelected={setSelected}
            />
          ))}
          <button onClick={() => addGroup(board.id)} className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[13px] text-muted transition hover:border-accent hover:text-accent">
            <Plus className="size-4" /> Add new group
          </button>
        </div>
        <DragOverlay dropAnimation={{ duration: 180 }}>
          {dragId && allItems[dragId] ? (
            <div className="flex h-10 w-[360px] items-center gap-2 rounded-lg border border-line bg-panel px-3 text-[13px] font-medium shadow-pop ring-2 ring-accent/40">
              <GripVertical className="size-4 text-faint" /> {allItems[dragId].name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <BulkBar board={board} selected={selected} clear={() => setSelected(new Set())} />
    </div>
  )
}

function GroupSection({
  board, group, index, items, subitems, template, sort, setSort, selected, toggle, setSelected,
}: {
  board: Board
  group: Group
  index: number
  items: Item[]
  subitems: Map<string, Item[]>
  template: string
  sort: Sort
  setSort: (s: Sort) => void
  selected: Set<string>
  toggle: (id: string) => void
  setSelected: (s: Set<string>) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'group:' + group.id })
  const menuRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const allSel = items.length > 0 && items.every((i) => selected.has(i.id))
  const flat = items.flatMap((i) => [i, ...(subitems.get(i.id) ?? [])])

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 30 }}
      className="mb-8"
    >
      {/* group header */}
      <div className="sticky left-0 z-10 mb-1.5 flex w-fit items-center gap-1.5">
        <button
          onClick={() => updateGroup(board.id, group.id, { collapsed: !group.collapsed })}
          className="grid size-6 place-items-center rounded-md hover:bg-hover"
          style={{ color: group.color }}
          aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
        >
          <motion.span animate={{ rotate: group.collapsed ? -90 : 0 }}>
            <ChevronDown className="size-4" strokeWidth={2.5} />
          </motion.span>
        </button>
        <EditableText value={group.title} onCommit={(title) => updateGroup(board.id, group.id, { title })} className="font-display text-[16px] font-semibold" />
        <span className="ml-1 text-[12px] text-faint">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        <button ref={menuRef} onClick={() => setMenu(true)} aria-label="Group options" className="ml-1 grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg">
          <MoreHorizontal className="size-4" />
        </button>
        <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)} width={220}>
          <MenuItem icon={<Plus />} onClick={() => (addGroup(board.id), setMenu(false))}>Add group</MenuItem>
          <MenuItem icon={<Copy />} onClick={() => (items.forEach((i) => duplicateItem(i.id)), setMenu(false))}>Duplicate items</MenuItem>
          <div className="my-1 flex flex-wrap gap-1 px-2 py-1">
            <Palette className="mr-1 size-4 text-muted" />
            {COLOR_LIST.map((c) => (
              <button key={c} aria-label="Group color" onClick={() => updateGroup(board.id, group.id, { color: c })} className={cx('size-4 rounded-full transition hover:scale-125', c === group.color && 'ring-2 ring-offset-1 ring-offset-panel')} style={{ background: c, ['--tw-ring-color' as string]: c }} />
            ))}
          </div>
          <MenuItem icon={<Trash2 />} danger onClick={() => (removeGroup(board.id, group.id), setMenu(false))}>Delete group</MenuItem>
        </Popover>
      </div>

      {group.collapsed ? (
        <button
          onClick={() => updateGroup(board.id, group.id, { collapsed: false })}
          className="sticky left-0 flex h-11 w-[560px] items-center gap-3 rounded-lg border border-line bg-panel pl-0 pr-4 text-[13px] text-muted shadow-card"
        >
          <span className="h-full w-1.5 rounded-l-lg" style={{ background: group.color }} />
          <span className="font-medium text-fg">{group.title}</span>
          <span>{items.length} items</span>
          <span className="ml-auto w-40">{board.columns.filter((c) => c.type === 'status').slice(0, 1).map((c) => <Summary key={c.id} col={c} items={items} />)}</span>
        </button>
      ) : (
        <div ref={setNodeRef} className={cx('overflow-hidden rounded-xl border bg-panel shadow-card transition-colors', isOver ? 'border-accent' : 'border-line')}>
          {/* column header */}
          <div className="grid border-b border-line text-[12px] font-medium text-muted" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-[5] flex h-9 items-center gap-2 border-r border-line bg-panel pl-0">
              <span className="h-full w-1.5 shrink-0" style={{ background: group.color }} />
              <input
                type="checkbox"
                aria-label="Select all in group"
                checked={allSel}
                onChange={() => {
                  const next = new Set(selected)
                  items.forEach((i) => (allSel ? next.delete(i.id) : next.add(i.id)))
                  setSelected(next)
                }}
                className="ml-2 size-3.5 accent-[var(--accent)]"
              />
              <SortButton label="Item" active={sort?.colId === 'name' ? sort.dir : 0} onSort={(dir) => setSort(dir ? { colId: 'name', dir } : null)} />
            </div>
            {board.columns.map((c, ci) => (
              <ColumnHeader key={c.id} board={board} col={c} index={ci} sort={sort?.colId === c.id ? sort.dir : 0} setSort={(dir) => setSort(dir ? { colId: c.id, dir } : null)} />
            ))}
            <AddColumnButton board={board} />
          </div>

          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ItemRows key={item.id} board={board} group={group} item={item} subs={subitems.get(item.id) ?? []} template={template} selected={selected.has(item.id)} toggle={toggle} />
              ))}
            </AnimatePresence>
          </SortableContext>

          <AddRow board={board} group={group} template={template} />

          {/* summary footer */}
          <div className="grid border-t border-line bg-panel" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-[5] border-r border-transparent bg-panel" />
            {board.columns.map((c) => (
              <div key={c.id} className="grid h-10 place-items-center border-l border-line px-2">
                <Summary col={c} items={flat.filter((i) => !i.parentId)} />
              </div>
            ))}
            <div />
          </div>
        </div>
      )}
    </motion.section>
  )
}

function SortButton({ label, active, onSort }: { label: string; active: 0 | 1 | -1; onSort: (d: 0 | 1 | -1) => void }) {
  return (
    <button onClick={() => onSort(active === 0 ? 1 : active === 1 ? -1 : 0)} className="flex items-center gap-1 rounded px-1 hover:text-fg">
      {label}
      {active === 1 && <ArrowUpNarrowWide className="size-3.5 text-accent" />}
      {active === -1 && <ArrowDownNarrowWide className="size-3.5 text-accent" />}
    </button>
  )
}

function ColumnHeader({ board, col, index, sort, setSort }: { board: Board; col: Column; index: number; sort: 0 | 1 | -1; setSort: (d: 0 | 1 | -1) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const Icon = COLUMN_TYPES.find((t) => t.type === col.type)?.icon
  return (
    <div className="group/col relative flex h-9 items-center justify-center border-l border-line px-2">
      {renaming ? (
        <input
          autoFocus
          aria-label="Column name"
          defaultValue={col.title}
          onBlur={(e) => (setRenaming(false), e.target.value.trim() && updateColumn(board.id, col.id, { title: e.target.value.trim() }))}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
          className="h-7 w-full rounded bg-panel px-1 text-center text-[12px] text-fg outline-none ring-2 ring-accent"
        />
      ) : (
        <button onDoubleClick={() => setRenaming(true)} onClick={() => setSort(sort === 0 ? 1 : sort === 1 ? -1 : 0)} className="flex min-w-0 items-center gap-1 truncate hover:text-fg" title="Click to sort, double-click to rename">
          <span className="truncate">{col.title}</span>
          {sort === 1 && <ArrowUpNarrowWide className="size-3.5 shrink-0 text-accent" />}
          {sort === -1 && <ArrowDownNarrowWide className="size-3.5 shrink-0 text-accent" />}
        </button>
      )}
      <button ref={ref} onClick={() => setOpen(true)} aria-label={`${col.title} options`} className="absolute right-1 grid size-6 place-items-center rounded text-faint opacity-0 hover:bg-hover hover:text-fg group-hover/col:opacity-100">
        <MoreHorizontal className="size-3.5" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={220} align="end">
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-faint">
          {Icon && <Icon className="size-3.5" />} {COLUMN_TYPES.find((t) => t.type === col.type)?.label}
        </div>
        <MenuItem icon={<Pencil />} onClick={() => (setOpen(false), setRenaming(true))}>Rename</MenuItem>
        <MenuItem icon={<ArrowUpNarrowWide />} onClick={() => (setSort(1), setOpen(false))}>Sort ascending</MenuItem>
        <MenuItem icon={<ArrowDownNarrowWide />} onClick={() => (setSort(-1), setOpen(false))}>Sort descending</MenuItem>
        {index > 0 && <MenuItem icon={<ArrowLeft />} onClick={() => (moveColumn(board.id, index, index - 1), setOpen(false))}>Move left</MenuItem>}
        {index < board.columns.length - 1 && <MenuItem icon={<ArrowRight />} onClick={() => (moveColumn(board.id, index, index + 1), setOpen(false))}>Move right</MenuItem>}
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
          <span className="text-muted">Width</span>
          <input type="range" min={80} max={420} defaultValue={colW(col)} aria-label="Column width" onChange={(e) => updateColumn(board.id, col.id, { width: Number(e.target.value) })} className="flex-1 accent-[var(--accent)]" />
        </div>
        {col.type === 'number' && (
          <label className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-muted">
            Unit
            <input defaultValue={col.unit} placeholder="€, h, pts" onBlur={(e) => updateColumn(board.id, col.id, { unit: e.target.value || undefined })} className="h-7 w-20 rounded border border-line bg-panel px-2 text-fg outline-none focus:border-accent" />
          </label>
        )}
        <MenuItem icon={<Trash2 />} danger onClick={() => (removeColumn(board.id, col.id), setOpen(false))}>Delete column</MenuItem>
      </Popover>
    </div>
  )
}

function AddColumnButton({ board }: { board: Board }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <div className="grid place-items-center border-l border-line">
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Add column" className="grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-accent">
        <Plus className="size-4" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={300} align="end">
        <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">Add column</div>
        <div className="grid grid-cols-2 gap-1">
          {COLUMN_TYPES.map((t) => (
            <button key={t.type} onClick={() => (addColumn(board.id, t.type), setOpen(false))} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-hover">
              <span className="grid size-7 place-items-center rounded-md text-white" style={{ background: t.color }}>
                <t.icon className="size-4" />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

function ItemRows({ board, group, item, subs, template, selected, toggle }: { board: Board; group: Group; item: Item; subs: Item[]; template: string; selected: boolean; toggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const sortable = useSortable({ id: item.id })
  const style: CSSProperties = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition, gridTemplateColumns: template }
  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      >
        <div ref={sortable.setNodeRef} style={style} className={cx('group/row grid border-t border-line', sortable.isDragging && 'opacity-30', selected && 'bg-accent-soft/60')}>
          <NameCell board={board} group={group} item={item} subCount={subs.length} expanded={expanded} setExpanded={setExpanded} selected={selected} toggle={toggle} handle={{ ...sortable.attributes, ...sortable.listeners }} />
          {board.columns.map((c) => (
            <div key={c.id} className="h-10 border-l border-line">
              <Cell board={board} col={c} item={item} groupColor={group.color} />
            </div>
          ))}
          <div className="border-l border-line" />
        </div>
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden bg-panel-2/50">
            {subs.map((s) => (
              <div key={s.id} className="grid border-t border-line" style={{ gridTemplateColumns: template }}>
                <div className="sticky left-0 z-[4] flex h-9 items-center gap-2 border-r border-line bg-panel-2 pl-14 pr-2 text-[13px]">
                  <span className="h-px w-3 bg-line-strong" />
                  <EditableText value={s.name} onCommit={(n) => renameItem(s.id, n)} className="flex-1" />
                  <button onClick={() => openItem(s.id)} aria-label="Open subitem" className="text-faint opacity-0 hover:text-accent group-hover:opacity-100">
                    <Maximize2 className="size-3.5" />
                  </button>
                  <button onClick={() => deleteItems([s.id])} aria-label="Delete subitem" className="text-faint hover:text-red-500">
                    <X className="size-3.5" />
                  </button>
                </div>
                {board.columns.map((c) => (
                  <div key={c.id} className="h-9 border-l border-line">
                    <Cell board={board} col={c} item={s} groupColor={group.color} />
                  </div>
                ))}
                <div className="border-l border-line" />
              </div>
            ))}
            <div className="grid border-t border-line" style={{ gridTemplateColumns: template }}>
              <QuickAdd placeholder="+ Add subitem" className="pl-14" onAdd={(name) => addItem(board.id, group.id, name, { parentId: item.id })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function NameCell({
  board, group, item, subCount, expanded, setExpanded, selected, toggle, handle,
}: {
  board: Board
  group: Group
  item: Item
  subCount: number
  expanded: boolean
  setExpanded: (v: boolean) => void
  selected: boolean
  toggle: (id: string) => void
  handle: Record<string, unknown>
}) {
  const updates = useStore((s) => Object.values(s.update).filter((u) => u.itemId === item.id).length)
  const done = board.columns.some((c) => c.type === 'status' && labelOf(c, item.values[c.id])?.done)
  return (
    <div className={cx('sticky left-0 z-[4] flex h-10 items-center gap-1.5 border-r border-line pr-2 text-[13.5px]', selected ? 'bg-accent-soft' : 'bg-panel group-hover/row:bg-[color-mix(in_oklab,var(--panel)_92%,var(--accent))]')}>
      <span className="h-full w-1.5 shrink-0" style={{ background: group.color, opacity: 0.55 }} />
      <button {...handle} aria-label="Drag to reorder" className="grid w-4 cursor-grab place-items-center text-faint opacity-0 active:cursor-grabbing group-hover/row:opacity-100">
        <GripVertical className="size-3.5" />
      </button>
      <input type="checkbox" aria-label={`Select ${item.name}`} checked={selected} onChange={() => toggle(item.id)} className="size-3.5 accent-[var(--accent)]" />
      <button onClick={() => setExpanded(!expanded)} aria-label="Toggle subitems" className={cx('grid size-5 place-items-center rounded text-faint hover:bg-hover hover:text-fg', !subCount && 'opacity-0 group-hover/row:opacity-100')}>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }}>
          <ChevronRight className="size-3.5" />
        </motion.span>
      </button>
      <EditableText value={item.name} onCommit={(n) => renameItem(item.id, n)} className={cx('min-w-0 flex-1', done && 'text-muted line-through decoration-faint/60')} />
      {subCount > 0 && <span className="rounded-full bg-panel-2 px-1.5 text-[11px] text-muted">{subCount}</span>}
      <button onClick={() => openItem(item.id)} aria-label="Open item" className={cx('flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] transition', updates ? 'text-accent' : 'text-faint opacity-0 group-hover/row:opacity-100', 'hover:bg-hover')}>
        {updates ? (
          <>
            <MessageCircle className="size-4" /> {updates}
          </>
        ) : (
          <Maximize2 className="size-3.5" />
        )}
      </button>
    </div>
  )
}

function QuickAdd({ onAdd, placeholder, className }: { onAdd: (name: string) => void; placeholder: string; className?: string }) {
  const [v, setV] = useState('')
  return (
    <div className={cx('sticky left-0 z-[4] flex h-9 items-center border-r border-line bg-inherit pr-2', className)}>
      <input
        value={v}
        aria-label={placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v.trim()) (onAdd(v.trim()), setV(''))
          if (e.key === 'Escape') (setV(''), e.currentTarget.blur())
        }}
        onBlur={() => v.trim() && (onAdd(v.trim()), setV(''))}
        placeholder={placeholder}
        className="h-7 w-full rounded-md bg-transparent px-2 text-[13px] outline-none placeholder:text-faint focus:bg-panel focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}

function AddRow({ board, group, template }: { board: Board; group: Group; template: string }) {
  return (
    <div className="grid border-t border-line bg-panel" style={{ gridTemplateColumns: template }}>
      <div className="sticky left-0 z-[4] flex bg-panel">
        <span className="w-1.5 shrink-0" style={{ background: group.color, opacity: 0.25 }} />
        <QuickAdd placeholder="+ Add item" className="flex-1 pl-8" onAdd={(name) => addItem(board.id, group.id, name)} />
      </div>
    </div>
  )
}

function BulkBar({ board, selected, clear }: { board: Board; selected: Set<string>; clear: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const ids = [...selected]
  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 80, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-6 left-1/2 z-40 flex items-center gap-1 rounded-2xl border border-line bg-panel p-1.5 shadow-pop"
        >
          <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-accent px-2 text-[13px] font-semibold text-white">{ids.length}</span>
          <span className="px-2 text-[13px] font-medium">selected</span>
          <span className="mx-1 h-6 w-px bg-line" />
          <BulkBtn icon={<Copy />} label="Duplicate" onClick={() => (ids.forEach(duplicateItem), clear())} />
          <BulkBtn icon={<FolderInput />} label="Move to" btnRef={ref} onClick={() => setMoveOpen(true)} />
          <BulkBtn icon={<Trash2 />} label="Delete" danger onClick={() => (deleteItems(ids), clear())} />
          <span className="mx-1 h-6 w-px bg-line" />
          <button onClick={clear} aria-label="Clear selection" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-hover">
            <X className="size-4" />
          </button>
          <Popover anchor={ref.current} open={moveOpen} onClose={() => setMoveOpen(false)} width={220} align="center">
            {board.groups.map((g) => (
              <MenuItem key={g.id} icon={<span className="size-3 rounded-full" style={{ background: g.color }} />} onClick={() => (ids.forEach((id) => moveItem(id, g.id, Date.now())), setMoveOpen(false), clear())}>
                {g.title}
              </MenuItem>
            ))}
          </Popover>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BulkBtn({ icon, label, onClick, danger, btnRef }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; btnRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={btnRef} onClick={onClick} className={cx('flex h-9 flex-col items-center justify-center rounded-xl px-3 text-[11px] [&>svg]:size-4', danger ? 'text-red-500 hover:bg-red-500/10' : 'text-muted hover:bg-hover hover:text-fg')}>
      {icon}
      {label}
    </button>
  )
}

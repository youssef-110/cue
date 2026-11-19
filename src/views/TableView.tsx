import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { cellScalar, shortId, timeTotal } from '../lib/formula'
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
  Archive,
  ChevronsDownUp,
  ChevronsUpDown,
  ArrowRightLeft,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useViewSetting } from '../lib/filters'
import {
  addColumn,
  addGroup,
  addItem,
  archiveGroup,
  archiveItems,
  deleteItems,
  duplicateGroup,
  duplicateItem,
  isLive,
  moveGroupToBoard,
  setAllGroupsCollapsed,
  setValue,
  useCanEdit,
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
import type { Board, CellValue, Column, Group, Item, User, View } from '../lib/types'
import { Cell, Summary } from '../components/cells'
import { COLUMN_TYPES } from '../components/columnTypes'
import { EditableText, MenuItem, Popover, cx } from '../components/ui'

const WIDTH: Record<Column['type'], number> = {
  status: 150, priority: 128, people: 112, date: 120, timeline: 200, text: 190, longtext: 200, number: 120,
  tags: 190, checkbox: 84, link: 170, rating: 128, progress: 160,
  formula: 140, time: 140, dependency: 190, connect: 200, mirror: 170, files: 160, email: 190, phone: 150, vote: 120,
  created: 150, updated: 150, itemId: 100, location: 190,
  hour: 110, week: 170, country: 170, worldclock: 170, color: 130, button: 140,
}
const NAME_W = 380
const colW = (c: Column) => c.width ?? WIDTH[c.type]

type Sort = { colId: string; dir: 1 | -1 } | null

function sortValue(col: Column | undefined, item: Item): string | number {
  if (!col) return item.name.toLowerCase()
  const v = item.values[col.id]
  if (col.type === 'status' || col.type === 'priority') return col.labels?.findIndex((l) => l.id === v) ?? 99
  if (col.type === 'timeline') return (v as { start?: string })?.start ?? '9999'
  if (col.type === 'time') return timeTotal(v)
  if (col.type === 'created') return item.createdAt
  if (col.type === 'updated') return item.updatedAt ?? item.createdAt
  if (col.type === 'itemId') return shortId(item)
  if (col.type === 'formula' || col.type === 'mirror') {
    const s = useStore.getState()
    try {
      const x = cellScalar(s.board[item.boardId], col, item, { users: s.user, items: s.item, boards: s.board })
      return typeof x === 'number' ? x : x == null || x === '' ? '￿' : String(x).toLowerCase()
    } catch {
      return '￿'
    }
  }
  if (Array.isArray(v)) return v.length
  if (v == null || v === '') return col.type === 'number' ? -Infinity : '￿'
  return typeof v === 'number' ? v : String(v).toLowerCase()
}

const GROUPABLE: Column['type'][] = ['status', 'priority', 'people', 'date', 'timeline']
type VGroup = Group & { value: CellValue }
const NO_COLOR = '#8a8a84'

/** Virtual groups for "Group by <column>": one per label / person / month, plus an empty bucket. */
function virtualGroups(col: Column, items: Item[], users: Record<string, User>) {
  const v = (i: Item) => i.values[col.id]
  let groups: VGroup[] = []
  let keyOf: (i: Item) => string
  let empty: VGroup
  if (col.type === 'status' || col.type === 'priority') {
    groups = (col.labels ?? []).map((l) => ({ id: 'v:' + l.id, title: l.name, color: l.color, value: l.id }))
    keyOf = (i) => (labelOf(col, v(i)) ? 'v:' + v(i) : 'v:')
    empty = { id: 'v:', title: 'Empty', color: NO_COLOR, value: null }
  } else if (col.type === 'people') {
    const first = (i: Item) => ((v(i) as string[]) ?? []).find((u) => users[u])
    const ids = [...new Set(items.map(first).filter((u): u is string => !!u))].sort((a, b) => users[a].name.localeCompare(users[b].name))
    groups = ids.map((u) => ({ id: 'v:' + u, title: users[u].name, color: users[u].color, value: [u] }))
    keyOf = (i) => 'v:' + (first(i) ?? '')
    empty = { id: 'v:', title: 'Unassigned', color: NO_COLOR, value: [] }
  } else {
    const month = (i: Item) => {
      const d = typeof v(i) === 'string' ? (v(i) as string) : (v(i) as { start?: string } | null)?.start
      return d ? d.slice(0, 7) : ''
    }
    const months = [...new Set(items.map(month).filter(Boolean))].sort()
    groups = months.map((m, k) => {
      const day = m + '-01'
      return { id: 'v:' + m, title: format(parseISO(day), 'MMMM yyyy'), color: COLOR_LIST[(k * 3) % COLOR_LIST.length], value: col.type === 'timeline' ? { start: day, end: day } : day }
    })
    keyOf = (i) => 'v:' + month(i)
    empty = { id: 'v:', title: 'No date', color: NO_COLOR, value: null }
  }
  if (items.some((i) => keyOf(i) === 'v:')) groups.push(empty)
  return { groups, keyOf }
}

export function TableView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const allItems = useStore((s) => s.item)
  const users = useStore((s) => s.user)
  const editable = useCanEdit()
  const [sort, setSort] = useState<Sort>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useViewSetting(board, view, 'groupBy')
  // collapse is shared on board groups for editors; virtual groups (and viewers) keep it on this page
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set())
  const pointer = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const sensors = useSensors(editable ? pointer : null)
  const template = `${NAME_W}px ${board.columns.map((c) => colW(c) + 'px').join(' ')} 48px`
  const gbCol = board.columns.find((c) => c.id === groupBy && GROUPABLE.includes(c.type))
  const virtual = useMemo(() => (gbCol ? virtualGroups(gbCol, items, users) : null), [gbCol, items, users])
  const groups: Group[] = virtual?.groups ?? board.groups
  const localOnly = !!virtual || !editable
  const isCollapsed = (g: Group) => (localOnly ? localCollapsed.has(g.id) : !!g.collapsed)
  const toggleCollapsed = (g: Group) => {
    if (!localOnly) return updateGroup(board.id, g.id, { collapsed: !g.collapsed })
    const n = new Set(localCollapsed)
    if (n.has(g.id)) n.delete(g.id)
    else n.add(g.id)
    setLocalCollapsed(n)
  }
  const collapseAll = (c: boolean) => (localOnly ? setLocalCollapsed(new Set(c ? groups.map((g) => g.id) : [])) : setAllGroupsCollapsed(board.id, c))

  const subitems = useMemo(() => {
    const m = new Map<string, Item[]>()
    Object.values(allItems)
      .filter((i) => i.boardId === board.id && i.parentId && isLive(i))
      .sort((a, b) => a.order - b.order)
      .forEach((i) => m.set(i.parentId!, [...(m.get(i.parentId!) ?? []), i]))
    return m
  }, [allItems, board.id])

  const byGroup = useMemo(() => {
    const sortCol = board.columns.find((c) => c.id === sort?.colId)
    const m = new Map<string, Item[]>(groups.map((g) => [g.id, []]))
    for (const i of items) m.get(virtual ? virtual.keyOf(i) : i.groupId)?.push(i)
    if (sort)
      for (const list of m.values())
        list.sort((a, b) => {
          const x = sortValue(sort.colId === 'name' ? undefined : sortCol, a)
          const y = sortValue(sort.colId === 'name' ? undefined : sortCol, b)
          return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
        })
    return m
  }, [items, groups, virtual, board.columns, sort])

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragId(null)
    if (!over || active.id === over.id) return
    const overId = String(over.id)
    if (virtual && gbCol) {
      // dropping into another virtual group sets that group's value
      const key = overId.startsWith('group:') ? overId.slice(6) : allItems[overId] && virtual.keyOf(allItems[overId])
      const g = virtual.groups.find((x) => x.id === key)
      const moving = allItems[String(active.id)]
      if (g && moving && virtual.keyOf(moving) !== g.id) setValue(moving.id, gbCol.id, g.value)
      return
    }
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
    <div className="relative h-full overflow-auto px-4 pb-24 pt-1 sm:px-8">
      <div className="sticky left-0 mb-2 flex w-fit max-w-full flex-wrap items-center gap-1 text-[13px]">
        <label className="flex items-center gap-2">
          <span className="caps whitespace-nowrap text-[12px] font-semibold tracking-[0.12em] text-muted">Group by</span>
          <select
            aria-label="Group by"
            value={gbCol?.id ?? ''}
            onChange={(e) => (setGroupBy(e.target.value || undefined), setLocalCollapsed(new Set()))}
            className="h-8 rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent"
          >
            <option value="">Groups</option>
            {board.columns
              .filter((c) => GROUPABLE.includes(c.type))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.type === 'date' || c.type === 'timeline' ? ' (by month)' : ''}
                </option>
              ))}
          </select>
        </label>
        <span className="mx-2 h-5 w-px bg-line-strong" />
        <button onClick={() => collapseAll(true)} className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-muted transition-colors hover:bg-hover hover:text-fg">
          <ChevronsDownUp className="size-4" /> Collapse all
        </button>
        <button onClick={() => collapseAll(false)} className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-muted transition-colors hover:bg-hover hover:text-fg">
          <ChevronsUpDown className="size-4" /> Expand all
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="w-max min-w-full">
          {groups.map((g, gi) => (
            <GroupSection
              key={g.id}
              board={board}
              group={g}
              virtual={virtual && gbCol ? { [gbCol.id]: (g as VGroup).value } : undefined}
              collapsed={isCollapsed(g)}
              onToggleCollapse={() => toggleCollapsed(g)}
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
          {editable && !virtual && (
            <button onClick={() => addGroup(board.id)} className="caps sticky left-0 mt-2 flex h-9 items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 text-[13px] font-semibold tracking-[0.1em] text-muted transition-colors hover:border-fg hover:text-fg">
              <Plus className="size-4" /> Add new group
            </button>
          )}
        </div>
        <DragOverlay dropAnimation={{ duration: 140 }}>
          {dragId && allItems[dragId] ? (
            <div className="flex h-10 w-[380px] items-center gap-2 rounded-sm border border-accent bg-panel px-3 text-[13.5px] font-medium shadow-pop">
              <GripVertical className="size-4 text-faint" /> {allItems[dragId].name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {editable && <BulkBar board={board} selected={selected} clear={() => setSelected(new Set())} />}
    </div>
  )
}

function GroupSection({
  board, group, virtual, collapsed, onToggleCollapse, index, items, subitems, template, sort, setSort, selected, toggle, setSelected,
}: {
  board: Board
  group: Group
  virtual?: Record<string, CellValue> // values new items get in a virtual (group-by) group
  collapsed: boolean
  onToggleCollapse: () => void
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
  const editable = useCanEdit()
  const boards = useStore((s) => s.board)
  const menuRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const [moveTo, setMoveTo] = useState(false)
  const realGroup = !virtual && editable
  const allSel = items.length > 0 && items.every((i) => selected.has(i.id))
  const flat = items.flatMap((i) => [i, ...(subitems.get(i.id) ?? [])])

  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.03, duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
      className="mb-9"
    >
      {/* group header */}
      <div className="sticky left-0 z-10 mb-2 flex w-fit items-center gap-2">
        <button
          onClick={onToggleCollapse}
          className="grid size-6 place-items-center rounded-sm text-fg transition-colors hover:bg-hover"
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
          aria-expanded={!collapsed}
        >
          <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={{ duration: 0.12 }}>
            <ChevronDown className="size-4" strokeWidth={2.25} />
          </motion.span>
        </button>
        <span className="size-2.5 shrink-0" style={{ background: group.color }} aria-hidden />
        {realGroup ? (
          <EditableText value={group.title} onCommit={(title) => updateGroup(board.id, group.id, { title })} className="caps text-[18px] font-bold leading-none tracking-[0.1em]" />
        ) : (
          <span className="caps text-[18px] font-bold leading-none tracking-[0.1em]">{group.title}</span>
        )}
        <span className="font-mono text-[12px] text-muted">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
        {realGroup && (
          <button ref={menuRef} onClick={() => setMenu(true)} aria-label="Group options" className="grid size-6 place-items-center rounded-sm text-muted transition-colors hover:bg-hover hover:text-fg">
            <MoreHorizontal className="size-4" />
          </button>
        )}
        <Popover anchor={menuRef.current} open={menu} onClose={() => (setMenu(false), setMoveTo(false))} width={230}>
          {moveTo ? (
            <>
              <div className="caps px-2 pb-1 pt-1 text-[12px] font-semibold tracking-[0.12em] text-muted">Move group to board</div>
              {Object.values(boards)
                .filter((b) => b.id !== board.id && isLive(b))
                .map((b) => (
                  <MenuItem key={b.id} icon={<span className="size-[7px] border border-muted" />} onClick={() => (moveGroupToBoard(board.id, group.id, b.id), setMenu(false), setMoveTo(false))}>
                    {b.name}
                  </MenuItem>
                ))}
            </>
          ) : (
          <>
          <MenuItem icon={<Plus />} onClick={() => (addGroup(board.id), setMenu(false))}>Add group</MenuItem>
          <MenuItem icon={<Copy />} onClick={() => (duplicateGroup(board.id, group.id), setMenu(false))}>Duplicate group</MenuItem>
          <MenuItem icon={<ArrowRightLeft />} onClick={() => setMoveTo(true)}>Move to board…</MenuItem>
          <MenuItem icon={<Copy />} onClick={() => (items.forEach((i) => duplicateItem(i.id)), setMenu(false))}>Duplicate items</MenuItem>
          <div className="my-1 flex flex-wrap items-center gap-1 border-y border-line px-2.5 py-2">
            <Palette className="mr-1 size-4 text-muted" />
            {COLOR_LIST.map((c) => (
              <button
                key={c}
                aria-label="Group colour"
                aria-pressed={c === group.color}
                onClick={() => updateGroup(board.id, group.id, { color: c })}
                className={cx('size-4 rounded-sm ring-offset-1 ring-offset-panel transition-shadow hover:ring-1 hover:ring-line-strong', c === group.color && 'ring-2 !ring-accent')}
                style={{ background: c }}
              />
            ))}
          </div>
          <MenuItem icon={<Archive />} onClick={() => (archiveGroup(board.id, group.id), setMenu(false))}>Archive group</MenuItem>
          <MenuItem icon={<Trash2 />} danger onClick={() => (removeGroup(board.id, group.id), setMenu(false))}>Delete group</MenuItem>
          </>
          )}
        </Popover>
      </div>

      {collapsed ? (
        <button
          onClick={onToggleCollapse}
          className="sticky left-0 flex h-10 w-[560px] items-center gap-3 border border-line border-t-2 border-t-fg bg-panel px-3 text-[13px] text-muted transition-colors hover:bg-panel-2"
        >
          <span className="text-[13.5px] text-fg">{items.length ? `${items.length} hidden` : 'Empty group'}</span>
          <span className="ml-auto w-40">{board.columns.filter((c) => c.type === 'status').slice(0, 1).map((c) => <Summary key={c.id} col={c} items={items} />)}</span>
        </button>
      ) : (
        <div ref={setNodeRef} className={cx('border bg-panel transition-colors', isOver ? 'border-accent' : 'border-line')}>
          {/* column header: condensed caps over a 2px ink rule */}
          <div className="caps grid border-b-2 border-fg text-[12px] font-semibold tracking-[0.12em] text-fg" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-[5] flex h-9 items-center gap-2 border-r border-line bg-panel pl-1">
              <input
                type="checkbox"
                aria-label="Select all in group"
                hidden={!editable}
                checked={allSel}
                onChange={() => {
                  const next = new Set(selected)
                  items.forEach((i) => (allSel ? next.delete(i.id) : next.add(i.id)))
                  setSelected(next)
                }}
                className="ml-[22px] size-3.5 accent-[var(--accent)]"
              />
              <SortButton label="Item" active={sort?.colId === 'name' ? sort.dir : 0} onSort={(dir) => setSort(dir ? { colId: 'name', dir } : null)} />
            </div>
            {board.columns.map((c, ci) => (
              <ColumnHeader key={c.id} board={board} col={c} index={ci} sort={sort?.colId === c.id ? sort.dir : 0} setSort={(dir) => setSort(dir ? { colId: c.id, dir } : null)} />
            ))}
            {editable ? <AddColumnButton board={board} /> : <div />}
          </div>

          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <ItemRows key={item.id} board={board} group={group} item={item} subs={subitems.get(item.id) ?? []} template={template} selected={selected.has(item.id)} toggle={toggle} />
              ))}
            </AnimatePresence>
          </SortableContext>

          {editable && board.groups[0] && <AddRow board={board} group={virtual ? board.groups[0] : group} color={group.color} values={virtual} template={template} />}

          {/* summary footer */}
          <div className="grid border-t border-line bg-panel-2/60" style={{ gridTemplateColumns: template }}>
            <div className="caps sticky left-0 z-[5] flex items-center border-r border-line bg-panel-2 pl-12 text-[11px] font-semibold tracking-[0.14em] text-faint">Summary</div>
            {board.columns.map((c) => (
              <div key={c.id} className="grid h-10 place-items-center border-l border-line px-3">
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
    <button onClick={() => onSort(active === 0 ? 1 : active === 1 ? -1 : 0)} className="caps flex items-center gap-1 rounded-sm px-1 tracking-[0.12em] hover:text-accent">
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
  const editable = useCanEdit()
  const Icon = COLUMN_TYPES.find((t) => t.type === col.type)?.icon
  return (
    <div className="group/col relative flex h-9 items-center border-l border-line pl-3 pr-7">
      {renaming ? (
        <input
          autoFocus
          aria-label="Column name"
          defaultValue={col.title}
          onBlur={(e) => (setRenaming(false), e.target.value.trim() && updateColumn(board.id, col.id, { title: e.target.value.trim() }))}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
          className="h-7 w-full rounded-sm bg-panel px-1 font-sans text-[13px] normal-case tracking-normal text-fg outline-none ring-2 ring-accent"
        />
      ) : (
        <button onDoubleClick={() => editable && setRenaming(true)} onClick={() => setSort(sort === 0 ? 1 : sort === 1 ? -1 : 0)} className="flex min-w-0 items-center gap-1 truncate uppercase transition-colors hover:text-accent" title="Click to sort, double-click to rename">
          <span className="truncate">{col.title}</span>
          {sort === 1 && <ArrowUpNarrowWide className="size-3.5 shrink-0 text-accent" />}
          {sort === -1 && <ArrowDownNarrowWide className="size-3.5 shrink-0 text-accent" />}
        </button>
      )}
      <button ref={ref} hidden={!editable} onClick={() => setOpen(true)} aria-label={`${col.title} options`} className="absolute right-1 grid size-6 place-items-center rounded-sm text-muted opacity-0 transition-opacity hover:bg-hover hover:text-fg focus-visible:opacity-100 group-hover/col:opacity-100">
        <MoreHorizontal className="size-3.5" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={220} align="end">
        <div className="caps flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold tracking-[0.12em] text-muted">
          {Icon && <Icon className="size-3.5" />} {COLUMN_TYPES.find((t) => t.type === col.type)?.label}
        </div>
        <MenuItem icon={<Pencil />} onClick={() => (setOpen(false), setRenaming(true))}>Rename</MenuItem>
        <MenuItem icon={<ArrowUpNarrowWide />} onClick={() => (setSort(1), setOpen(false))}>Sort ascending</MenuItem>
        <MenuItem icon={<ArrowDownNarrowWide />} onClick={() => (setSort(-1), setOpen(false))}>Sort descending</MenuItem>
        {index > 0 && <MenuItem icon={<ArrowLeft />} onClick={() => (moveColumn(board.id, index, index - 1), setOpen(false))}>Move left</MenuItem>}
        {index < board.columns.length - 1 && <MenuItem icon={<ArrowRight />} onClick={() => (moveColumn(board.id, index, index + 1), setOpen(false))}>Move right</MenuItem>}
        <div className="flex items-center gap-2 border-y border-line px-2.5 py-2 text-[13px]">
          <span className="text-muted">Width</span>
          <input type="range" min={80} max={420} defaultValue={colW(col)} aria-label="Column width" onChange={(e) => updateColumn(board.id, col.id, { width: Number(e.target.value) })} className="flex-1 accent-[var(--accent)]" />
        </div>
        {col.type === 'number' && (
          <label className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-muted">
            Unit
            <input defaultValue={col.unit} placeholder="€, h, pts" onBlur={(e) => updateColumn(board.id, col.id, { unit: e.target.value || undefined })} className="h-7 w-20 rounded-md border border-line-strong bg-panel px-2 text-fg outline-none focus:border-accent" />
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
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Add column" title="Add column" className="grid size-7 place-items-center rounded-sm text-muted transition-colors hover:bg-hover hover:text-fg">
        <Plus className="size-4" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={300} align="end">
        <div className="caps px-2 pb-1.5 pt-1 text-[12px] font-semibold tracking-[0.12em] text-muted">Add column</div>
        <div className="grid grid-cols-2 gap-0.5">
          {COLUMN_TYPES.map((t) => (
            <button key={t.type} onClick={() => (addColumn(board.id, t.type), setOpen(false))} className="flex h-9 items-center gap-2 rounded-sm px-2 text-left text-[13px] hover:bg-hover">
              <span className="grid size-6 place-items-center rounded-sm border border-line-strong text-fg">
                <t.icon className="size-3.5" />
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
  const editable = useCanEdit()
  const sortable = useSortable({ id: item.id })
  const style: CSSProperties = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition, gridTemplateColumns: template }
  return (
    <>
      <motion.div
        layout="position"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.14, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div
          ref={sortable.setNodeRef}
          style={style}
          aria-selected={selected}
          className={cx('group/row relative grid border-t border-line transition-colors', sortable.isDragging && 'opacity-30', selected ? 'bg-accent-soft' : 'hover:bg-panel-2')}
        >
          {/* selected row: soft tint + a 1px blue inset outline drawn above the sticky name cell */}
          {selected && <span aria-hidden className="pointer-events-none absolute inset-0 z-[6] ring-1 ring-inset ring-accent" />}
          <NameCell board={board} group={group} item={item} subCount={subs.length} expanded={expanded} setExpanded={setExpanded} selected={selected} toggle={toggle} handle={{ ...sortable.attributes, ...sortable.listeners }} />
          {board.columns.map((c) => (
            <div key={c.id} inert={!editable} className="h-10 border-l border-line">
              <Cell board={board} col={c} item={item} groupColor={group.color} />
            </div>
          ))}
          <div className="border-l border-line" />
        </div>
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.14, ease: 'easeOut' }} className="overflow-hidden bg-panel-2/60">
            {subs.map((s) => (
              <div key={s.id} className="grid border-t border-line" style={{ gridTemplateColumns: template }}>
                <div className="sticky left-0 z-[4] flex h-9 items-center gap-2 border-r border-line bg-panel-2 pl-16 pr-2 text-[13.5px]">
                  <span className="h-px w-3 bg-line-strong" />
                  {editable ? <EditableText value={s.name} onCommit={(n) => renameItem(s.id, n)} className="flex-1" /> : <span className="flex-1 truncate">{s.name}</span>}
                  <button onClick={() => openItem(s.id)} aria-label="Open subitem" className="text-muted opacity-0 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100">
                    <Maximize2 className="size-3.5" />
                  </button>
                  <button hidden={!editable} onClick={() => deleteItems([s.id])} aria-label="Delete subitem" className="text-faint hover:text-alert">
                    <X className="size-3.5" />
                  </button>
                </div>
                {board.columns.map((c) => (
                  <div key={c.id} inert={!editable} className="h-9 border-l border-line">
                    <Cell board={board} col={c} item={s} groupColor={group.color} />
                  </div>
                ))}
                <div className="border-l border-line" />
              </div>
            ))}
            {editable && (
              <div className="grid border-t border-line" style={{ gridTemplateColumns: template }}>
                <QuickAdd placeholder="Add subitem" className="pl-14" onAdd={(name) => addItem(board.id, item.groupId, name, { parentId: item.id })} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function NameCell({
  board, item, subCount, expanded, setExpanded, selected, toggle, handle,
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
  const editable = useCanEdit()
  const done = board.columns.some((c) => c.type === 'status' && labelOf(c, item.values[c.id])?.done)
  return (
    <div className={cx('sticky left-0 z-[4] flex h-10 items-center gap-1.5 border-r border-line pl-1 pr-2 text-[14px] transition-colors', selected ? 'bg-accent-soft' : 'bg-panel group-hover/row:bg-panel-2')}>
      <button {...handle} hidden={!editable} aria-label="Drag to reorder" title="Drag to reorder" className="grid w-4 cursor-grab place-items-center text-faint opacity-0 hover:text-fg focus-visible:opacity-100 active:cursor-grabbing group-hover/row:opacity-100">
        <GripVertical className="size-3.5" />
      </button>
      <input type="checkbox" hidden={!editable} aria-label={`Select ${item.name}`} checked={selected} onChange={() => toggle(item.id)} className="size-3.5 accent-[var(--accent)]" />
      <button onClick={() => setExpanded(!expanded)} aria-label="Toggle subitems" aria-expanded={expanded} className={cx('grid size-5 place-items-center rounded-sm text-muted hover:bg-hover hover:text-fg', !subCount && 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')}>
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.12 }}>
          <ChevronRight className="size-3.5" />
        </motion.span>
      </button>
      {editable ? (
        <EditableText value={item.name} onCommit={(n) => renameItem(item.id, n)} className={cx('min-w-0 flex-1', done && 'text-muted')} />
      ) : (
        <span className={cx('min-w-0 flex-1 truncate', done && 'text-muted')}>{item.name}</span>
      )}
      {subCount > 0 && <span title={`${subCount} subitems`} className="rounded-sm border border-line-strong px-1 font-mono text-[11px] text-muted">{subCount}</span>}
      <button onClick={() => openItem(item.id)} aria-label="Open item" title="Open item" className={cx('flex items-center gap-1 rounded-sm px-1.5 py-1 text-[12px] transition-colors hover:bg-hover', updates ? 'text-accent' : 'text-muted opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')}>
        {updates ? (
          <>
            <MessageCircle className="size-4" /> <span className="font-mono">{updates}</span>
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
        className="h-7 w-full rounded-sm bg-transparent px-2 text-[13.5px] outline-none placeholder:text-faint focus:bg-panel focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}

function AddRow({ board, group, values, template }: { board: Board; group: Group; color: string; values?: Record<string, CellValue>; template: string }) {
  return (
    <div className="grid border-t border-line bg-panel" style={{ gridTemplateColumns: template }}>
      <div className="sticky left-0 z-[4] flex items-center bg-panel pl-6 text-faint">
        <Plus className="size-3.5 shrink-0" aria-hidden />
        <QuickAdd placeholder="Add item" className="flex-1 pl-1" onAdd={(name) => addItem(board.id, group.id, name, { values: values && structuredClone(values) })} />
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
          initial={{ y: 4, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 4, opacity: 0, x: '-50%' }}
          transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed bottom-6 left-1/2 z-40 flex items-center gap-0.5 rounded-lg border border-on-ink/15 bg-ink p-1.5 text-on-ink shadow-pop"
        >
          <span className="grid h-9 min-w-9 place-items-center rounded-md bg-signal px-2 font-mono text-[14px] font-semibold text-on-signal">{ids.length}</span>
          <span className="caps px-2 text-[14px] font-semibold tracking-[0.1em]">Selected</span>
          <span className="mx-1 h-6 w-px bg-on-ink/15" />
          <BulkBtn icon={<Copy />} label="Duplicate" onClick={() => (ids.forEach(duplicateItem), clear())} />
          <BulkBtn icon={<FolderInput />} label="Move to" btnRef={ref} onClick={() => setMoveOpen(true)} />
          <BulkBtn icon={<Archive />} label="Archive" onClick={() => (archiveItems(ids), clear())} />
          <BulkBtn icon={<Trash2 />} label="Delete" danger onClick={() => (deleteItems(ids), clear())} />
          <span className="mx-1 h-6 w-px bg-on-ink/15" />
          <button onClick={clear} aria-label="Clear selection" title="Clear selection" className="grid size-9 place-items-center rounded-md text-on-ink-muted transition-colors hover:bg-on-ink/10 hover:text-on-ink">
            <X className="size-4" />
          </button>
          <Popover anchor={ref.current} open={moveOpen} onClose={() => setMoveOpen(false)} width={220} align="center">
            {board.groups.map((g) => (
              <MenuItem key={g.id} icon={<span className="size-2.5" style={{ background: g.color }} />} onClick={() => (ids.forEach((id) => moveItem(id, g.id, Date.now())), setMoveOpen(false), clear())}>
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
    <button ref={btnRef} onClick={onClick} className={cx('flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors [&>svg]:size-4', danger ? 'text-on-ink hover:bg-alert hover:text-white' : 'text-on-ink/85 hover:bg-on-ink/10 hover:text-on-ink')}>
      {icon}
      {label}
    </button>
  )
}

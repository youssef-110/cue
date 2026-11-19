import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Activity as ActivityIcon,
  CalendarDays,
  ChartGantt,
  ChartPie,
  Copy,
  Download,
  EyeOff,
  Filter,
  Kanban,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Table2,
  Trash2,
  UserRound,
  X,
  Zap,
  Pencil,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { addItem, addView, deleteBoard, duplicateBoard, navigate, openItem, updateBoard, useStore } from '../lib/store'
import { exportBoardCSV } from '../lib/csv'
import { useFavorites } from '../lib/favorites'
import type { View } from '../lib/types'
import { Avatar, AvatarStack, Button, EditableText, MenuItem, Popover, cx } from '../components/ui'
import { isDoneItem } from '../components/cells'
import { Automations } from '../components/Automations'
import { askText } from '../components/askText'
import { TableView } from '../views/TableView'
import { KanbanView } from '../views/KanbanView'
// heavier views load on demand to keep first paint fast
const CalendarView = lazy(() => import('../views/CalendarView').then((m) => ({ default: m.CalendarView })))
const TimelineView = lazy(() => import('../views/TimelineView').then((m) => ({ default: m.TimelineView })))
const ChartView = lazy(() => import('../views/ChartView').then((m) => ({ default: m.ChartView })))

const VIEW_META: Record<View['type'], { icon: typeof Table2; label: string }> = {
  table: { icon: Table2, label: 'Table' },
  kanban: { icon: Kanban, label: 'Kanban' },
  timeline: { icon: ChartGantt, label: 'Timeline' },
  calendar: { icon: CalendarDays, label: 'Calendar' },
  chart: { icon: ChartPie, label: 'Dashboard' },
}
const EMOJI = ['📋', '✅', '💼', '🚀', '📣', '🎯', '🧠', '🛠️', '📈', '💡', '🎨', '🔬', '🤝', '🗂️', '⚡', '🌊']

export function BoardPage({ boardId, viewId }: { boardId: string; viewId?: string }) {
  const board = useStore((s) => s.board[boardId])
  const allItems = useStore((s) => s.item)
  const users = useStore((s) => s.user)
  const [q, setQ] = useState('')
  const [person, setPerson] = useState<string | null>(null)
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set())
  const [hideDone, setHideDone] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [favs, toggleFav] = useFavorites()

  const view = board?.views.find((v) => v.id === viewId) ?? board?.views[0]

  const items = useMemo(() => {
    if (!board) return []
    const peopleCols = board.columns.filter((c) => c.type === 'people')
    const statusCols = board.columns.filter((c) => c.type === 'status' || c.type === 'priority')
    const needle = q.trim().toLowerCase()
    const all = Object.values(allItems).filter((i) => i.boardId === board.id)
    const subMatch = new Set(all.filter((i) => i.parentId && needle && i.name.toLowerCase().includes(needle)).map((i) => i.parentId))
    return all
      .filter((i) => !i.parentId)
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || subMatch.has(i.id) || Object.values(i.values).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
      .filter((i) => !person || peopleCols.some((c) => ((i.values[c.id] as string[]) ?? []).includes(person)))
      .filter((i) => !labelFilter.size || statusCols.some((c) => labelFilter.has(i.values[c.id] as string)))
      .filter((i) => !hideDone || !isDoneItem(board, i))
      .sort((a, b) => a.order - b.order)
  }, [allItems, board, q, person, labelFilter, hideDone])

  useEffect(() => {
    const onNew = () => {
      if (!board) return
      const it = addItem(board.id, board.groups[0]?.id, 'New item', { top: true })
      openItem(it.id)
    }
    addEventListener('tideline:new-item', onNew)
    return () => removeEventListener('tideline:new-item', onNew)
  }, [board])

  if (!board || !view)
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <div className="text-center">
          <p className="font-display text-xl text-fg">This board doesn’t exist anymore</p>
          <Button variant="soft" className="mt-4" onClick={() => navigate({ page: 'home' })}>
            Go home
          </Button>
        </div>
      </div>
    )

  const members = [...new Set(Object.values(allItems).filter((i) => i.boardId === board.id).flatMap((i) => board.columns.filter((c) => c.type === 'people').flatMap((c) => (i.values[c.id] as string[]) ?? [])))]
    .map((id) => users[id])
    .filter(Boolean)
  const filtersOn = !!(q || person || labelFilter.size || hideDone)
  const props = { board, items, view }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-6 pt-5">
        <div className="flex items-start gap-3">
          <EmojiPicker value={board.icon ?? '📋'} onChange={(icon) => updateBoard(board.id, { icon })} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <EditableText value={board.name} onCommit={(name) => updateBoard(board.id, { name })} className="font-display text-[26px] font-semibold tracking-tight" />
              <button onClick={() => toggleFav(board.id)} aria-label="Favorite" className="grid size-8 place-items-center rounded-lg hover:bg-hover">
                <motion.span animate={{ scale: favs.includes(board.id) ? [1, 1.35, 1] : 1 }}>
                  <Star className={cx('size-[18px]', favs.includes(board.id) ? 'fill-amber-400 text-amber-400' : 'text-faint')} />
                </motion.span>
              </button>
            </div>
            <EditableText value={board.description ?? ''} placeholder="Add a board description" onCommit={(description) => updateBoard(board.id, { description })} className="text-[13.5px] text-muted" />
          </div>
          <div className="flex items-center gap-1.5">
            {members.length > 0 && <AvatarStack users={members} size={28} max={4} />}
            <ActivityButton boardId={board.id} />
            <Button variant="outline" onClick={() => setAutoOpen(true)}>
              <Zap className="text-amber-500" /> Automate
              {board.automations.filter((a) => a.enabled).length > 0 && <span className="rounded-full bg-accent-soft px-1.5 text-[11px] text-accent">{board.automations.filter((a) => a.enabled).length}</span>}
            </Button>
            <BoardMenu boardId={board.id} />
          </div>
        </div>

        {/* views */}
        <nav className="mt-4 flex items-center gap-1 border-b border-line">
          {board.views.map((v) => (
            <ViewTab key={v.id} boardId={board.id} view={v} active={v.id === view.id} canDelete={board.views.length > 1} />
          ))}
          <AddViewButton boardId={board.id} />
        </nav>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        <Button variant="primary" onClick={() => dispatchEvent(new Event('tideline:new-item'))} title="New item (N)">
          <Plus /> New item
        </Button>
        <label className="flex h-8 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[13px] focus-within:border-accent">
          <Search className="size-4 text-faint" />
          <input data-board-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search items" className="w-36 bg-transparent outline-none placeholder:text-faint focus:w-52 transition-[width]" />
          {q && (
            <button onClick={() => setQ('')} aria-label="Clear search">
              <X className="size-3.5 text-faint" />
            </button>
          )}
        </label>
        <PersonFilter value={person} onChange={setPerson} />
        <LabelFilter board={board} value={labelFilter} onChange={setLabelFilter} />
        <Button variant={hideDone ? 'soft' : 'ghost'} onClick={() => setHideDone(!hideDone)}>
          <EyeOff /> Hide done
        </Button>
        {filtersOn && (
          <motion.button initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} onClick={() => (setQ(''), setPerson(null), setLabelFilter(new Set()), setHideDone(false))} className="text-[12.5px] text-accent hover:underline">
            Clear filters · {items.length} shown
          </motion.button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {view.type === 'table' && <TableView {...props} />}
        {view.type === 'kanban' && <KanbanView {...props} />}
        <Suspense fallback={<div className="h-full animate-pulse bg-panel-2/40" />}>
          {view.type === 'calendar' && <CalendarView {...props} />}
          {view.type === 'timeline' && <TimelineView {...props} />}
          {view.type === 'chart' && <ChartView {...props} />}
        </Suspense>
      </div>
      <Automations board={board} open={autoOpen} onClose={() => setAutoOpen(false)} />
    </div>
  )
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Change board icon" className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-panel text-[24px] shadow-card transition hover:scale-105">
        {value}
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={232}>
        <div className="grid grid-cols-6 gap-1">
          {EMOJI.map((e) => (
            <button key={e} onClick={() => (onChange(e), setOpen(false))} className="grid size-8 place-items-center rounded-lg text-[18px] hover:bg-hover">
              {e}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

function ViewTab({ boardId, view, active, canDelete }: { boardId: string; view: View; active: boolean; canDelete: boolean }) {
  const Icon = VIEW_META[view.type].icon
  const ref = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const board = useStore((s) => s.board[boardId])
  return (
    <div className="relative">
      <button
        ref={ref}
        onClick={() => navigate({ page: 'board', boardId, viewId: view.id })}
        onContextMenu={(e) => (e.preventDefault(), setMenu(true))}
        onDoubleClick={() => setMenu(true)}
        className={cx('relative flex h-10 items-center gap-2 px-3 text-[13.5px] transition-colors', active ? 'font-medium text-fg' : 'text-muted hover:text-fg')}
      >
        <Icon className={cx('size-4', active && 'text-accent')} />
        {view.name}
        {active && <motion.span layoutId={`view-underline-${boardId}`} className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent" />}
      </button>
      <Popover anchor={ref.current} open={menu} onClose={() => setMenu(false)} width={190}>
        <MenuItem
          icon={<Pencil />}
          onClick={async () => {
            setMenu(false)
            const name = await askText('Rename view', view.name)
            if (name) updateBoard(boardId, { views: useStore.getState().board[boardId].views.map((v) => (v.id === view.id ? { ...v, name } : v)) })
          }}
        >
          Rename view
        </MenuItem>
        {canDelete && (
          <MenuItem
            icon={<Trash2 />}
            danger
            onClick={() => {
              setMenu(false)
              updateBoard(boardId, { views: board.views.filter((v) => v.id !== view.id) })
              navigate({ page: 'board', boardId })
            }}
          >
            Delete view
          </MenuItem>
        )}
      </Popover>
    </div>
  )
}

function AddViewButton({ boardId }: { boardId: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Add view" className="ml-1 grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-accent">
        <Plus className="size-4" />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={210}>
        {(Object.keys(VIEW_META) as View['type'][]).map((t) => {
          const I = VIEW_META[t].icon
          return (
            <MenuItem key={t} icon={<I />} onClick={() => (addView(boardId, t), setOpen(false))}>
              {VIEW_META[t].label}
            </MenuItem>
          )
        })}
      </Popover>
    </>
  )
}

function PersonFilter({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const users = useStore((s) => s.user)
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button ref={ref} variant={value ? 'soft' : 'ghost'} onClick={() => setOpen(true)}>
        {value ? <Avatar user={users[value]} size={18} /> : <UserRound />} {value ? users[value]?.name.split(' ')[0] : 'Person'}
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">Filter by person</div>
        {Object.values(users).map((u) => (
          <MenuItem key={u.id} active={value === u.id} icon={<Avatar user={u} size={18} />} onClick={() => (onChange(value === u.id ? null : u.id), setOpen(false))}>
            {u.name}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

function LabelFilter({ board, value, onChange }: { board: { columns: import('../lib/types').Column[] }; value: Set<string>; onChange: (v: Set<string>) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const cols = board.columns.filter((c) => c.type === 'status' || c.type === 'priority')
  return (
    <>
      <Button ref={ref} variant={value.size ? 'soft' : 'ghost'} onClick={() => setOpen(true)}>
        <Filter /> Filter{value.size ? ` · ${value.size}` : ''}
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={260}>
        {cols.map((c) => (
          <div key={c.id} className="mb-2">
            <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-faint">{c.title}</div>
            <div className="flex flex-wrap gap-1 px-1">
              {c.labels?.map((l) => {
                const on = value.has(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => {
                      const n = new Set(value)
                      if (on) n.delete(l.id)
                      else n.add(l.id)
                      onChange(n)
                    }}
                    className="rounded-md px-2 py-1 text-[12px] font-medium transition"
                    style={on ? { background: l.color, color: '#fff' } : { color: l.color, boxShadow: `inset 0 0 0 1px ${l.color}` }}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {!cols.length && <p className="p-2 text-[13px] text-muted">Add a status column to filter by label.</p>}
      </Popover>
    </>
  )
}

function ActivityButton({ boardId }: { boardId: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const users = useStore((s) => s.user)
  const activity = useStore((s) => s.activity)
  const list = useMemo(() => Object.values(activity).filter((a) => a.boardId === boardId).sort((a, b) => b.at - a.at).slice(0, 60), [activity, boardId])
  return (
    <>
      <Button ref={ref} variant="ghost" onClick={() => setOpen(true)} aria-label="Activity log" title="Activity log">
        <ActivityIcon />
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={360} align="end">
        <div className="px-2 pb-2 pt-1 font-display text-[15px] font-semibold">Activity</div>
        <div className="max-h-[420px] space-y-0.5 overflow-auto">
          {list.map((a) => (
            <button key={a.id} onClick={() => a.itemId && (openItem(a.itemId), setOpen(false))} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-hover">
              <Avatar user={users[a.actorId]} size={24} />
              <span className="min-w-0 flex-1 text-[13px] leading-snug">
                <span className="font-medium">{users[a.actorId]?.name ?? 'Someone'}</span> <span className="text-muted">{a.text}</span>
                <span className="block text-[11px] text-faint">{formatDistanceToNow(a.at, { addSuffix: true })}</span>
              </span>
            </button>
          ))}
          {!list.length && <p className="p-3 text-[13px] text-muted">No activity yet.</p>}
        </div>
      </Popover>
    </>
  )
}

function BoardMenu({ boardId }: { boardId: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const board = useStore((s) => s.board[boardId])
  return (
    <>
      <Button ref={ref} variant="ghost" onClick={() => setOpen(true)} aria-label="Board menu">
        <MoreHorizontal />
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={210} align="end">
        <MenuItem icon={<Download />} onClick={() => (exportBoardCSV(board), setOpen(false))}>Export to CSV</MenuItem>
        <MenuItem icon={<Copy />} onClick={() => (duplicateBoard(boardId), setOpen(false))}>Duplicate board</MenuItem>
        <MenuItem icon={<Trash2 />} danger onClick={() => (setOpen(false), deleteBoard(boardId))}>
          Delete board
        </MenuItem>
      </Popover>
    </>
  )
}


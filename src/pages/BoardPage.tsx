import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Activity as ActivityIcon,
  Archive,
  CalendarDays,
  ChartColumnBig,
  Eye,
  FileText,
  ChartGantt,
  ChartPie,
  Copy,
  Download,
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
  LayoutGrid,
  ClipboardList,
  Paperclip,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { addItem, addView, archiveBoard, deleteBoard, duplicateBoard, isLive, labelOf, liveGroups, navigate, openItem, updateBoard, useCanEdit, useStore, visibleItem } from '../lib/store'
import { matchFilter, useViewSetting } from '../lib/filters'
import { FilterBuilder } from '../components/FilterBuilder'
import { BoardDoc } from './DocPage'
import { exportBoardCSV } from '../lib/csv'
import { useFavorites } from '../lib/favorites'
import type { Board, View } from '../lib/types'
import { Avatar, AvatarStack, Button, EditableText, MenuItem, Popover, cx } from '../components/ui'
import { isDelayed, isDoneItem } from '../components/cells'
import { Automations } from '../components/Automations'
import { askText } from '../components/askText'
import { TableView } from '../views/TableView'
import { KanbanView } from '../views/KanbanView'
// heavier views load on demand to keep first paint fast
const CalendarView = lazy(() => import('../views/CalendarView').then((m) => ({ default: m.CalendarView })))
const TimelineView = lazy(() => import('../views/TimelineView').then((m) => ({ default: m.TimelineView })))
const ChartView = lazy(() => import('../views/ChartView').then((m) => ({ default: m.ChartView })))
const WorkloadView = lazy(() => import('../views/WorkloadView').then((m) => ({ default: m.WorkloadView })))
const CardsView = lazy(() => import('../views/MoreViews').then((m) => ({ default: m.CardsView })))
const FormView = lazy(() => import('../views/MoreViews').then((m) => ({ default: m.FormView })))
const FilesView = lazy(() => import('../views/MoreViews').then((m) => ({ default: m.FilesView })))

const VIEW_META: Record<View['type'], { icon: typeof Table2; label: string }> = {
  table: { icon: Table2, label: 'Table' },
  kanban: { icon: Kanban, label: 'Kanban' },
  timeline: { icon: ChartGantt, label: 'Timeline' },
  calendar: { icon: CalendarDays, label: 'Calendar' },
  chart: { icon: ChartPie, label: 'Dashboard' },
  workload: { icon: ChartColumnBig, label: 'Workload' },
  cards: { icon: LayoutGrid, label: 'Cards' },
  form: { icon: ClipboardList, label: 'Form' },
  files: { icon: Paperclip, label: 'Files' },
}
const IN_PROGRESS = /progress|working|doing|review|drafting|negotiat/i
const EMOJI = ['📋', '✅', '💼', '🚀', '📣', '🎯', '🧠', '🛠️', '📈', '💡', '🎨', '🔬', '🤝', '🗂️', '⚡', '🌊']

// controls that sit on the yellow station sign
const BAND_ICON = 'grid size-8 place-items-center rounded-md text-on-signal transition-colors hover:bg-on-signal/10 [&>svg]:size-4'
const TAB = 'caps relative flex h-10 shrink-0 items-center rounded-t-md px-4 text-[15px] font-semibold tracking-[0.1em] transition-colors'
const TAB_ON = 'bg-bg text-fg'
const TAB_OFF = 'text-on-signal/80 hover:bg-on-signal/10 hover:text-on-signal'

/** Current time, re-rendered on each minute boundary. */
function useMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let t = 0
    const tick = () => {
      setNow(new Date())
      t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    t = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    return () => clearTimeout(t)
  }, [])
  return now
}

export function BoardPage({ boardId, viewId }: { boardId: string; viewId?: string }) {
  const rawBoard = useStore((s) => s.board[boardId])
  const allItems = useStore((s) => s.item)
  const users = useStore((s) => s.user)
  const workspace = useStore((s) => (rawBoard ? s.workspace[rawBoard.workspaceId] : undefined))
  const editable = useCanEdit()
  const [q, setQ] = useState('')
  const [person, setPerson] = useState<string | null>(null)
  const [hideDone, setHideDone] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [favs, toggleFav] = useFavorites()
  const now = useMinute()
  // views only ever see live groups; archived / trashed ones live on the Archive page
  const board = useMemo(() => (rawBoard && isLive(rawBoard) ? { ...rawBoard, groups: liveGroups(rawBoard) } : undefined), [rawBoard])

  const isDoc = viewId === 'doc'
  const view = board?.views.find((v) => v.id === viewId) ?? board?.views[0]
  const [filter, setFilter] = useViewSetting(board ?? EMPTY_BOARD, view ?? EMPTY_VIEW, 'filter')

  const items = useMemo(() => {
    if (!board) return []
    const peopleCols = board.columns.filter((c) => c.type === 'people')
    const needle = q.trim().toLowerCase()
    const all = Object.values(allItems).filter((i) => i.boardId === board.id && visibleItem(i, { [board.id]: board }, allItems))
    const subMatch = new Set(all.filter((i) => i.parentId && needle && i.name.toLowerCase().includes(needle)).map((i) => i.parentId))
    return all
      .filter((i) => !i.parentId)
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || subMatch.has(i.id) || Object.values(i.values).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
      .filter((i) => !person || peopleCols.some((c) => ((i.values[c.id] as string[]) ?? []).includes(person)))
      .filter((i) => matchFilter(board, i, filter))
      .filter((i) => !hideDone || !isDoneItem(board, i))
      .sort((a, b) => a.order - b.order)
  }, [allItems, board, q, person, filter, hideDone])

  // the station sign's status line counts every live top-level item, regardless of filters
  const status = useMemo(() => {
    if (!board) return { total: 0, moving: 0, delayed: 0 }
    const live = Object.values(allItems).filter((i) => i.boardId === board.id && !i.parentId && visibleItem(i, { [board.id]: board }, allItems))
    const statusCols = board.columns.filter((c) => c.type === 'status')
    // only labels that name a moving state count, e.g. "In progress", "Working on it", "In review"
    const moving = live.filter((i) => {
      const labels = statusCols.map((c) => labelOf(c, i.values[c.id])).filter(Boolean)
      return !labels.some((l) => l!.done) && labels.some((l) => IN_PROGRESS.test(l!.name))
    }).length
    return { total: live.length, moving, delayed: live.filter((i) => isDelayed(board, i)).length }
    // `now` re-runs the delay check when the day rolls over
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, board, now.getDate()])

  useEffect(() => {
    const onNew = () => {
      if (!board || !editable || !board.groups[0]) return
      const it = addItem(board.id, board.groups[0].id, 'New item', { top: true })
      openItem(it.id)
    }
    addEventListener('tideline:new-item', onNew)
    return () => removeEventListener('tideline:new-item', onNew)
  }, [board, editable])

  if (!board || !view)
    return (
      <div className="grid flex-1 place-items-center text-muted">
        <div className="text-center">
          <p className="caps text-[22px] font-bold tracking-[0.06em] text-fg">{rawBoard ? 'This board is archived or in the trash' : 'This board doesn’t exist anymore'}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate({ page: 'home' })}>
            Go home
          </Button>
        </div>
      </div>
    )

  const members = [...new Set(Object.values(allItems).filter((i) => i.boardId === board.id && isLive(i)).flatMap((i) => board.columns.filter((c) => c.type === 'people').flatMap((c) => (i.values[c.id] as string[]) ?? [])))]
    .map((id) => users[id])
    .filter(Boolean)
  const filtersOn = !!(q || person || filter || hideDone)
  const props = { board, items, view }
  const fav = favs.includes(board.id)
  const autoCount = board.automations.filter((a) => a.enabled).length

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* station sign */}
      <header className="band min-w-0 border-b-2 border-ink bg-signal px-4 pt-4 text-on-signal sm:px-8 dark:border-line-strong">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="caps flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold tracking-[0.12em]">
            <BoardIconPicker value={board.icon ?? '📋'} onChange={(icon) => updateBoard(board.id, { icon })} disabled={!editable} />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
              <button onClick={() => navigate({ page: 'home' })} className="hidden truncate text-on-signal/80 transition-colors hover:text-on-signal hover:underline sm:inline">
                {workspace?.name ?? 'Workspace'}
              </button>
              <span aria-hidden className="hidden text-on-signal/60 sm:inline">/</span>
              <span aria-current="page" className="truncate">{board.name}</span>
            </nav>
            {!editable && (
              <span className="ml-1 flex shrink-0 items-center gap-1 rounded-sm border border-on-signal/40 px-1.5 py-0.5 text-[11.5px]">
                <Eye className="size-3.5" /> View only
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {members.length > 0 && (
              <span className="mr-2 hidden sm:inline-flex">
                <AvatarStack users={members} size={28} max={4} ringClass="ring-signal" />
              </span>
            )}
            <ActivityButton boardId={board.id} />
            {editable && (
              <button
                onClick={() => setAutoOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-md border border-on-signal/35 px-3 text-[13.5px] font-medium transition-colors hover:bg-on-signal/10 [&>svg]:size-4"
              >
                <Zap /> Automate
                {autoCount > 0 && <span className="rounded-sm bg-on-signal px-1 font-mono text-[11px] font-semibold text-signal">{autoCount}</span>}
              </button>
            )}
            {editable && <BoardMenu boardId={board.id} />}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <h1 className="min-w-0">
              {editable ? (
                <EditableText value={board.name} onCommit={(name) => updateBoard(board.id, { name })} className="caps block text-[30px] sm:text-[44px] font-bold leading-[1.02] tracking-[0.015em] hover:ring-on-signal/40" />
              ) : (
                <span className="caps block truncate text-[30px] sm:text-[44px] font-bold leading-[1.02] tracking-[0.015em]">{board.name}</span>
              )}
            </h1>
            <button onClick={() => toggleFav(board.id)} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={fav} title={fav ? 'Remove from favorites' : 'Add to favorites'} className={BAND_ICON}>
              <Star className={cx('!size-[18px]', fav ? 'fill-on-signal' : 'opacity-70')} />
            </button>
          </div>
          <StatusLine total={status.total} moving={status.moving} delayed={status.delayed} now={now} />
        </div>
        {editable ? (
          <EditableText
            value={board.description ?? ''}
            placeholder="Add a board description"
            onCommit={(description) => updateBoard(board.id, { description })}
            className="mt-0.5 inline-block max-w-full !whitespace-normal break-words text-[14px] text-on-signal/80 hover:ring-on-signal/40 sm:max-w-[72ch]"
          />
        ) : (
          board.description && <p className="mt-0.5 max-w-full break-words text-[14px] text-on-signal/80 sm:max-w-[72ch]">{board.description}</p>
        )}

        {/* view tabs sit on the sign's bottom edge; the active one joins the page below; on narrow screens they scroll inside the band */}
        <nav aria-label="Views" className="-mx-4 -mb-[2px] mt-4 flex items-end gap-0.5 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {board.views.map((v) => (
            <ViewTab key={v.id} boardId={board.id} view={v} active={!isDoc && v.id === view.id} canDelete={editable && board.views.length > 1} canEdit={editable} />
          ))}
          <button onClick={() => navigate({ page: 'board', boardId: board.id, viewId: 'doc' })} aria-current={isDoc ? 'page' : undefined} className={cx(TAB, 'gap-1.5', isDoc ? TAB_ON : TAB_OFF)}>
            <FileText className="size-3.5" /> Doc
          </button>
          {editable && <AddViewButton boardId={board.id} />}
        </nav>
      </header>

      {isDoc ? (
        <BoardDoc board={board} />
      ) : (
        <>
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-8">
            {editable && (
              <Button variant="primary" onClick={() => dispatchEvent(new Event('tideline:new-item'))} title="New item (N)">
                <Plus /> New item
              </Button>
            )}
            <label className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-panel px-2.5 text-[13.5px] transition-colors focus-within:border-accent">
              <Search className="size-4 shrink-0 text-faint" />
              <input data-board-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search items" className="w-40 bg-transparent outline-none transition-[width] placeholder:text-faint focus:w-56" />
              {q ? (
                <button onClick={() => setQ('')} aria-label="Clear search" className="text-faint hover:text-fg">
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="font-mono text-[11px] text-faint">/</kbd>
              )}
            </label>
            <span className="mx-1 h-5 w-px bg-line-strong" />
            <PersonFilter value={person} onChange={setPerson} />
            <FilterBuilder board={board} value={filter} onChange={setFilter} />
            <Button variant={hideDone ? 'soft' : 'outline'} aria-pressed={hideDone} onClick={() => setHideDone(!hideDone)}>
              <span className={cx('relative h-3.5 w-6 shrink-0 rounded-sm transition-colors', hideDone ? 'bg-accent' : 'bg-line-strong')}>
                <span className={cx('absolute top-[3px] size-2 rounded-[2px] bg-panel transition-[left] duration-150', hideDone ? 'left-[13px]' : 'left-[3px]')} />
              </span>
              Hide done
            </Button>
            {filtersOn && (
              <motion.button
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => (setQ(''), setPerson(null), setFilter(undefined), setHideDone(false))}
                className="ml-1 text-[13px] text-accent hover:underline"
              >
                Clear filters · <span className="font-mono">{items.length}</span> shown
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
              {view.type === 'workload' && <WorkloadView {...props} />}
              {view.type === 'cards' && <CardsView {...props} />}
              {view.type === 'form' && <FormView {...props} />}
              {view.type === 'files' && <FilesView {...props} />}
            </Suspense>
          </div>
        </>
      )}
      {editable && <Automations board={board} open={autoOpen} onClose={() => setAutoOpen(false)} />}
    </div>
  )
}

const EMPTY_BOARD = { id: '', views: [] } as unknown as Board
const EMPTY_VIEW = { id: '' } as View

/** "7 ITEMS · 3 IN PROGRESS · 1 DELAYED · THU 19 NOV 10:42" */
function StatusLine({ total, moving, delayed, now }: { total: number; moving: number; delayed: number; now: Date }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] font-medium uppercase [&>*]:whitespace-nowrap">
      <span>
        <b className="font-semibold">{total}</b> {total === 1 ? 'item' : 'items'}
      </span>
      <span>
        <b className="font-semibold">{moving}</b> in progress
      </span>
      <span className={cx(delayed ? 'rounded-sm bg-alert px-1.5 py-0.5 text-white' : 'opacity-80')}>
        <b className="font-semibold">{delayed}</b> delayed
      </span>
      <time dateTime={now.toISOString()} className="opacity-80">
        {format(now, 'EEE d MMM HH:mm')}
      </time>
    </p>
  )
}

function BoardIconPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={ref}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label="Change board icon"
        title={disabled ? undefined : 'Change board icon'}
        className="grid size-7 shrink-0 place-items-center rounded-sm bg-ink text-[14px] leading-none ring-offset-2 ring-offset-signal transition-shadow enabled:hover:ring-2 enabled:hover:ring-ink/30"
      >
        {value}
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={232}>
        <div className="caps px-1.5 pb-1.5 pt-1 text-[12px] font-semibold tracking-[0.12em] text-muted">Board icon</div>
        <div className="grid grid-cols-6 gap-0.5">
          {EMOJI.map((e) => (
            <button key={e} onClick={() => (onChange(e), setOpen(false))} aria-pressed={e === value} className={cx('grid size-9 place-items-center rounded-sm text-[18px]', e === value ? 'bg-accent-soft ring-1 ring-inset ring-accent' : 'hover:bg-hover')}>
              {e}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

function ViewTab({ boardId, view, active, canDelete, canEdit }: { boardId: string; view: View; active: boolean; canDelete: boolean; canEdit: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const board = useStore((s) => s.board[boardId])
  return (
    <div className="relative shrink-0">
      <button
        ref={ref}
        onClick={() => navigate({ page: 'board', boardId, viewId: view.id })}
        onContextMenu={(e) => (e.preventDefault(), canEdit && setMenu(true))}
        onDoubleClick={() => canEdit && setMenu(true)}
        aria-current={active ? 'page' : undefined}
        title={canEdit ? `${VIEW_META[view.type].label} view · double-click to rename` : `${VIEW_META[view.type].label} view`}
        className={cx(TAB, active ? TAB_ON : TAB_OFF)}
      >
        {view.name}
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
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Add view" title="Add view" className="mb-1 ml-1 grid size-8 shrink-0 place-items-center self-center rounded-md text-on-signal/80 transition-colors hover:bg-on-signal/10 hover:text-on-signal">
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
      <Button ref={ref} variant={value ? 'soft' : 'outline'} onClick={() => setOpen(true)}>
        {value ? <Avatar user={users[value]} size={18} /> : <UserRound />} {value ? users[value]?.name.split(' ')[0] : 'Person'}
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={230}>
        <div className="caps px-2 pb-1 pt-1 text-[12px] font-semibold tracking-[0.12em] text-muted">Filter by person</div>
        {Object.values(users).map((u) => (
          <MenuItem key={u.id} active={value === u.id} icon={<Avatar user={u} size={18} />} onClick={() => (onChange(value === u.id ? null : u.id), setOpen(false))}>
            {u.name}
          </MenuItem>
        ))}
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
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Activity log" title="Activity log" className={BAND_ICON}>
        <ActivityIcon />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={360} align="end">
        <div className="caps border-b-2 border-fg px-2 pb-1.5 pt-1 text-[15px] font-bold tracking-[0.1em]">Activity</div>
        <div className="max-h-[420px] divide-y divide-line overflow-auto">
          {list.map((a) => (
            <button key={a.id} onClick={() => a.itemId && (openItem(a.itemId), setOpen(false))} className="flex w-full items-start gap-2.5 px-2 py-2.5 text-left transition-colors hover:bg-hover">
              <Avatar user={users[a.actorId]} size={24} />
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                <span className="font-medium">{users[a.actorId]?.name ?? 'Someone'}</span> <span className="text-muted">{a.text}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-faint">{formatDistanceToNow(a.at, { addSuffix: true })}</span>
              </span>
            </button>
          ))}
          {!list.length && <p className="p-3 text-[13.5px] text-muted">No activity on this board yet.</p>}
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
      <button ref={ref} onClick={() => setOpen(true)} aria-label="Board menu" title="Board menu" className={BAND_ICON}>
        <MoreHorizontal />
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={210} align="end">
        <MenuItem icon={<Download />} onClick={() => (exportBoardCSV(board), setOpen(false))}>Export to CSV</MenuItem>
        <MenuItem icon={<Copy />} onClick={() => (duplicateBoard(boardId), setOpen(false))}>Duplicate board</MenuItem>
        <MenuItem icon={<Archive />} onClick={() => (setOpen(false), archiveBoard(boardId))}>Archive board</MenuItem>
        <MenuItem icon={<Trash2 />} danger onClick={() => (setOpen(false), deleteBoard(boardId))}>
          Delete board
        </MenuItem>
      </Popover>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Briefcase,
  ChevronDown,
  Cloud,
  HardDrive,
  House,
  Inbox,
  LogOut,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Star,
  Sun,
  Upload,
  Users,
  Pencil,
  Trash2,
  Copy,
  Archive,
  FileText,
  LayoutDashboard,
  LifeBuoy,
} from 'lucide-react'
import { toast } from 'sonner'
import { archiveBoard, createDoc, createWorkspace, deleteBoard, duplicateBoard, isLive, navigate, setPalette, setTheme, updateBoard, useCanEdit, useStore } from '../lib/store'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/sync'
import { TeamModal } from './TeamModal'
import { importCSV, importXlsx } from '../lib/csv'
import { Avatar, Kbd, Logo, MenuItem, Popover, Wordmark, cx } from './ui'
import { TemplateModal } from './TemplateModal'
import { askText } from './askText'
import { useFavorites } from '../lib/favorites'

// rail vocabulary: active = tinted fill + a signal-yellow icon / square marker, idle = muted text that lifts on hover
const RAIL_ON = 'bg-on-ink/12 font-medium text-on-ink [&>svg]:text-signal'
const RAIL_OFF = 'text-on-ink/80 hover:bg-on-ink/[0.07] hover:text-on-ink [&>svg]:text-on-ink-muted'
const RAIL_QUIET = 'rounded-md text-[13px] text-on-ink-muted transition-colors hover:bg-on-ink/[0.07] hover:text-on-ink'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tideline:sidebar') === '1' || innerWidth < 768) // phones start with the rail folded
  const route = useStore((s) => s.route)
  const theme = useStore((s) => s.theme)
  const meId = useStore((s) => s.meId)
  const me = useStore((s) => s.user[s.meId])
  const workspaces = useStore((s) => s.workspace)
  const boards = useStore((s) => s.board)
  const docs = useStore((s) => s.doc)
  const editable = useCanEdit()
  const unread = useStore((s) => Object.values(s.notification).filter((n) => n.userId === meId && !n.read).length)
  const [templateFor, setTemplateFor] = useState<string | null>(null)
  const [teamOpen, setTeamOpen] = useState(false)
  useEffect(() => {
    const open = () => setTeamOpen(true)
    addEventListener('cue:open-team', open)
    return () => removeEventListener('cue:open-team', open)
  }, [])
  const [favs] = useFavorites()
  const fileRef = useRef<HTMLInputElement>(null)
  const importWs = useRef('')

  const wsList = useMemo(() => Object.values(workspaces).sort((a, b) => a.order - b.order), [workspaces])
  const toggle = () => (setCollapsed(!collapsed), localStorage.setItem('tideline:sidebar', collapsed ? '0' : '1'))

  const nav = (page: 'home' | 'my-work' | 'inbox' | 'dashboards' | 'archive' | 'help', icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => navigate({ page })}
      data-tour={page}
      title={label}
      aria-current={route.page === page ? 'page' : undefined}
      className={cx(
        'relative flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors [&>svg]:size-[17px] [&>svg]:shrink-0',
        route.page === page ? RAIL_ON : RAIL_OFF,
      )}
    >
      {icon}
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!!badge && (
        <span
          aria-label={`${badge} unread`}
          className={cx('grid h-[18px] min-w-5 place-items-center rounded-sm bg-signal px-1 font-mono text-[11px] font-semibold text-on-signal', collapsed && 'absolute right-0.5 top-0.5 h-4 min-w-4 text-[10px]')}
        >
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative z-20 flex h-full shrink-0 flex-col bg-ink text-on-ink"
    >
      <div className="flex h-16 items-center gap-2 px-4">
        {collapsed ? <Logo size={28} /> : <Wordmark onInk />}
        <button
          onClick={toggle}
          aria-label="Toggle sidebar"
          className={cx(
            'ml-auto grid size-7 place-items-center rounded-md text-on-ink-muted transition-colors hover:bg-on-ink/10 hover:text-on-ink',
            collapsed && 'absolute -right-3.5 top-[18px] border border-on-ink/20 bg-ink',
          )}
        >
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={() => setPalette(true)}
          data-tour="search"
          title="Search or jump to (Ctrl K)"
          className="mb-3 flex h-9 w-full items-center gap-2 rounded-md border border-on-ink/15 px-2.5 text-[13px] text-on-ink-muted transition-colors hover:border-on-ink/30 hover:text-on-ink"
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or jump to…</span>
              <Kbd onInk>Ctrl K</Kbd>
            </>
          )}
        </button>
        {nav('home', <House />, 'Home')}
        {nav('my-work', <Briefcase />, 'My work')}
        {nav('inbox', <Inbox />, 'Inbox', unread)}
        {nav('dashboards', <LayoutDashboard />, 'Dashboards')}
        {nav('archive', <Archive />, 'Archive & Trash')}
        {auth && (
          <button onClick={() => setTeamOpen(true)} data-tour="team" title="Team" className={cx('flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors [&>svg]:size-[17px] [&>svg]:shrink-0', RAIL_OFF)}>
            <Users />
            {!collapsed && <span className="flex-1 text-left">Team</span>}
          </button>
        )}
        {nav('help', <LifeBuoy />, 'Help')}
      </div>

      <div data-tour="boards" className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:var(--on-ink-muted)_transparent]">
        {favs.length > 0 && !collapsed && (
          <Section title="Favorites" icon={<Star className="size-3" />}>
            {favs.map((id) => isLive(boards[id]) && <BoardLink key={id} id={id} collapsed={collapsed} />)}
          </Section>
        )}
        {wsList.map((ws) => (
          <Section
            key={ws.id}
            title={ws.name}
            badge={<span className="size-2 shrink-0" style={{ background: ws.color }} />}
            collapsed={collapsed}
            actions={
              editable && (
                <button aria-label="New board" onClick={() => setTemplateFor(ws.id)} className="grid size-6 place-items-center rounded-md text-on-ink-muted transition-colors hover:bg-on-ink/10 hover:text-on-ink">
                  <Plus className="size-4" />
                </button>
              )
            }
          >
            {Object.values(boards)
              .filter((b) => b.workspaceId === ws.id && isLive(b))
              .sort((a, b) => a.order - b.order)
              .map((b) => (
                <BoardLink key={b.id} id={b.id} collapsed={collapsed} />
              ))}
            {!collapsed &&
              Object.values(docs)
                .filter((d) => d.workspaceId === ws.id && !d.boardId)
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((d) => (
                  <button
                    key={d.id}
                    onClick={() => navigate({ page: 'doc', id: d.id })}
                    aria-current={route.page === 'doc' && route.id === d.id ? 'page' : undefined}
                    className={cx('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors [&>svg]:shrink-0', route.page === 'doc' && route.id === d.id ? RAIL_ON : RAIL_OFF)}
                  >
                    <FileText className="size-3.5" />
                    <span className="flex-1 truncate text-left">{d.title}</span>
                  </button>
                ))}
            {!collapsed && editable && (
              <div data-tour="new-board" className="mt-1 flex gap-0.5">
                <button onClick={() => setTemplateFor(ws.id)} className={cx('flex h-8 flex-1 items-center gap-1.5 whitespace-nowrap px-2', RAIL_QUIET)}>
                  <Plus className="size-3.5" /> Board
                </button>
                <button onClick={() => navigate({ page: 'doc', id: createDoc(ws.id).id })} title="New doc" className={cx('flex h-8 items-center gap-1.5 px-2', RAIL_QUIET)}>
                  <FileText className="size-3.5" /> Doc
                </button>
                <button
                  onClick={() => ((importWs.current = ws.id), fileRef.current?.click())}
                  title="Import a CSV or Excel (.xlsx) file as boards"
                  className={cx('flex h-8 items-center gap-1.5 px-2', RAIL_QUIET)}
                >
                  <Upload className="size-3.5" /> Import
                </button>
              </div>
            )}
          </Section>
        ))}
        {!collapsed && editable && (
          <button
            onClick={async () => {
              const name = await askText('New workspace', '', 'Create')
              if (name) createWorkspace(name)
            }}
            className={cx('mt-1 flex h-8 w-full items-center gap-2 px-2.5', RAIL_QUIET)}
          >
            <Plus className="size-3.5" /> Add workspace
          </button>
        )}
      </div>

      <div className="border-t border-on-ink/10 p-3">
        <div className={cx('flex items-center gap-2', collapsed && 'flex-col')}>
          <Avatar user={me} size={30} />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13.5px] font-medium text-on-ink">{me?.name}</div>
              <div className="flex items-center gap-1 text-[12px] text-on-ink-muted">
                {auth ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
                {auth ? 'Team sync on' : 'Local mode'}
              </div>
            </div>
          )}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            title="Toggle theme (D)"
            className="grid size-8 place-items-center rounded-md text-on-ink-muted transition-colors hover:bg-on-ink/10 hover:text-on-ink"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} className="block" initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 4, opacity: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
          {auth && (
            <button
              onClick={() => signOut(auth!).then(() => location.reload())}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-md text-on-ink-muted transition-colors hover:bg-on-ink/10 hover:text-on-ink"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            if (/\.xlsx$/i.test(f.name)) {
              const r = await importXlsx(f, importWs.current)
              toast.success(`Imported ${r.boards} board${r.boards === 1 ? '' : 's'} with ${r.items} items`)
              return
            }
            const n = importCSV(await f.text(), importWs.current, f.name.replace(/\.csv$/i, ''))
            toast.success(`Imported 1 board with ${n} items`)
          } catch (err) {
            toast.error('Import failed: ' + (err as Error).message)
          }
        }}
      />
      <TemplateModal workspaceId={templateFor} onClose={() => setTemplateFor(null)} />
      {auth && <TeamModal open={teamOpen} onClose={() => setTeamOpen(false)} />}
    </motion.aside>
  )
}

function Section({ title, icon, badge, children, actions, collapsed }: { title: string; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; collapsed?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-4">
      {!collapsed && (
        <div className="group flex h-8 items-center gap-1.5 pl-2.5 pr-1">
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="caps flex min-w-0 flex-1 items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-on-ink-muted transition-colors hover:text-on-ink"
          >
            {badge ?? icon}
            <span className="truncate">{title}</span>
            <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.12 }}>
              <ChevronDown className="size-3.5" />
            </motion.span>
          </button>
          <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">{actions}</span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BoardLink({ id, collapsed }: { id: string; collapsed: boolean }) {
  const board = useStore((s) => s.board[id])
  const active = useStore((s) => s.route.page === 'board' && s.route.boardId === id)
  const ref = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const [favs, toggleFav] = useFavorites()
  const editable = useCanEdit()
  if (!board) return null
  return (
    <div className="group relative">
      <button
        onClick={() => navigate({ page: 'board', boardId: id })}
        title={board.name}
        aria-current={active ? 'page' : undefined}
        className={cx('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors', collapsed && 'justify-center px-0', active ? RAIL_ON : RAIL_OFF)}
      >
        {collapsed ? (
          <span className={cx('caps grid size-6 shrink-0 place-items-center rounded-sm text-[13px] font-bold', active ? 'bg-signal text-on-signal' : 'border border-on-ink/25')}>{board.name.slice(0, 1)}</span>
        ) : (
          <span className={cx('size-[7px] shrink-0', active ? 'bg-signal' : 'border border-on-ink-muted')} />
        )}
        {!collapsed && <span className="flex-1 truncate pr-5 text-left">{board.name}</span>}
      </button>
      {!collapsed && (
        <button
          ref={ref}
          onClick={() => setMenu(true)}
          aria-label="Board options"
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-on-ink-muted opacity-0 transition-colors hover:bg-on-ink/10 hover:text-on-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
      <Popover anchor={ref.current} open={menu} onClose={() => setMenu(false)} width={200}>
        <MenuItem icon={<Star />} onClick={() => (toggleFav(id), setMenu(false))}>{favs.includes(id) ? 'Remove from favorites' : 'Add to favorites'}</MenuItem>
        {editable && (
          <>
            <MenuItem icon={<Pencil />} onClick={async () => { setMenu(false); const n = await askText('Rename board', board.name); if (n) updateBoard(id, { name: n }) }}>Rename</MenuItem>
            <MenuItem icon={<Copy />} onClick={() => (duplicateBoard(id), setMenu(false))}>Duplicate</MenuItem>
            <MenuItem icon={<Archive />} onClick={() => (archiveBoard(id), setMenu(false))}>Archive</MenuItem>
            <MenuItem icon={<Trash2 />} danger onClick={() => (deleteBoard(id), setMenu(false))}>Delete</MenuItem>
          </>
        )}
      </Popover>
    </div>
  )
}

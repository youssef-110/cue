import { useMemo, useRef, useState } from 'react'
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
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import { createWorkspace, deleteBoard, duplicateBoard, navigate, setPalette, setTheme, updateBoard, useStore } from '../lib/store'
import { supabase } from '../lib/sync'
import { importCSV } from '../lib/csv'
import { Avatar, Kbd, Logo, MenuItem, Popover, cx } from './ui'
import { TemplateModal } from './TemplateModal'
import { askText } from './askText'
import { useFavorites } from '../lib/favorites'

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tideline:sidebar') === '1')
  const route = useStore((s) => s.route)
  const theme = useStore((s) => s.theme)
  const meId = useStore((s) => s.meId)
  const me = useStore((s) => s.user[s.meId])
  const workspaces = useStore((s) => s.workspace)
  const boards = useStore((s) => s.board)
  const unread = useStore((s) => Object.values(s.notification).filter((n) => n.userId === meId && !n.read).length)
  const [templateFor, setTemplateFor] = useState<string | null>(null)
  const [favs] = useFavorites()
  const fileRef = useRef<HTMLInputElement>(null)
  const importWs = useRef('')

  const wsList = useMemo(() => Object.values(workspaces).sort((a, b) => a.order - b.order), [workspaces])
  const toggle = () => (setCollapsed(!collapsed), localStorage.setItem('tideline:sidebar', collapsed ? '0' : '1'))

  const nav = (page: 'home' | 'my-work' | 'inbox', icon: React.ReactNode, label: string, badge?: number) => (
    <button
      onClick={() => navigate({ page })}
      title={label}
      className={cx(
        'relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors [&>svg]:size-[18px]',
        route.page === page ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover hover:text-fg',
      )}
    >
      {icon}
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!!badge && (
        <span className={cx('grid min-w-5 place-items-center rounded-full bg-[#f0475a] px-1 text-[10.5px] font-semibold text-white', collapsed && 'absolute right-0.5 top-0.5 min-w-4 text-[9px]')}>{badge}</span>
      )}
    </button>
  )

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 268 }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-line bg-panel"
    >
      <div className="flex h-14 items-center gap-2 px-3.5">
        <Logo size={28} />
        {!collapsed && <span className="font-display text-[17px] font-semibold tracking-tight">tideline</span>}
        <button onClick={toggle} aria-label="Toggle sidebar" className={cx('ml-auto grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg', collapsed && 'absolute -right-3.5 top-4 border border-line bg-panel shadow-card')}>
          <PanelLeft className="size-4" />
        </button>
      </div>

      <div className="px-2.5">
        <button onClick={() => setPalette(true)} className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-panel-2 px-2.5 text-[13px] text-faint transition hover:border-line-strong">
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search or jump to…</span>
              <Kbd>Ctrl K</Kbd>
            </>
          )}
        </button>
        {nav('home', <House />, 'Home')}
        {nav('my-work', <Briefcase />, 'My work')}
        {nav('inbox', <Inbox />, 'Inbox', unread)}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {favs.length > 0 && !collapsed && (
          <Section title="Favorites" icon={<Star className="size-3.5" />}>
            {favs.map((id) => boards[id] && <BoardLink key={id} id={id} collapsed={collapsed} />)}
          </Section>
        )}
        {wsList.map((ws) => (
          <Section
            key={ws.id}
            title={ws.name}
            badge={<span className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: ws.color }}>{ws.name[0]}</span>}
            collapsed={collapsed}
            actions={
              <>
                <button aria-label="New board" onClick={() => setTemplateFor(ws.id)} className="grid size-6 place-items-center rounded-md text-faint hover:bg-hover hover:text-accent">
                  <Plus className="size-4" />
                </button>
              </>
            }
          >
            {Object.values(boards)
              .filter((b) => b.workspaceId === ws.id)
              .sort((a, b) => a.order - b.order)
              .map((b) => (
                <BoardLink key={b.id} id={b.id} collapsed={collapsed} />
              ))}
            {!collapsed && (
              <div className="mt-1 flex gap-1">
                <button onClick={() => setTemplateFor(ws.id)} className="flex h-8 flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] text-faint hover:bg-hover hover:text-fg">
                  <Plus className="size-3.5" /> New board
                </button>
                <button
                  onClick={() => ((importWs.current = ws.id), fileRef.current?.click())}
                  title="Import a CSV file as a board"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-faint hover:bg-hover hover:text-fg"
                >
                  <Upload className="size-3.5" /> CSV
                </button>
              </div>
            )}
          </Section>
        ))}
        {!collapsed && (
          <button
            onClick={async () => {
              const name = await askText('New workspace', '', 'Create')
              if (name) createWorkspace(name)
            }}
            className="mt-2 flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-faint hover:bg-hover hover:text-fg"
          >
            <Plus className="size-3.5" /> Add workspace
          </button>
        )}
      </div>

      <div className="border-t border-line p-2.5">
        <div className={cx('flex items-center gap-2', collapsed && 'flex-col')}>
          <Avatar user={me} size={30} />
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium">{me?.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-faint">
                {supabase ? <Cloud className="size-3" /> : <HardDrive className="size-3" />}
                {supabase ? 'Team sync on' : 'Local mode'}
              </div>
            </div>
          )}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle theme (D)" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </button>
          {supabase && (
            <button onClick={() => supabase!.auth.signOut().then(() => location.reload())} aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-fg">
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const n = importCSV(await f.text(), importWs.current, f.name.replace(/\.csv$/i, ''))
            toast.success(`Imported ${n} items`)
          } catch (err) {
            toast.error('Import failed: ' + (err as Error).message)
          }
        }}
      />
      <TemplateModal workspaceId={templateFor} onClose={() => setTemplateFor(null)} />
    </motion.aside>
  )
}

function Section({ title, icon, badge, children, actions, collapsed }: { title: string; icon?: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode; collapsed?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-2">
      {!collapsed && (
        <div className="group flex h-8 items-center gap-1.5 px-1">
          <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-faint hover:text-muted">
            {badge ?? icon}
            <span className="truncate">{title}</span>
            <motion.span animate={{ rotate: open ? 0 : -90 }}>
              <ChevronDown className="size-3.5" />
            </motion.span>
          </button>
          <span className="opacity-0 transition group-hover:opacity-100">{actions}</span>
        </div>
      )}
      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
  if (!board) return null
  return (
    <div className="group relative">
      <button
        onClick={() => navigate({ page: 'board', boardId: id })}
        title={board.name}
        className={cx('flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors', active ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-hover hover:text-fg')}
      >
        {active && <motion.span layoutId="board-active" className="absolute left-0 top-1.5 h-5 w-[3px] rounded-full bg-accent" />}
        <span className="text-[15px] leading-none">{board.icon ?? '📋'}</span>
        {!collapsed && <span className="flex-1 truncate text-left">{board.name}</span>}
      </button>
      {!collapsed && (
        <button ref={ref} onClick={() => setMenu(true)} aria-label="Board options" className="absolute right-1 top-1 grid size-6 place-items-center rounded-md text-faint opacity-0 hover:bg-panel hover:text-fg group-hover:opacity-100">
          <MoreHorizontal className="size-4" />
        </button>
      )}
      <Popover anchor={ref.current} open={menu} onClose={() => setMenu(false)} width={200}>
        <MenuItem icon={<Star />} onClick={() => (toggleFav(id), setMenu(false))}>{favs.includes(id) ? 'Remove from favorites' : 'Add to favorites'}</MenuItem>
        <MenuItem icon={<Pencil />} onClick={async () => { setMenu(false); const n = await askText('Rename board', board.name); if (n) updateBoard(id, { name: n }) }}>Rename</MenuItem>
        <MenuItem icon={<Copy />} onClick={() => (duplicateBoard(id), setMenu(false))}>Duplicate</MenuItem>
        <MenuItem icon={<Trash2 />} danger onClick={() => (deleteBoard(id), setMenu(false))}>Delete</MenuItem>
      </Popover>
    </div>
  )
}


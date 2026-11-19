import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { Archive, Briefcase, House, Inbox, LayoutDashboard, Moon, Plus, Search, Sun, CornerDownLeft, Table2 } from 'lucide-react'
import { addItem, createBoardFromTemplate, isLive, liveGroups, navigate, openItem, setPalette, setTheme, useCanEdit, useStore, visibleItem } from '../lib/store'
import { TEMPLATES } from '../lib/seed'
import { Kbd } from './ui'

const itemCls =
  'flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-[14px] text-fg data-[selected=true]:bg-accent-soft data-[selected=true]:shadow-[inset_0_0_0_1px_var(--accent)] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted data-[selected=true]:[&_svg]:text-accent'
const groupCls =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-faint'

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const theme = useStore((s) => s.theme)
  const route = useStore((s) => s.route)
  const ws = useStore((s) => Object.values(s.workspace)[0])
  const editable = useCanEdit()
  const close = () => setPalette(false)
  const run = (fn: () => void) => () => (fn(), close())
  const current = route.page === 'board' && editable && isLive(boards[route.boardId]) && liveGroups(boards[route.boardId]).length ? boards[route.boardId] : undefined

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[14vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
          <div className="absolute inset-0 bg-ink/45" onClick={close} />
          <motion.div initial={{ y: -4 }} animate={{ y: 0 }} exit={{ y: -2 }} transition={{ duration: 0.14, ease: 'easeOut' }} className="relative w-full max-w-[620px]">
            <Command label="Command menu" loop className="overflow-hidden rounded-lg border border-line-strong bg-panel shadow-pop" onKeyDown={(e) => e.key === 'Escape' && close()}>
              <div className="flex items-center gap-3 border-b-2 border-fg px-4">
                <Search className="size-[18px] text-muted" />
                <Command.Input autoFocus placeholder="Search boards, items, actions…" className="h-13 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-faint" />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-8 text-center text-[14px] text-muted">No matches. Try a board or item name.</Command.Empty>
                <Command.Group heading="Actions" className={groupCls}>
                  {current && (
                    <Command.Item className={itemCls} onSelect={run(() => openItem(addItem(current.id, liveGroups(current)[0].id, 'New item', { top: true }).id))}>
                      <Plus /> New item in {current.name}
                    </Command.Item>
                  )}
                  {ws &&
                    editable &&
                    TEMPLATES.map((t) => (
                      <Command.Item key={t.id} className={itemCls} value={`create board ${t.name}`} onSelect={run(() => createBoardFromTemplate(t.id, ws.id))}>
                        <Plus /> Create board: {t.name}
                      </Command.Item>
                    ))}
                  <Command.Item className={itemCls} onSelect={run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>
                    {theme === 'dark' ? <Sun /> : <Moon />} Switch to {theme === 'dark' ? 'light' : 'dark'} theme
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Go to" className={groupCls}>
                  <Command.Item className={itemCls} onSelect={run(() => navigate({ page: 'home' }))}><House /> Home</Command.Item>
                  <Command.Item className={itemCls} onSelect={run(() => navigate({ page: 'my-work' }))}><Briefcase /> My work</Command.Item>
                  <Command.Item className={itemCls} onSelect={run(() => navigate({ page: 'inbox' }))}><Inbox /> Inbox</Command.Item>
                  <Command.Item className={itemCls} onSelect={run(() => navigate({ page: 'dashboards' }))}><LayoutDashboard /> Dashboards</Command.Item>
                  <Command.Item className={itemCls} onSelect={run(() => navigate({ page: 'archive' }))}><Archive /> Archive &amp; Trash</Command.Item>
                  {Object.values(boards).filter(isLive).map((b) => (
                    <Command.Item key={b.id} value={`board ${b.name} ${b.id}`} className={itemCls} onSelect={run(() => navigate({ page: 'board', boardId: b.id }))}>
                      <Table2 /> {b.name}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Items" className={groupCls}>
                  {Object.values(items)
                    .filter((i) => visibleItem(i, boards, items))
                    .slice(0, 400)
                    .map((i) => (
                      <Command.Item key={i.id} value={`${i.name} ${i.id}`} className={itemCls} onSelect={run(() => (navigate({ page: 'board', boardId: i.boardId }), openItem(i.id)))}>
                        <CornerDownLeft />
                        <span className="flex-1 truncate">{i.name}</span>
                        <span className="max-w-[40%] truncate text-[12.5px] text-faint">{boards[i.boardId].name}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

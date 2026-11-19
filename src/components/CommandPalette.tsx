import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { Briefcase, House, Inbox, Moon, Plus, Search, Sun, CornerDownLeft } from 'lucide-react'
import { addItem, createBoardFromTemplate, navigate, openItem, setPalette, setTheme, useStore } from '../lib/store'
import { TEMPLATES } from '../lib/seed'
import { Kbd } from './ui'

const itemCls =
  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-fg data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent [&_svg]:size-4 [&_svg]:text-muted data-[selected=true]:[&_svg]:text-accent'
const groupCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint'

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const theme = useStore((s) => s.theme)
  const route = useStore((s) => s.route)
  const ws = useStore((s) => Object.values(s.workspace)[0])
  const close = () => setPalette(false)
  const run = (fn: () => void) => () => (fn(), close())
  const current = route.page === 'board' ? boards[route.boardId] : undefined

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[14vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0b0d1a]/40 backdrop-blur-[3px]" onClick={close} />
          <motion.div initial={{ y: -12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 500, damping: 34 }} className="relative w-full max-w-[620px]">
            <Command label="Command menu" loop className="overflow-hidden rounded-2xl border border-line bg-panel shadow-pop" onKeyDown={(e) => e.key === 'Escape' && close()}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-[18px] text-faint" />
                <Command.Input autoFocus placeholder="Search boards, items, actions…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="p-8 text-center text-[13.5px] text-muted">No results.</Command.Empty>
                <Command.Group heading="Actions" className={groupCls}>
                  {current && (
                    <Command.Item className={itemCls} onSelect={run(() => openItem(addItem(current.id, current.groups[0].id, 'New item', { top: true }).id))}>
                      <Plus /> New item in {current.name}
                    </Command.Item>
                  )}
                  {ws &&
                    TEMPLATES.map((t) => (
                      <Command.Item key={t.id} className={itemCls} value={`create board ${t.name}`} onSelect={run(() => createBoardFromTemplate(t.id, ws.id))}>
                        <span className="w-4 text-center">{t.icon}</span> Create board: {t.name}
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
                  {Object.values(boards).map((b) => (
                    <Command.Item key={b.id} value={`board ${b.name} ${b.id}`} className={itemCls} onSelect={run(() => navigate({ page: 'board', boardId: b.id }))}>
                      <span className="w-4 text-center">{b.icon}</span> {b.name}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Items" className={groupCls}>
                  {Object.values(items)
                    .filter((i) => boards[i.boardId])
                    .slice(0, 400)
                    .map((i) => (
                      <Command.Item key={i.id} value={`${i.name} ${i.id}`} className={itemCls} onSelect={run(() => (navigate({ page: 'board', boardId: i.boardId }), openItem(i.id)))}>
                        <CornerDownLeft />
                        <span className="flex-1 truncate">{i.name}</span>
                        <span className="text-[12px] text-faint">{boards[i.boardId].name}</span>
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

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Heart, MessageCircle, MoreHorizontal, Send, Trash2, X, ListTree, Activity as ActivityIcon, Plus } from 'lucide-react'
import { addItem, addUpdate, deleteItems, duplicateItem, openItem, remove, renameItem, toggleLike, useStore } from '../lib/store'
import { Avatar, EditableText, MenuItem, Popover, cx } from './ui'
import { Cell } from './cells'
import { COLUMN_TYPES } from './columnTypes'

type Tab = 'updates' | 'subitems' | 'activity'

export function ItemPanel() {
  const id = useStore((s) => s.openItemId)
  const item = useStore((s) => (id ? s.item[id] : undefined))
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-30 bg-[#0b0d1a]/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => openItem(null)} />
          <motion.aside
            key="panel"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[620px] flex-col border-l border-line bg-panel shadow-pop"
            aria-label="Item details"
          >
            <PanelBody itemId={item.id} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function PanelBody({ itemId }: { itemId: string }) {
  const item = useStore((s) => s.item[itemId])
  const board = useStore((s) => s.board[item?.boardId ?? ''])
  const users = useStore((s) => s.user)
  const meId = useStore((s) => s.meId)
  const updatesMap = useStore((s) => s.update)
  const activityMap = useStore((s) => s.activity)
  const itemsMap = useStore((s) => s.item)
  const [tab, setTab] = useState<Tab>('updates')
  const [draft, setDraft] = useState('')
  const menuRef = useRef<HTMLButtonElement>(null)
  const [menu, setMenu] = useState(false)
  const updates = useMemo(() => Object.values(updatesMap).filter((u) => u.itemId === itemId).sort((a, b) => b.createdAt - a.createdAt), [updatesMap, itemId])
  const activity = useMemo(() => Object.values(activityMap).filter((a) => a.itemId === itemId).sort((a, b) => b.at - a.at), [activityMap, itemId])
  const subs = useMemo(() => Object.values(itemsMap).filter((i) => i.parentId === itemId).sort((a, b) => a.order - b.order), [itemsMap, itemId])
  if (!item || !board) return null
  const group = board.groups.find((g) => g.id === item.groupId)
  const parent = item.parentId ? itemsMap[item.parentId] : undefined
  const mention = draft.match(/@(\w*)$/)?.[1]
  const mentionHits = mention !== undefined ? Object.values(users).filter((u) => u.name.toLowerCase().startsWith(mention.toLowerCase())).slice(0, 5) : []

  const send = () => {
    if (!draft.trim()) return
    addUpdate(item.id, draft.trim())
    setDraft('')
  }

  return (
    <>
      <div className="border-b border-line px-6 pb-0 pt-5">
        <div className="mb-2 flex items-center gap-2 text-[12px] text-faint">
          <span>{board.icon}</span>
          <span>{board.name}</span>
          <span>/</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: group?.color }} />
            {group?.title}
          </span>
          {parent && (
            <>
              <span>/</span>
              <button className="hover:text-accent" onClick={() => openItem(parent.id)}>{parent.name}</button>
            </>
          )}
          <div className="ml-auto flex gap-1">
            <button ref={menuRef} onClick={() => setMenu(true)} aria-label="Item options" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
              <MoreHorizontal className="size-4" />
            </button>
            <button onClick={() => openItem(null)} aria-label="Close" title="Close (Esc)" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
              <X className="size-4" />
            </button>
          </div>
          <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)} width={190} align="end">
            <MenuItem icon={<Copy />} onClick={() => { const c = duplicateItem(item.id); setMenu(false); if (c) openItem(c.id) }}>Duplicate</MenuItem>
            <MenuItem icon={<Trash2 />} danger onClick={() => (setMenu(false), deleteItems([item.id]))}>Delete item</MenuItem>
          </Popover>
        </div>
        <EditableText value={item.name} onCommit={(n) => renameItem(item.id, n)} className="font-display text-[24px] font-semibold leading-tight tracking-tight" />

        {/* fields */}
        <div className="mt-4 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 pb-4 text-[13px]">
          {board.columns.map((c) => {
            const T = COLUMN_TYPES.find((t) => t.type === c.type)
            return (
              <div key={c.id} className="contents">
                <span className="flex h-9 items-center gap-2 text-muted">
                  {T && <T.icon className="size-3.5 shrink-0" />}
                  <span className="truncate">{c.title}</span>
                </span>
                <div className="h-9 overflow-hidden rounded-lg border border-line">
                  <Cell board={board} col={c} item={item} groupColor={group?.color ?? '#5b5bf0'} />
                </div>
              </div>
            )
          })}
        </div>

        <nav className="flex gap-1">
          {(
            [
              ['updates', 'Updates', MessageCircle, updates.length],
              ...(item.parentId ? [] : [['subitems', 'Subitems', ListTree, subs.length]]),
              ['activity', 'Activity', ActivityIcon, activity.length],
            ] as [Tab, string, typeof MessageCircle, number][]
          ).map(([k, label, I, n]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('relative flex h-10 items-center gap-2 px-3 text-[13.5px]', tab === k ? 'font-medium text-fg' : 'text-muted hover:text-fg')}>
              <I className="size-4" /> {label}
              {n > 0 && <span className="rounded-full bg-panel-2 px-1.5 text-[11px] text-muted">{n}</span>}
              {tab === k && <motion.span layoutId="panel-tab" className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg/60 px-6 py-5">
        {tab === 'updates' && (
          <>
            <div className="relative rounded-2xl border border-line bg-panel p-3 shadow-card focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
                }}
                rows={3}
                placeholder="Write an update… use @ to mention a teammate"
                aria-label="Write an update"
                className="w-full resize-none bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
              {mentionHits.length > 0 && (
                <div className="absolute left-3 top-full z-10 mt-1 w-56 rounded-xl border border-line bg-panel p-1 shadow-pop">
                  {mentionHits.map((u) => (
                    <button key={u.id} onClick={() => setDraft(draft.replace(/@\w*$/, '@' + u.name.split(' ')[0] + ' '))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-hover">
                      <Avatar user={u} size={20} /> {u.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-faint">Ctrl + Enter to post</span>
                <button onClick={send} disabled={!draft.trim()} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-40">
                  <Send className="size-3.5" /> Update
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <AnimatePresence initial={false}>
                {updates.map((u) => (
                  <motion.article key={u.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="rounded-2xl border border-line bg-panel p-4 shadow-card">
                    <header className="mb-2 flex items-center gap-2.5">
                      <Avatar user={users[u.authorId]} size={30} />
                      <div className="leading-tight">
                        <div className="text-[13.5px] font-medium">{users[u.authorId]?.name ?? 'Someone'}</div>
                        <div className="text-[11.5px] text-faint">{formatDistanceToNow(u.createdAt, { addSuffix: true })}</div>
                      </div>
                      {u.authorId === meId && (
                        <button onClick={() => remove('update', u.id)} aria-label="Delete update" className="ml-auto grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-red-500">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </header>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                      {u.body.split(/(@\w+)/g).map((part, i) =>
                        part.startsWith('@') ? (
                          <span key={i} className="rounded bg-accent-soft px-1 font-medium text-accent">{part}</span>
                        ) : (
                          part
                        ),
                      )}
                    </p>
                    <button onClick={() => toggleLike(u.id)} className={cx('mt-3 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] transition', u.likes.includes(meId) ? 'text-pink-500' : 'text-muted hover:bg-hover')}>
                      <motion.span animate={{ scale: u.likes.includes(meId) ? [1, 1.4, 1] : 1 }}>
                        <Heart className={cx('size-4', u.likes.includes(meId) && 'fill-current')} />
                      </motion.span>
                      {u.likes.length > 0 ? u.likes.length : 'Like'}
                    </button>
                  </motion.article>
                ))}
              </AnimatePresence>
              {!updates.length && (
                <div className="py-10 text-center">
                  <MessageCircle className="mx-auto mb-3 size-10 text-line-strong" />
                  <p className="font-medium">No updates yet</p>
                  <p className="text-[13px] text-muted">Share progress, ask questions, mention teammates.</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'subitems' && (
          <div className="space-y-1.5">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[13.5px]">
                <span className="size-1.5 rounded-full bg-faint" />
                <EditableText value={s.name} onCommit={(n) => renameItem(s.id, n)} className="flex-1" />
                <button onClick={() => openItem(s.id)} className="text-[12px] text-accent hover:underline">Open</button>
                <button onClick={() => deleteItems([s.id])} aria-label="Delete subitem" className="text-faint hover:text-red-500">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const f = e.currentTarget.elements.namedItem('sub') as HTMLInputElement
                if (f.value.trim()) addItem(board.id, item.groupId, f.value.trim(), { parentId: item.id })
                f.value = ''
              }}
              className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-1.5"
            >
              <Plus className="size-4 text-faint" />
              <input name="sub" placeholder="Add a subitem" aria-label="Add a subitem" className="h-7 flex-1 bg-transparent text-[13.5px] outline-none" />
            </form>
          </div>
        )}

        {tab === 'activity' && (
          <ol className="relative space-y-4 border-l border-line pl-5">
            {activity.map((a) => (
              <li key={a.id} className="relative text-[13px]">
                <span className="absolute -left-[27px] top-0.5 grid size-3.5 place-items-center rounded-full border-2 border-panel bg-accent" />
                <span className="font-medium">{users[a.actorId]?.name ?? 'Someone'}</span> <span className="text-muted">{a.text}</span>
                <div className="text-[11.5px] text-faint">{formatDistanceToNow(a.at, { addSuffix: true })}</div>
              </li>
            ))}
            {!activity.length && <li className="text-[13px] text-muted">Nothing here yet.</li>}
          </ol>
        )}
      </div>
    </>
  )
}

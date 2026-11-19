import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Heart, MessageCircle, MoreHorizontal, Reply, Send, Trash2, X, Plus, Archive, Bell, BellOff, RotateCcw } from 'lucide-react'
import { addItem, addUpdate, archiveItems, deleteItems, duplicateItem, isLive, openItem, remove, renameItem, restoreItems, subscribersOf, toggleLike, toggleSubscribe, useCanEdit, useStore } from '../lib/store'
import { Avatar, Button, EditableText, MenuItem, Popover, cx } from './ui'
import { Cell } from './cells'
import { COLUMN_TYPES } from './columnTypes'
import type { Update } from '../lib/types'

type Tab = 'updates' | 'subitems' | 'activity'

const EASE = [0.2, 0.7, 0.2, 1] as const
// controls on the panel's yellow band
const BAND_BTN = 'flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-on-signal transition-colors hover:bg-on-signal/10 [&>svg]:size-4'

export function ItemPanel() {
  const id = useStore((s) => s.openItemId)
  const item = useStore((s) => (id ? s.item[id] : undefined))
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-30 bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={() => openItem(null)}
          />
          <motion.aside
            key="panel"
            initial={{ x: 4, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 4, opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: EASE }}
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[640px] flex-col border-l border-line-strong bg-panel shadow-pop"
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
  const editable = useCanEdit()
  const allUpdates = useMemo(() => Object.values(updatesMap).filter((u) => u.itemId === itemId), [updatesMap, itemId])
  const updates = useMemo(() => allUpdates.filter((u) => !u.parentId || !updatesMap[u.parentId]).sort((a, b) => b.createdAt - a.createdAt), [allUpdates, updatesMap])
  const repliesOf = (id: string) => allUpdates.filter((u) => u.parentId === id).sort((a, b) => a.createdAt - b.createdAt)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const sendReply = (parentId: string) => {
    if (!item || !replyDraft.trim()) return
    addUpdate(item.id, replyDraft.trim(), parentId)
    setReplyDraft('')
    setReplyTo(null)
  }
  const activity = useMemo(() => Object.values(activityMap).filter((a) => a.itemId === itemId).sort((a, b) => b.at - a.at), [activityMap, itemId])
  const subs = useMemo(() => Object.values(itemsMap).filter((i) => i.parentId === itemId && isLive(i)).sort((a, b) => a.order - b.order), [itemsMap, itemId])
  if (!item || !board) return null
  const group = board.groups.find((g) => g.id === item.groupId)
  const subscribed = subscribersOf(board, item).includes(meId)
  const gone = item.deletedAt ? 'in the trash' : item.archived ? 'archived' : ''
  const parent = item.parentId ? itemsMap[item.parentId] : undefined
  const mention = draft.match(/@(\w*)$/)?.[1]
  const mentionHits = mention !== undefined ? Object.values(users).filter((u) => !u.removedAt && u.name.toLowerCase().startsWith(mention.toLowerCase())).slice(0, 5) : []

  const send = () => {
    if (!draft.trim()) return
    addUpdate(item.id, draft.trim())
    setDraft('')
  }

  const tabs = [
    ['updates', 'Updates', allUpdates.length],
    ...(item.parentId ? [] : [['subitems', 'Subitems', subs.length]]),
    ['activity', 'Activity', activity.length],
  ] as [Tab, string, number][]

  return (
    <>
      {/* yellow band: where the item sits, and its name */}
      <div className="band bg-signal px-6 pb-5 pt-3 text-on-signal">
        <div className="flex items-center gap-2">
          <nav aria-label="Item location" className="caps flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold tracking-[0.12em]">
            <span className="truncate text-on-signal/80">{board.name}</span>
            <span aria-hidden className="text-on-signal/60">/</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 ring-1 ring-on-signal/30" style={{ background: group?.color }} />
              <span className="truncate">{group?.title}</span>
            </span>
            {parent && (
              <>
                <span aria-hidden className="text-on-signal/60">/</span>
                <button className="truncate hover:underline" onClick={() => openItem(parent.id)}>
                  {parent.name}
                </button>
              </>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-0.5">
            {editable && (
              <button
                onClick={() => toggleSubscribe(item.id)}
                aria-pressed={subscribed}
                title={subscribed ? 'You get notified about updates and status changes' : 'Get notified about updates and status changes'}
                className={BAND_BTN}
              >
                {subscribed ? <Bell className="fill-on-signal" /> : <BellOff />}
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            )}
            <button ref={menuRef} hidden={!editable} onClick={() => setMenu(true)} aria-label="Item options" title="Item options" className={cx(BAND_BTN, 'w-8 justify-center px-0')}>
              <MoreHorizontal />
            </button>
            <button onClick={() => openItem(null)} aria-label="Close" title="Close (Esc)" className={cx(BAND_BTN, 'w-8 justify-center px-0')}>
              <X />
            </button>
          </div>
          <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)} width={190} align="end">
            <MenuItem icon={<Copy />} onClick={() => { const c = duplicateItem(item.id); setMenu(false); if (c) openItem(c.id) }}>Duplicate</MenuItem>
            <MenuItem icon={<Archive />} onClick={() => (setMenu(false), archiveItems([item.id]))}>Archive item</MenuItem>
            <MenuItem icon={<Trash2 />} danger onClick={() => (setMenu(false), deleteItems([item.id]))}>Delete item</MenuItem>
          </Popover>
        </div>
        <div className="mt-3">
          {editable ? (
            <EditableText value={item.name} onCommit={(n) => renameItem(item.id, n)} className="caps block text-[32px] font-bold leading-[1.05] tracking-[0.02em]" />
          ) : (
            <h2 className="caps text-[32px] font-bold leading-[1.05] tracking-[0.02em]">{item.name}</h2>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {gone && (
          <div className="flex items-center gap-2 border-b border-line bg-panel-2 px-6 py-2.5 text-[13.5px] text-muted">
            This item is {gone}.
            {editable && (
              <button onClick={() => restoreItems([item.id])} className="ml-auto flex items-center gap-1 font-medium text-accent hover:underline">
                <RotateCcw className="size-3.5" /> Restore
              </button>
            )}
          </div>
        )}

        {/* fields table */}
        <div className="px-6 pt-5">
          <div className="border-t-2 border-fg">
            {board.columns.map((c) => {
              const T = COLUMN_TYPES.find((t) => t.type === c.type)
              return (
                <div key={c.id} className="grid grid-cols-[150px_1fr] border-b border-line">
                  <span className="caps flex h-10 items-center gap-2 pr-3 text-[12.5px] font-semibold tracking-[0.1em] text-muted">
                    {T && <T.icon className="size-3.5 shrink-0" />}
                    <span className="truncate">{c.title}</span>
                  </span>
                  <div className="h-10 overflow-hidden border-l border-line">
                    <div inert={!editable} className="h-full">
                      <Cell board={board} col={c} item={item} groupColor={group?.color ?? '#121212'} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <nav className="sticky top-0 z-[1] mt-6 flex gap-1 border-b border-line bg-panel px-6" aria-label="Item sections">
          {tabs.map(([k, label, n]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-current={tab === k ? 'true' : undefined}
              className={cx(
                'caps relative -mb-px flex h-10 items-center gap-2 border-b-2 px-2.5 text-[14px] font-semibold tracking-[0.1em] transition-colors',
                tab === k ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {label}
              {n > 0 && <span className="font-mono text-[11.5px] font-medium tracking-normal text-faint">{n}</span>}
            </button>
          ))}
        </nav>

        <div className="px-6 py-5">
          {tab === 'updates' && (
            <>
              <div className="relative rounded-md border border-line-strong bg-panel p-3 transition-colors focus-within:border-accent">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
                  }}
                  rows={3}
                  placeholder="Write an update… use @ to mention a teammate"
                  aria-label="Write an update"
                  className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none placeholder:text-faint"
                />
                {mentionHits.length > 0 && (
                  <div className="absolute left-3 top-full z-10 mt-1 w-56 rounded-lg border border-line-strong bg-panel p-1 shadow-pop">
                    {mentionHits.map((u) => (
                      <button key={u.id} onClick={() => setDraft(draft.replace(/@\w*$/, '@' + u.name.split(' ')[0] + ' '))} className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-[13.5px] hover:bg-hover">
                        <Avatar user={u} size={20} /> {u.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-mono text-[11px] text-faint">Ctrl + Enter to post</span>
                  <Button variant="primary" onClick={send} disabled={!draft.trim()}>
                    <Send className="!size-3.5" /> Post update
                  </Button>
                </div>
              </div>
              <div className="mt-4 divide-y divide-line">
                <AnimatePresence initial={false}>
                  {updates.map((u) => (
                    <motion.article
                      key={u.id}
                      layout="position"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14, ease: EASE }}
                      className="py-4"
                    >
                      <header className="mb-1.5 flex items-center gap-2.5">
                        <Avatar user={users[u.authorId]} size={26} />
                        <span className="text-[14px] font-semibold">{users[u.authorId]?.name ?? 'Someone'}</span>
                        <span className="font-mono text-[11.5px] text-faint">{formatDistanceToNow(u.createdAt, { addSuffix: true })}</span>
                        {u.authorId === meId && (
                          <button onClick={() => remove('update', u.id)} aria-label="Delete update" title="Delete update" className="ml-auto grid size-7 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </header>
                      <p className="whitespace-pre-wrap pl-[36px] text-[14px] leading-relaxed">
                        <Mentions body={u.body} />
                      </p>
                      <div className="flex pl-[36px]">
                        <LikeButton u={u} meId={meId} />
                        <button
                          onClick={() => (setReplyTo(replyTo === u.id ? null : u.id), setReplyDraft(''))}
                          aria-expanded={replyTo === u.id}
                          className="mt-2 flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12.5px] text-muted transition-colors hover:bg-hover hover:text-fg"
                        >
                          <Reply className="size-3.5" /> Reply
                        </button>
                      </div>
                      {(repliesOf(u.id).length > 0 || replyTo === u.id) && (
                        <div className="ml-[36px] mt-2 space-y-3 border-l-2 border-line pl-4">
                          {repliesOf(u.id).map((rp) => (
                            <div key={rp.id}>
                              <div className="flex items-center gap-2">
                                <Avatar user={users[rp.authorId]} size={20} />
                                <span className="text-[13px] font-semibold">{users[rp.authorId]?.name ?? 'Someone'}</span>
                                <span className="font-mono text-[11px] text-faint">{formatDistanceToNow(rp.createdAt, { addSuffix: true })}</span>
                                {rp.authorId === meId && (
                                  <button onClick={() => remove('update', rp.id)} aria-label="Delete reply" title="Delete reply" className="ml-auto grid size-6 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
                                    <Trash2 className="size-3" />
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap pl-7 text-[13.5px] leading-relaxed">
                                <Mentions body={rp.body} />
                              </p>
                              <div className="pl-7">
                                <LikeButton u={rp} meId={meId} />
                              </div>
                            </div>
                          ))}
                          {replyTo === u.id && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault()
                                sendReply(u.id)
                              }}
                              className="flex items-end gap-2"
                            >
                              <textarea
                                autoFocus
                                rows={2}
                                value={replyDraft}
                                onChange={(e) => setReplyDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(u.id)
                                  if (e.key === 'Escape') (e.stopPropagation(), setReplyTo(null))
                                }}
                                placeholder="Write a reply…"
                                aria-label="Write a reply"
                                className="min-w-0 flex-1 resize-none rounded-md border border-line-strong bg-panel px-2.5 py-1.5 text-[13.5px] outline-none focus:border-accent"
                              />
                              <Button variant="primary" disabled={!replyDraft.trim()}>
                                Reply
                              </Button>
                            </form>
                          )}
                        </div>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
                {!updates.length && (
                  <div className="py-10 text-center">
                    <MessageCircle className="mx-auto mb-3 size-8 text-line-strong" />
                    <p className="caps text-[16px] font-bold tracking-[0.08em]">No updates yet</p>
                    <p className="mt-1 text-[13.5px] text-muted">Share progress, ask a question, or mention a teammate with @.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'subitems' && (
            <div className="border-t border-line">
              {subs.map((s) => (
                <div key={s.id} className="group flex h-10 items-center gap-2.5 border-b border-line text-[14px]">
                  <span className="size-[7px] shrink-0 border border-muted" />
                  {editable ? <EditableText value={s.name} onCommit={(n) => renameItem(s.id, n)} className="flex-1" /> : <span className="flex-1 truncate">{s.name}</span>}
                  <button onClick={() => openItem(s.id)} className="text-[13px] text-accent hover:underline">
                    Open
                  </button>
                  <button hidden={!editable} onClick={() => deleteItems([s.id])} aria-label="Delete subitem" title="Delete subitem" className="grid size-7 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <form
                hidden={!editable}
                onSubmit={(e) => {
                  e.preventDefault()
                  const f = e.currentTarget.elements.namedItem('sub') as HTMLInputElement
                  if (f.value.trim()) addItem(board.id, item.groupId, f.value.trim(), { parentId: item.id })
                  f.value = ''
                }}
                className="flex h-10 items-center gap-2.5 border-b border-line text-faint"
              >
                <Plus className="size-3.5" />
                <input name="sub" placeholder="Add a subitem" aria-label="Add a subitem" className="h-8 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-faint" />
              </form>
            </div>
          )}

          {tab === 'activity' && (
            <ol className="divide-y divide-line border-t border-line">
              {activity.map((a) => (
                <li key={a.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-2.5 text-[13.5px]">
                  <span>
                    <span className="font-medium">{users[a.actorId]?.name ?? 'Someone'}</span> <span className="text-muted">{a.text}</span>
                  </span>
                  <span className="font-mono text-[11.5px] text-faint">{formatDistanceToNow(a.at, { addSuffix: true })}</span>
                </li>
              ))}
              {!activity.length && <li className="py-3 text-[13.5px] text-muted">No changes recorded for this item yet.</li>}
            </ol>
          )}
        </div>
      </div>
    </>
  )
}

function Mentions({ body }: { body: string }) {
  return (
    <>
      {body.split(/(@\w+)/g).map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="rounded-sm bg-accent-soft px-1 font-medium text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

function LikeButton({ u, meId }: { u: Update; meId: string }) {
  const mine = u.likes.includes(meId)
  return (
    <button
      onClick={() => toggleLike(u.id)}
      aria-pressed={mine}
      className={cx('-ml-2 mt-2 flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12.5px] transition-colors hover:bg-hover', mine ? 'text-fg' : 'text-muted')}
    >
      <Heart className={cx('size-3.5', mine && 'fill-current')} />
      {u.likes.length > 0 ? <span className="font-mono">{u.likes.length}</span> : 'Like'}
    </button>
  )
}

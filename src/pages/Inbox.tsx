import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNow } from 'date-fns'
import { BellOff, CheckCheck } from 'lucide-react'
import { markRead, navigate, openItem, useStore } from '../lib/store'
import { Avatar, Button, cx } from '../components/ui'

export function Inbox() {
  const meId = useStore((s) => s.meId)
  const all = useStore((s) => s.notification)
  const users = useStore((s) => s.user)
  const boards = useStore((s) => s.board)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const list = useMemo(
    () =>
      Object.values(all)
        .filter((n) => n.userId === meId && (filter === 'all' || !n.read))
        .sort((a, b) => b.at - a.at),
    [all, meId, filter],
  )
  const unread = list.filter((n) => !n.read).map((n) => n.id)
  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-tight">Inbox</h1>
            <p className="text-[14px] text-muted">Mentions, assignments and automation alerts.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line bg-panel p-0.5 text-[13px]">
              {(['all', 'unread'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cx('relative rounded-md px-3 py-1 capitalize', filter === f ? 'text-fg' : 'text-muted')}>
                  {filter === f && <motion.span layoutId="inbox-filter" className="absolute inset-0 rounded-md bg-panel-2" />}
                  <span className="relative">{f}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" disabled={!unread.length} onClick={() => markRead(unread)}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((n) => (
              <motion.button
                layout
                key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                onClick={() => {
                  markRead([n.id])
                  if (n.boardId && boards[n.boardId]) navigate({ page: 'board', boardId: n.boardId })
                  if (n.itemId) openItem(n.itemId)
                }}
                className={cx('flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card', n.read ? 'border-line bg-panel/60' : 'border-accent/30 bg-panel shadow-card')}
              >
                <Avatar user={users[n.actorId]} size={34} />
                <span className="min-w-0 flex-1 text-[14px] leading-snug">
                  <span className="font-medium">{users[n.actorId]?.name ?? 'Someone'}</span> <span className="text-muted">{n.text}</span>
                  <span className="mt-1 block text-[12px] text-faint">
                    {n.boardId && boards[n.boardId] ? `${boards[n.boardId].icon} ${boards[n.boardId].name} · ` : ''}
                    {formatDistanceToNow(n.at, { addSuffix: true })}
                  </span>
                </span>
                {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />}
              </motion.button>
            ))}
          </AnimatePresence>
          {!list.length && (
            <div className="rounded-3xl border border-line bg-panel p-14 text-center shadow-card">
              <BellOff className="mx-auto mb-4 size-11 text-line-strong" />
              <p className="font-display text-xl font-semibold">Inbox zero</p>
              <p className="text-[14px] text-muted">When teammates mention or assign you, it shows up here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

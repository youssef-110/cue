import { useMemo, useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { markRead, navigate, openItem, useStore } from '../lib/store'
import { Avatar, Button, cx } from '../components/ui'
import { Stamp } from '../components/departure'

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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="caps text-[34px] font-bold leading-none">Inbox</h1>
            <p className="mt-2 text-[14px] text-muted">Mentions, assignments and automation alerts.</p>
          </div>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Show" className="inline-flex h-8 items-center rounded-md border border-line bg-panel p-0.5">
              {(['all', 'unread'] as const).map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={cx('caps h-full rounded-sm px-3 text-[13px] font-semibold tracking-[0.1em] transition-colors', filter === f ? 'bg-ink text-on-ink dark:bg-signal dark:text-on-signal' : 'text-muted hover:text-fg')}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="outline" disabled={!unread.length} onClick={() => markRead(unread)}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
        </div>
        <ul className="rounded-lg border border-line bg-panel">
          {list.map((n) => (
            <li key={n.id} className="border-b border-line last:border-b-0">
              <button
                onClick={() => {
                  markRead([n.id])
                  if (n.boardId && boards[n.boardId]) navigate({ page: 'board', boardId: n.boardId })
                  if (n.itemId) openItem(n.itemId)
                }}
                className="grid w-full grid-cols-[10px_28px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left hover:bg-hover"
              >
                <span className="mt-2.5 grid place-items-center">{!n.read && (
                    <>
                      <span aria-hidden className="size-2 rounded-full bg-fg" />
                      <span className="sr-only">Unread:</span>
                    </>
                  )}</span>
                <Avatar user={users[n.actorId]} size={28} />
                <span className={cx('min-w-0 text-[14px] leading-snug', n.read ? 'text-muted' : 'text-fg')}>
                  <span className={n.read ? 'font-medium' : 'font-semibold'}>{users[n.actorId]?.name ?? 'Someone'}</span> <span className={n.read ? '' : 'font-semibold'}>{n.text}</span>
                  {n.boardId && boards[n.boardId] && <span className="mt-0.5 block truncate text-[12.5px] font-normal text-faint">{boards[n.boardId].name}</span>}
                </span>
                <Stamp at={n.at} className="pt-0.5" />
              </button>
            </li>
          ))}
          {!list.length && (
            <li className="px-6 py-10">
              <p className="caps text-[19px] font-bold">{filter === 'unread' ? 'All read' : 'Inbox zero'}</p>
              <p className="mt-1 text-[14px] text-muted">When teammates mention or assign you, it shows up here.</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

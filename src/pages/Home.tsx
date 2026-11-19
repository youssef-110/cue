import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow, differenceInCalendarDays, parseISO } from 'date-fns'
import { ArrowRight, Plus } from 'lucide-react'
import { isLive, labelOf, navigate, openItem, useCanEdit, useStore, visibleItem } from '../lib/store'
import { isDoneItem } from '../components/cells'
import { Avatar, Button, LabelPill, cx } from '../components/ui'
import { TemplateModal } from '../components/TemplateModal'
import { DueTime, Stamp, dueOf } from '../components/departure'
import type { Board, Item } from '../lib/types'

const greet = (h: number) => (h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')

const useNow = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const head = 'caps text-[12px] font-semibold tracking-[0.14em] text-fg'
const DEPARTURES = 8

export function Home() {
  const me = useStore((s) => s.user[s.meId])
  const meId = useStore((s) => s.meId)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const users = useStore((s) => s.user)
  const activity = useStore((s) => s.activity)
  const ws = useStore((s) => Object.values(s.workspace)[0])
  const [creating, setCreating] = useState(false)
  const editable = useCanEdit()
  const now = useNow()

  const { stats, departures } = useMemo(() => {
    let mine = 0, overdue = 0, done = 0
    const out: { item: Item; board: Board; due: string }[] = []
    for (const i of Object.values(items)) {
      const b = boards[i.boardId]
      if (!b || i.parentId || !visibleItem(i, boards, items)) continue
      const assigned = b.columns.some((c) => c.type === 'people' && ((i.values[c.id] as string[]) ?? []).includes(meId))
      const isDone = isDoneItem(b, i)
      if (isDone) done++
      if (!assigned || isDone) continue
      mine++
      const due = dueOf(b, i)
      if (due && differenceInCalendarDays(parseISO(due), new Date()) < 0) overdue++
      if (due) out.push({ item: i, board: b, due })
    }
    out.sort((a, b) => a.due.localeCompare(b.due))
    return { stats: { mine, overdue, done }, departures: out }
  }, [items, boards, meId])

  const recent = useMemo(() => Object.values(activity).filter((a) => isLive(boards[a.boardId])).sort((a, b) => b.at - a.at).slice(0, 12), [activity, boards])
  const lastAt = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of Object.values(activity)) m[a.boardId] = Math.max(m[a.boardId] ?? 0, a.at)
    return m
  }, [activity])
  const boardList = Object.values(boards).filter(isLive).sort((a, b) => a.order - b.order)

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b-2 border-on-signal bg-signal px-8 pb-4 pt-5 text-on-signal">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <h1 className="caps text-[36px] font-bold leading-[0.95]">
            {greet(now.getHours())}, {me?.name.split(' ')[0]}
          </h1>
          <span className="font-mono text-[13px] font-medium tabular-nums">{format(now, 'EEE d MMM · HH:mm').toUpperCase()}</span>
        </div>
        <p className="mx-auto mt-3 flex max-w-6xl flex-wrap gap-x-5 gap-y-1 font-mono text-[13px] font-medium">
          <span><b className="font-semibold">{stats.mine}</b> ASSIGNED TO YOU</span>
          {stats.overdue > 0 && (
            <span className="-my-0.5 rounded-sm bg-alert px-1.5 py-0.5 text-white">
              <b className="font-semibold">{stats.overdue}</b> DELAYED
            </span>
          )}
          <span><b className="font-semibold">{stats.done}</b> DONE ACROSS BOARDS</span>
        </p>
      </header>

      <div className="mx-auto max-w-6xl px-8 pb-12 pt-8">
        <section aria-labelledby="dep-title">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="dep-title" className="caps text-[19px] font-bold">
              Departures <span className="ml-1 font-mono text-[12px] font-medium normal-case tracking-normal text-muted">{departures.length} due</span>
            </h2>
            <button onClick={() => navigate({ page: 'my-work' })} className="flex items-center gap-1 text-[13px] text-accent hover:underline">
              All my work <ArrowRight className="size-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <div className="min-w-[640px]">
              <div className={cx('grid h-9 grid-cols-[170px_170px_minmax(0,1fr)_130px] items-center border-b-2 border-fg px-4', head)}>
                <span>Due</span>
                <span>Board</span>
                <span>Item</span>
                <span>Status</span>
              </div>
              {departures.slice(0, DEPARTURES).map(({ item, board, due }) => {
                const st = board.columns.find((c) => c.type === 'status')
                return (
                  <div key={item.id} className="grid h-12 grid-cols-[170px_170px_minmax(0,1fr)_130px] items-center border-b border-line px-4 last:border-b-0 hover:bg-hover">
                    <DueTime date={due} />
                    <button onClick={() => navigate({ page: 'board', boardId: board.id })} className="truncate pr-3 text-left text-[13px] text-muted hover:text-accent">
                      {board.name}
                    </button>
                    <button onClick={() => (navigate({ page: 'board', boardId: board.id }), openItem(item.id))} className="truncate pr-3 text-left text-[14.5px] hover:text-accent">
                      {item.name}
                    </button>
                    <span className="min-w-0">{st ? <LabelPill label={labelOf(st, item.values[st.id])} /> : null}</span>
                  </div>
                )
              })}
              {!departures.length && <p className="px-4 py-6 text-[13.5px] text-muted">Nothing with a date is assigned to you. Items you own with a deadline show up here.</p>}
              {departures.length > DEPARTURES && (
                <button onClick={() => navigate({ page: 'my-work' })} className="w-full border-t border-line px-4 py-2.5 text-left font-mono text-[12px] text-muted hover:bg-hover hover:text-fg">
                  +{departures.length - DEPARTURES} MORE IN MY WORK
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="boards-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="boards-title" className="caps text-[19px] font-bold">
                Boards <span className="ml-1 font-mono text-[12px] font-medium normal-case tracking-normal text-muted">{boardList.length}</span>
              </h2>
              {ws && editable && (
                <Button variant="outline" onClick={() => setCreating(true)}>
                  <Plus /> New board
                </Button>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full min-w-[520px] border-collapse text-[14px]">
                <thead>
                  <tr className="h-9 border-b-2 border-fg text-left">
                    <th className={cx('px-4 font-semibold', head)}>Board</th>
                    <th className={cx('w-20 px-2 text-right', head)}>Items</th>
                    <th className={cx('w-40 px-4', head)}>Done</th>
                    <th className={cx('w-32 px-4', head)}>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {boardList.map((b) => {
                    const list = Object.values(items).filter((x) => x.boardId === b.id && !x.parentId && visibleItem(x, boards, items))
                    const done = list.filter((x) => isDoneItem(b, x)).length
                    const pct = list.length ? Math.round((done / list.length) * 100) : 0
                    const last = lastAt[b.id] ?? b.createdAt
                    return (
                      <tr key={b.id} onClick={() => navigate({ page: 'board', boardId: b.id })} className="h-11 cursor-pointer border-b border-line last:border-b-0 hover:bg-hover">
                        <td className="px-4">
                          <button onClick={(e) => (e.stopPropagation(), navigate({ page: 'board', boardId: b.id }))} className="truncate text-left font-medium hover:text-accent">
                            {b.name}
                          </button>
                        </td>
                        <td className="px-2 text-right font-mono text-[13px] tabular-nums">{list.length}</td>
                        <td className="px-4">
                          <span className="flex items-center gap-2.5">
                            <span className="h-1 flex-1 overflow-hidden rounded-sm bg-panel-2" role="img" aria-label={`${pct}% done`}>
                              <span className="block h-full bg-fg" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="w-9 text-right font-mono text-[12px] tabular-nums text-muted">{pct}%</span>
                          </span>
                        </td>
                        <td className="px-4 text-[12.5px] text-muted" title={format(last, 'EEEE d MMMM yyyy, HH:mm')}>
                          {formatDistanceToNow(last, { addSuffix: true })}
                        </td>
                      </tr>
                    )
                  })}
                  {!boardList.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-[13.5px] text-muted">
                        No boards yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="log-title">
            <h2 id="log-title" className="caps mb-3 text-[19px] font-bold">
              Recent activity
            </h2>
            <ol className="rounded-lg border border-line bg-panel">
              {recent.map((a) => (
                <li key={a.id} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => (navigate({ page: 'board', boardId: a.boardId }), a.itemId && openItem(a.itemId))}
                    className="grid w-full grid-cols-[52px_20px_minmax(0,1fr)] items-start gap-2 px-3 py-2.5 text-left hover:bg-hover"
                  >
                    <Stamp at={a.at} className="pt-px" />
                    <Avatar user={users[a.actorId]} size={20} />
                    <span className="min-w-0 text-[13px] leading-snug">
                      <span className="font-medium">{users[a.actorId]?.name.split(' ')[0]}</span> <span className="text-muted">{a.text}</span>
                      <span className="block truncate text-[12px] text-faint">{boards[a.boardId]?.name}</span>
                    </span>
                  </button>
                </li>
              ))}
              {!recent.length && <li className="px-4 py-6 text-[13px] text-muted">Changes your team makes show up here.</li>}
            </ol>
          </section>
        </div>
      </div>
      <TemplateModal workspaceId={creating ? ws?.id ?? null : null} onClose={() => setCreating(false)} />
    </div>
  )
}

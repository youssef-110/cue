import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { CheckCircle2 } from 'lucide-react'
import { navigate, openItem, useStore } from '../lib/store'
import type { Board, Item } from '../lib/types'
import { StatusCell, DateCell, isDoneItem } from '../components/cells'
import { cx } from '../components/ui'

type Bucket = 'Overdue' | 'Today' | 'This week' | 'Next week' | 'Later' | 'No date'
const ORDER: Bucket[] = ['Overdue', 'Today', 'This week', 'Next week', 'Later', 'No date']
const TINT: Record<Bucket, string> = { Overdue: '#f0475a', Today: '#ff8a3d', 'This week': '#5b5bf0', 'Next week': '#14b8c4', Later: '#8a93a6', 'No date': '#8a93a6' }

function dueOf(board: Board, item: Item): string | undefined {
  for (const c of board.columns) {
    const v = item.values[c.id]
    if (c.type === 'date' && typeof v === 'string') return v
    if (c.type === 'timeline' && v && typeof v === 'object') return (v as { end: string }).end
  }
}

export function MyWork() {
  const meId = useStore((s) => s.meId)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const [showDone, setShowDone] = useState(false)

  const rows = useMemo(() => {
    const out: { item: Item; board: Board; due?: string; bucket: Bucket; done: boolean }[] = []
    for (const item of Object.values(items)) {
      const board = boards[item.boardId]
      if (!board) continue
      const mine = board.columns.some((c) => c.type === 'people' && ((item.values[c.id] as string[]) ?? []).includes(meId))
      if (!mine) continue
      const done = isDoneItem(board, item)
      if (done && !showDone) continue
      const due = dueOf(board, item)
      const d = due ? differenceInCalendarDays(parseISO(due), new Date()) : null
      const dow = (new Date().getDay() + 6) % 7
      const bucket: Bucket = d === null ? 'No date' : d < 0 && !done ? 'Overdue' : d <= 0 ? 'Today' : d <= 6 - dow ? 'This week' : d <= 13 - dow ? 'Next week' : 'Later'
      out.push({ item, board, due, bucket, done })
    }
    return out.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  }, [items, boards, meId, showDone])

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-[30px] font-semibold tracking-tight">My work</h1>
            <p className="text-[14px] text-muted">Everything assigned to you, across every board.</p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[var(--accent)]" /> Show done
          </label>
        </div>
        {!rows.length && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-line bg-panel p-14 text-center shadow-card">
            <CheckCircle2 className="mx-auto mb-4 size-12 text-[#00b884]" />
            <p className="font-display text-xl font-semibold">You’re all caught up</p>
            <p className="text-[14px] text-muted">Nothing is assigned to you right now.</p>
          </motion.div>
        )}
        {ORDER.map((bucket) => {
          const list = rows.filter((r) => r.bucket === bucket)
          if (!list.length) return null
          return (
            <section key={bucket} className="mb-7">
              <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold" style={{ color: TINT[bucket] }}>
                {bucket} <span className="rounded-full bg-panel-2 px-2 text-[11.5px] font-medium text-muted">{list.length}</span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-card">
                {list.map(({ item, board }, i) => {
                  const status = board.columns.find((c) => c.type === 'status')
                  const date = board.columns.find((c) => c.type === 'date')
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className={cx('grid grid-cols-[1fr_180px_150px_120px] items-center border-line text-[13.5px]', i && 'border-t')}
                    >
                      <button onClick={() => openItem(item.id)} className="flex h-11 min-w-0 items-center gap-2 px-4 text-left hover:text-accent">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: board.groups.find((g) => g.id === item.groupId)?.color }} />
                        <span className="truncate">{item.name}</span>
                      </button>
                      <button onClick={() => navigate({ page: 'board', boardId: board.id })} className="truncate px-2 text-left text-[12.5px] text-muted hover:text-accent">
                        {board.icon} {board.name}
                      </button>
                      <div className="h-11 border-l border-line">{status && <StatusCell board={board} col={status} item={item} />}</div>
                      <div className="h-11 border-l border-line">{date && <DateCell board={board} col={date} item={item} />}</div>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

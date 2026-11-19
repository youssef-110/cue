import { useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { navigate, openItem, useCanEdit, useStore, visibleItem } from '../lib/store'
import type { Board, Item } from '../lib/types'
import { StatusCell, DateCell, isDoneItem } from '../components/cells'
import { cx } from '../components/ui'
import { DueTime, dueOf } from '../components/departure'

type Bucket = 'Overdue' | 'Today' | 'This week' | 'Next week' | 'Later' | 'No date'
const ORDER: Bucket[] = ['Overdue', 'Today', 'This week', 'Next week', 'Later', 'No date']
const COLS = 'grid grid-cols-[170px_minmax(0,1fr)_180px_150px] items-center'
const head = 'caps text-[12px] font-semibold tracking-[0.14em] text-fg'

export function MyWork() {
  const meId = useStore((s) => s.meId)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const [showDone, setShowDone] = useState(false)
  const editable = useCanEdit()

  const rows = useMemo(() => {
    const out: { item: Item; board: Board; due?: string; bucket: Bucket; done: boolean }[] = []
    for (const item of Object.values(items)) {
      const board = boards[item.boardId]
      if (!board || !visibleItem(item, boards, items)) continue
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
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="caps text-[34px] font-bold leading-none">My work</h1>
            <p className="mt-2 text-[14px] text-muted">Everything assigned to you, across every board, by deadline.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted hover:text-fg">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
          </label>
        </div>
        {!rows.length ? (
          <div className="rounded-lg border border-line bg-panel px-6 py-10">
            <p className="caps text-[19px] font-bold">You’re all caught up</p>
            <p className="mt-1 text-[14px] text-muted">Nothing is assigned to you right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <div className="min-w-[700px]">
              <div className={cx(COLS, 'h-9 border-b-2 border-fg px-4', head)}>
                <span>Deadline</span>
                <span>Item</span>
                <span className="px-2">Board</span>
                <span className="text-center">Status</span>
              </div>
              {ORDER.map((bucket) => {
                const list = rows.filter((r) => r.bucket === bucket)
                if (!list.length) return null
                return (
                  <section key={bucket} aria-label={bucket}>
                    <h2 className={cx('caps flex items-baseline gap-2.5 border-b border-fg px-4 pb-2 pt-5 text-[17px] font-bold tracking-[0.12em]', bucket === 'Overdue' && 'text-alert')}>
                      {bucket}
                      <span className="font-mono text-[12px] font-medium normal-case tracking-normal text-muted">
                        {list.length} item{list.length === 1 ? '' : 's'}
                      </span>
                    </h2>
                    {list.map(({ item, board, due, done }) => {
                      const status = board.columns.find((c) => c.type === 'status')
                      const date = board.columns.find((c) => c.type === 'date')
                      const group = board.groups.find((g) => g.id === item.groupId)
                      return (
                        <div key={item.id} className={cx(COLS, 'border-b border-line px-4 text-[14px] last:border-b-0 hover:bg-hover', done && 'text-muted')}>
                          <div inert={!editable} className="flex h-11 items-center">
                            {date ? <DateCell board={board} col={date} item={item} /> : <DueTime date={due} done={done} />}
                          </div>
                          <button onClick={() => openItem(item.id)} className="flex h-11 min-w-0 items-center gap-2.5 pr-3 text-left hover:text-accent">
                            <span aria-hidden className="size-2 shrink-0 rounded-[1px]" style={{ background: group?.color }} />
                            <span className="truncate">{item.name}</span>
                          </button>
                          <button onClick={() => navigate({ page: 'board', boardId: board.id })} className="truncate px-2 text-left text-[13px] text-muted hover:text-accent">
                            {board.name}
                          </button>
                          <div inert={!editable} className="h-11">
                            {status && <StatusCell board={board} col={status} item={item} />}
                          </div>
                        </div>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { formatDistanceToNow, differenceInCalendarDays, parseISO } from 'date-fns'
import { ArrowUpRight, Plus } from 'lucide-react'
import { navigate, openItem, useStore } from '../lib/store'
import { isDoneItem } from '../components/cells'
import { Avatar, Button } from '../components/ui'
import { TemplateModal } from '../components/TemplateModal'

const greet = () => {
  const h = new Date().getHours()
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function Home() {
  const me = useStore((s) => s.user[s.meId])
  const meId = useStore((s) => s.meId)
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const users = useStore((s) => s.user)
  const activity = useStore((s) => s.activity)
  const ws = useStore((s) => Object.values(s.workspace)[0])
  const [creating, setCreating] = useState(false)

  const stats = useMemo(() => {
    let mine = 0, overdue = 0, doneWeek = 0
    for (const i of Object.values(items)) {
      const b = boards[i.boardId]
      if (!b || i.parentId) continue
      const assigned = b.columns.some((c) => c.type === 'people' && ((i.values[c.id] as string[]) ?? []).includes(meId))
      const done = isDoneItem(b, i)
      if (assigned && !done) mine++
      const date = b.columns.find((c) => c.type === 'date')
      const v = date && (i.values[date.id] as string)
      if (assigned && v && !done && differenceInCalendarDays(parseISO(v), new Date()) < 0) overdue++
      if (done) doneWeek++
    }
    return { mine, overdue, doneWeek }
  }, [items, boards, meId])

  const recent = useMemo(() => Object.values(activity).filter((a) => boards[a.boardId]).sort((a, b) => b.at - a.at).slice(0, 12), [activity, boards])
  const boardList = Object.values(boards).sort((a, b) => a.order - b.order)

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative overflow-hidden border-b border-line px-8 pb-10 pt-10">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-32 size-[420px] rounded-full bg-[#6b5cff]/15 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 right-60 size-[360px] rounded-full bg-[#14c4c4]/15 blur-[100px]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-[14px] text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="mt-1 font-display text-[34px] font-semibold tracking-tight">
            {greet()}, {me?.name.split(' ')[0]}
          </h1>
          <div className="mt-6 grid max-w-3xl grid-cols-3 gap-3">
            {[
              ['Open items assigned to you', stats.mine, '#5b5bf0'],
              ['Overdue', stats.overdue, '#f0475a'],
              ['Completed across boards', stats.doneWeek, '#00b884'],
            ].map(([label, n, c], i) => (
              <motion.button
                key={label as string}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => navigate({ page: 'my-work' })}
                className="rounded-2xl border border-line bg-panel/80 p-4 text-left shadow-card backdrop-blur transition hover:-translate-y-0.5"
              >
                <div className="font-display text-[30px] font-semibold tabular-nums" style={{ color: c as string }}>{n}</div>
                <div className="text-[12.5px] text-muted">{label}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-8 py-8 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[18px] font-semibold">Boards</h2>
            {ws && (
              <Button variant="soft" onClick={() => setCreating(true)}>
                <Plus /> New board
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {boardList.map((b, i) => {
              const list = Object.values(items).filter((x) => x.boardId === b.id && !x.parentId)
              const done = list.filter((x) => isDoneItem(b, x)).length
              const pct = list.length ? Math.round((done / list.length) * 100) : 0
              return (
                <motion.button
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i, type: 'spring', stiffness: 300, damping: 28 }}
                  onClick={() => navigate({ page: 'board', boardId: b.id })}
                  className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-4 text-left shadow-card transition hover:-translate-y-1 hover:shadow-pop"
                >
                  <div className="mb-8 flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-panel-2 text-[22px] transition group-hover:scale-110">{b.icon}</span>
                    <ArrowUpRight className="size-4 text-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                  <div className="font-medium">{b.name}</div>
                  <div className="mb-3 text-[12.5px] text-muted">{list.length} items · {pct}% done</div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-panel-2">
                    {b.groups.map((g) => {
                      const n = list.filter((x) => x.groupId === g.id).length
                      return n ? <span key={g.id} style={{ width: `${(n / list.length) * 100}%`, background: g.color }} /> : null
                    })}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </section>
        <aside>
          <h2 className="mb-3 font-display text-[18px] font-semibold">Recent activity</h2>
          <div className="rounded-2xl border border-line bg-panel p-2 shadow-card">
            {recent.map((a) => (
              <button key={a.id} onClick={() => (navigate({ page: 'board', boardId: a.boardId }), a.itemId && openItem(a.itemId))} className="flex w-full items-start gap-2.5 rounded-xl p-2 text-left hover:bg-hover">
                <Avatar user={users[a.actorId]} size={26} />
                <span className="min-w-0 text-[13px] leading-snug">
                  <span className="font-medium">{users[a.actorId]?.name.split(' ')[0]}</span> <span className="text-muted">{a.text}</span>
                  <span className="block text-[11.5px] text-faint">
                    {boards[a.boardId]?.icon} {boards[a.boardId]?.name} · {formatDistanceToNow(a.at, { addSuffix: true })}
                  </span>
                </span>
              </button>
            ))}
            {!recent.length && <p className="p-4 text-[13px] text-muted">Changes your team makes show up here.</p>}
          </div>
        </aside>
      </div>
      <TemplateModal workspaceId={creating ? ws?.id ?? null : null} onClose={() => setCreating(false)} />
    </div>
  )
}

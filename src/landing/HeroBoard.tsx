import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from 'motion/react'
import { Plus, Search, Zap } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Logo, cx } from '../components/ui'
import { C, Face, PEOPLE, type Person } from './shared'

const STATUS = {
  todo: { label: 'Not started', color: C.slate },
  wip: { label: 'Working on it', color: C.orange },
  stuck: { label: 'Stuck', color: C.red },
  done: { label: 'Done', color: C.green },
} as const
type Status = keyof typeof STATUS
const PRIO = { High: C.violet, Medium: C.sky, Low: C.teal } as const

type Row = { id: string; name: string; owner: Person; status: Status; prio: keyof typeof PRIO; tl: [number, number]; group: 'sprint' | 'shipped' }

const BASE: Row[] = [
  { id: 'api', name: 'Realtime sync API', owner: PEOPLE.maya, status: 'wip', prio: 'High', tl: [6, 46], group: 'sprint' },
  { id: 'onb', name: 'Onboarding checklist', owner: PEOPLE.leo, status: 'wip', prio: 'Medium', tl: [28, 34], group: 'sprint' },
  { id: 'bill', name: 'Billing page polish', owner: PEOPLE.ines, status: 'stuck', prio: 'High', tl: [40, 28], group: 'sprint' },
  { id: 'docs', name: 'Self-host guide', owner: PEOPLE.sam, status: 'todo', prio: 'Low', tl: [60, 34], group: 'sprint' },
  { id: 'tok', name: 'Design tokens v2', owner: PEOPLE.maya, status: 'done', prio: 'Medium', tl: [0, 26], group: 'shipped' },
]

const STEPS = 8
const STEP_MS = 1500

/** The scripted story: a status flips to Done, an automation files the item, a timeline bar is dragged, a blocker clears. */
function rowsAt(step: number): Row[] {
  const on = (from: number) => step >= from && step < 7
  return BASE.map((r) => {
    if (r.id === 'onb') return { ...r, status: on(1) ? 'done' : r.status, group: on(2) ? 'shipped' : r.group }
    if (r.id === 'bill') return { ...r, status: on(5) ? 'wip' : r.status, tl: [r.tl[0] + (on(4) ? 18 : 0), r.tl[1]] }
    return r
  })
}

type Target = { key: string; fx: number } | null
function targetAt(step: number, rows: Row[]): Target {
  const bill = rows.find((r) => r.id === 'bill')!
  const barMid = (bill.tl[0] + bill.tl[1] / 2) / 100
  switch (step) {
    case 0:
    case 1:
      return { key: 'onb:status', fx: 0.5 }
    case 3:
    case 4:
      return { key: 'bill:tl', fx: barMid }
    case 5:
    case 6:
      return { key: 'bill:status', fx: 0.5 }
    case 7:
      return { key: 'new', fx: 0.5 }
    default:
      return null
  }
}

export function HeroBoard() {
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const inView = useInView(root, { margin: '-10% 0px' })
  const [step, setStep] = useState(0)
  const els = useRef<Record<string, HTMLElement | null>>({})
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (reduce || !inView) return
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS), STEP_MS)
    return () => clearInterval(t)
  }, [reduce, inView])

  const rows = rowsAt(reduce ? 0 : step)
  const target = targetAt(step, rows)

  useLayoutEffect(() => {
    const el = target && els.current[target.key]
    const box = root.current?.getBoundingClientRect()
    if (!el || !box) return
    const r = el.getBoundingClientRect()
    setCursor({ x: r.left - box.left + r.width * target.fx, y: r.top - box.top + r.height * 0.55 })
  }, [step])

  const ref = (key: string) => (el: HTMLElement | null) => {
    els.current[key] = el
  }
  const clicking = step === 1 || step === 5

  return (
    <div
      ref={root}
      className="relative overflow-hidden rounded-[22px] border border-line bg-panel text-left shadow-[0_1px_2px_rgb(15_18_40/0.06),0_40px_80px_-30px_rgb(40_40_120/0.35)] dark:shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)]"
      role="img"
      aria-label="Tideline board preview: a product roadmap where a teammate marks an item Done, an automation moves it to the Shipped group, and a timeline bar is dragged to a new date."
    >
      {/* App header */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
        <Logo size={22} />
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-semibold tracking-tight">Product roadmap</div>
        </div>
        <div className="ml-2 hidden items-center gap-1 rounded-lg bg-panel-2 p-0.5 text-[12px] md:flex">
          {['Table', 'Kanban', 'Timeline', 'Calendar', 'Dashboard'].map((v, i) => (
            <span key={v} className={cx('rounded-md px-2.5 py-1', i === 0 ? 'bg-panel font-medium text-fg shadow-card' : 'text-muted')}>
              {v}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-[12px] text-muted sm:flex">
            <span className="flex -space-x-1.5">
              <Face p={PEOPLE.maya} ring />
              <Face p={PEOPLE.leo} ring />
              <Face p={PEOPLE.ines} ring />
            </span>
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#00b884] opacity-60" />
              <span className="relative size-2 rounded-full bg-[#00b884]" />
            </span>
            3 here now
          </span>
          <span className="hidden size-8 place-items-center rounded-lg border border-line text-muted sm:grid">
            <Search size={15} />
          </span>
          <span ref={ref('new')} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white">
            <Plus size={14} /> New item
          </span>
        </div>
      </div>

      {/* Column header */}
      <div className="px-3 pt-4 pb-3 sm:px-5">
        <LayoutGroup>
          {(['sprint', 'shipped'] as const).map((g) => (
            <Group key={g} title={g === 'sprint' ? 'This sprint' : 'Shipped'} color={g === 'sprint' ? C.indigo : C.green}>
              {rows
                .filter((r) => r.group === g)
                .map((r) => (
                  <motion.div
                    key={r.id}
                    layout="position"
                    layoutId={r.id}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="grid grid-cols-[1fr_36px_118px] items-stretch border-t border-line text-[13px] sm:grid-cols-[1fr_44px_118px_82px_minmax(120px,170px)]"
                  >
                    <div className="flex min-w-0 items-center gap-2 py-2 pr-2 pl-3">
                      <span className="truncate">{r.name}</span>
                    </div>
                    <div className="grid place-items-center border-l border-line">
                      <Face p={r.owner} />
                    </div>
                    <div ref={ref(`${r.id}:status`)} className="border-l border-line p-[3px]">
                      <motion.span
                        className="grid h-full min-h-[28px] place-items-center rounded-[5px] px-1 text-[11.5px] font-medium text-white"
                        animate={{ backgroundColor: STATUS[r.status].color }}
                        transition={{ duration: 0.35 }}
                      >
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span key={r.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                            {STATUS[r.status].label}
                          </motion.span>
                        </AnimatePresence>
                      </motion.span>
                    </div>
                    <div className="hidden items-center gap-1.5 border-l border-line px-2.5 text-[12px] text-muted sm:flex">
                      <span className="size-2 rounded-full" style={{ background: PRIO[r.prio] }} />
                      {r.prio}
                    </div>
                    <div className="hidden items-center border-l border-line px-2.5 sm:flex">
                      <div ref={ref(`${r.id}:tl`)} className="relative h-5 w-full rounded-full bg-panel-2">
                        <motion.span
                          className="absolute inset-y-0 rounded-full"
                          style={{ width: `${r.tl[1]}%`, background: `linear-gradient(90deg, ${STATUS[r.status].color}, color-mix(in oklab, ${STATUS[r.status].color} 70%, #fff))` }}
                          animate={{ left: `${r.tl[0]}%` }}
                          transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
            </Group>
          ))}
        </LayoutGroup>
      </div>

      {/* Automation toast */}
      <AnimatePresence>
        {!reduce && step >= 2 && step <= 4 && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-4 bottom-4 flex max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2 text-[12.5px] shadow-pop"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
              <Zap size={13} />
            </span>
            <span className="truncate">
              Automation moved <b className="font-medium">Onboarding checklist</b> to Shipped
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cursors */}
      {!reduce && (
        <>
          <motion.div
            className="pointer-events-none absolute top-0 left-0 z-10 hidden sm:block"
            animate={{ x: cursor.x, y: cursor.y, opacity: target ? 1 : 0.85 }}
            transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.9 }}
          >
            <AnimatePresence>
              {clicking && (
                <motion.span
                  key={step}
                  className="absolute -top-3 -left-3 size-6 rounded-full border-2 border-accent"
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
              )}
            </AnimatePresence>
            <Cursor person={PEOPLE.maya} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute z-10 hidden md:block"
            initial={{ left: '72%', top: '78%' }}
            animate={{ left: ['72%', '58%', '64%', '80%', '72%'], top: ['78%', '62%', '86%', '70%', '78%'] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Cursor person={PEOPLE.leo} />
          </motion.div>
        </>
      )}
    </div>
  )
}

function Group({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-1">
      <div className="mb-1.5 flex items-center gap-2 pl-1 font-display text-[14px] font-semibold" style={{ color }}>
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
        {title}
      </div>
      <div className="overflow-hidden rounded-lg border border-line border-l-[3px] bg-panel [&>*:first-child]:border-t-0" style={{ borderLeftColor: color }}>
        <div className="grid grid-cols-[1fr_36px_118px] text-[11.5px] text-faint sm:grid-cols-[1fr_44px_118px_82px_minmax(120px,170px)]">
          <span className="py-1.5 pl-3">Item</span>
          <span className="border-l border-line py-1.5 text-center">Owner</span>
          <span className="border-l border-line py-1.5 text-center">Status</span>
          <span className="hidden border-l border-line py-1.5 pl-2.5 sm:block">Priority</span>
          <span className="hidden border-l border-line py-1.5 pl-2.5 sm:block">Timeline</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function Cursor({ person }: { person: Person }) {
  return (
    <div className="flex items-start">
      <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden className="drop-shadow-[0_2px_3px_rgb(0_0_0/0.25)]">
        <path d="M2 1.5l13.5 8.2-6.1 1.3L6 17.4 2 1.5z" fill={person.color} stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="mt-3.5 -ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white" style={{ background: person.color }}>
        {person.name.split(' ')[0]}
      </span>
    </div>
  )
}

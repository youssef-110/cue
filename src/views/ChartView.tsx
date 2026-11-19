import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { AlarmClock, ChartPie, CircleCheck, LayoutDashboard, ListChecks, Sigma } from 'lucide-react'
import { labelOf, useStore } from '../lib/store'
import { today } from '../lib/seed'
import type { Board, Column, Item, View } from '../lib/types'
import { Avatar, cx } from '../components/ui'
import { fmtNumber } from '../components/cells'
import { ColumnPicker, EmptyView } from './KanbanView'
import { inkOn } from './TimelineView'

const NONE = '__none'
type Bucket = { id: string; name: string; color: string }

// SVG presentation attributes can't take var(), so chart chrome reads the live theme tokens.
const TOKENS = ['--panel', '--line', '--hover', '--muted', '--faint', '--fg', '--accent'] as const
type Tokens = Record<(typeof TOKENS)[number], string>
const LIGHT: Tokens = { '--panel': '#fff', '--line': '#e4e6ef', '--hover': '#eceef6', '--muted': '#5d6378', '--faint': '#9aa0b4', '--fg': '#171a2b', '--accent': '#5b5bf0' }
function useTokens() {
  const theme = useStore((s) => s.theme)
  const [t, setT] = useState(LIGHT)
  useEffect(() => {
    // next frame: the theme class is toggled in a parent effect that runs after ours
    const id = requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement)
      setT(Object.fromEntries(TOKENS.map((k) => [k, cs.getPropertyValue(k).trim() || LIGHT[k]])) as Tokens)
    })
    return () => cancelAnimationFrame(id)
  }, [theme])
  return t
}

function CountUp({ value, format = (n) => Math.round(n).toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  useEffect(() => {
    const c = animate(from.current, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        from.current = v
        if (ref.current) ref.current.textContent = format(v)
      },
    })
    return () => c.stop()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{format(0)}</span>
}

function Card({ i, title, icon, aside, className, children }: { i: number; title: string; icon?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.04 * i, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx('flex min-w-0 flex-col rounded-2xl border border-line bg-panel p-4 shadow-card', className)}
    >
      <header className="mb-3 flex min-h-7 items-center gap-2">
        {icon && <span className="text-faint [&>svg]:size-4">{icon}</span>}
        <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
        <span className="flex-1" />
        {aside}
      </header>
      {children}
    </motion.section>
  )
}

function Kpi({ i, label, value, format, sub, icon, children }: { i: number; label: string; value: number; format?: (n: number) => string; sub?: ReactNode; icon: ReactNode; children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * i, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex min-w-0 flex-col rounded-2xl border border-line bg-panel p-4 shadow-card"
    >
      <span className="flex items-center gap-1.5 text-[12.5px] text-muted [&>svg]:size-3.5 [&>svg]:text-faint">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="mt-1.5 truncate text-[28px] leading-tight font-semibold tracking-tight text-fg">
        <CountUp value={value} format={format} />
      </span>
      {sub && <span className="mt-0.5 truncate text-[12px] text-faint">{sub}</span>}
      {children}
    </motion.div>
  )
}

/** Legend: swatch + name (+ count), always present next to multi-series marks. */
function Legend({ buckets, counts }: { buckets: Bucket[]; counts?: Map<string, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {buckets.map((b) => (
        <li key={b.id} className="flex items-center gap-1.5 text-[12px] text-muted">
          <span className="size-2.5 rounded-[3px]" style={{ background: b.color }} />
          {b.name}
          {counts && <span className="font-mono text-faint tabular-nums">{counts.get(b.id) ?? 0}</span>}
        </li>
      ))}
    </ul>
  )
}

/** One whole split into parts: tall segmented bar with shares printed where they fit. */
function Battery({ buckets, counts, total }: { buckets: Bucket[]; counts: Map<string, number>; total: number }) {
  const [tip, setTip] = useState<string | null>(null)
  const parts = buckets.filter((b) => (counts.get(b.id) ?? 0) > 0)
  return (
    <div className="flex h-7 gap-[2px]" role="img" aria-label={parts.map((b) => `${b.name} ${counts.get(b.id)}`).join(', ')}>
      {total === 0 && <div className="flex-1 rounded-[4px] bg-panel-2" />}
      {parts.map((b, idx) => {
        const n = counts.get(b.id)!
        const pct = (n / total) * 100
        return (
          <motion.div
            key={b.id}
            tabIndex={0}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: 0.15 + idx * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
            onPointerEnter={() => setTip(b.id)}
            onPointerLeave={() => setTip(null)}
            onFocus={() => setTip(b.id)}
            onBlur={() => setTip(null)}
            className="relative min-w-[3px] rounded-[4px] outline-offset-1 transition-[filter] hover:brightness-110"
            style={{ background: b.color }}
          >
            {pct >= 9 && (
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center font-mono text-[11px] font-medium tabular-nums" style={{ color: inkOn(b.color) }}>
                {Math.round(pct)}%
              </span>
            )}
            {tip === b.id && (
              <TipBox className="absolute bottom-full left-0 z-10 mb-2">
                <TipRow color={b.color} value={`${n} · ${Math.round(pct)}%`} name={b.name} />
              </TipBox>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function TipBox({ title, className, children }: { title?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx('pointer-events-none min-w-32 rounded-lg border border-line bg-panel px-2.5 py-2 whitespace-nowrap shadow-pop', className)}>
      {title && <div className="mb-1 text-[11.5px] text-muted">{title}</div>}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}
function TipRow({ color, value, name }: { color: string; value: ReactNode; name: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="h-[2px] w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="font-semibold text-fg tabular-nums">{value}</span>
      <span className="text-muted">{name}</span>
    </div>
  )
}
function chartTip(fmt: (v: number) => string = String) {
  return ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    const rows = (payload ?? []).filter((p) => Number(p.value) > 0)
    if (!active || !rows.length) return null
    return (
      <TipBox title={label}>
        {rows
          .slice()
          .reverse()
          .map((p) => (
            <TipRow key={String(p.dataKey)} color={(p.payload?.fill as string) ?? p.color ?? ''} value={fmt(Number(p.value))} name={String(p.name)} />
          ))}
      </TipBox>
    )
  }
}

export function ChartView({ board, items, view }: { board: Board; items: Item[]; view: View }) {
  const users = useStore((s) => s.user)
  const tk = useTokens()
  const [numId, setNumId] = useState<string>()

  const labelCols = board.columns.filter((c) => c.type === 'status' || c.type === 'priority')
  const statusCols = board.columns.filter((c) => c.type === 'status')
  const col = labelCols.find((c) => c.id === view.columnId) ?? statusCols[0] ?? labelCols[0]
  const doneCol = col?.labels?.some((l) => l.done) ? col : statusCols.find((c) => c.labels?.some((l) => l.done))
  const people = board.columns.find((c) => c.type === 'people')
  const dueCol = board.columns.find((c) => c.type === 'date') ?? board.columns.find((c) => c.type === 'timeline')
  const numCols = board.columns.filter((c) => c.type === 'number')
  const numCol = numCols.find((c) => c.id === numId) ?? numCols[0]

  if (!items.length)
    return (
      <EmptyView icon={<LayoutDashboard />} title="Nothing to chart yet">
        Add items to this board, or loosen the filters, and the dashboard fills in on its own.
      </EmptyView>
    )

  const bucketsOf = (c?: Column): Bucket[] => [...(c?.labels ?? []), { id: NONE, name: c ? `No ${c.title.toLowerCase()}` : 'No status', color: tk['--faint'] }]
  const keyOf = (c: Column | undefined, it: Item) => (c && labelOf(c, it.values[c.id])?.id) ?? NONE
  const countBy = (c: Column | undefined, list: Item[]) => {
    const m = new Map<string, number>()
    list.forEach((it) => m.set(keyOf(c, it), (m.get(keyOf(c, it)) ?? 0) + 1))
    return m
  }

  // ---------- KPIs ----------
  const t = today()
  const isDone = (it: Item) => !!(doneCol && labelOf(doneCol, it.values[doneCol.id])?.done)
  const endOf = (it: Item) => {
    const v = dueCol && it.values[dueCol.id]
    return typeof v === 'string' ? v : (v as { end?: string } | undefined)?.end
  }
  const doneN = items.filter(isDone).length
  const overdueN = items.filter((it) => !isDone(it) && (endOf(it) ?? t) < t).length
  const donePct = (doneN / items.length) * 100
  const sumOf = (c: Column, list: Item[]) => list.reduce((a, it) => a + (Number(it.values[c.id]) || 0), 0)

  // ---------- by label ----------
  const buckets = bucketsOf(col)
  const counts = countBy(col, items)
  const shown = buckets.filter((b) => counts.get(b.id))
  const pie = shown.map((b) => ({ id: b.id, name: b.name, value: counts.get(b.id)!, fill: b.color }))

  // ---------- workload ----------
  const load = new Map<string, Item[]>()
  if (people)
    items.forEach((it) => {
      const ids = (it.values[people.id] as string[] | undefined)?.filter((u) => users[u]) ?? []
      ;(ids.length ? ids : [NONE]).forEach((u) => load.set(u, [...(load.get(u) ?? []), it]))
    })
  const loadRows = [...load.entries()].sort((a, b) => (a[0] === NONE ? 1 : b[0] === NONE ? -1 : b[1].length - a[1].length))
  const maxLoad = Math.max(1, ...loadRows.map(([, l]) => l.length))

  // ---------- per group ----------
  const groups = board.groups.map((g) => ({ g, list: items.filter((i) => i.groupId === g.id) })).filter((x) => x.list.length)
  const groupData = groups.map(({ g, list }) => ({ name: g.title, ...Object.fromEntries(countBy(col, list)) }))
  const stackKeys = shown.map((b) => b.id)
  const numData = numCol ? groups.map(({ g, list }) => ({ name: g.title, value: sumOf(numCol, list), fill: g.color })) : []

  const axis = { fontSize: 11.5, fill: tk['--muted'] }
  const tickFmt = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString())
  let card = 0

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-5 pt-4 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
          <p className="text-[12.5px] text-muted">
            <span className="font-medium text-fg tabular-nums">{items.length}</span> items across <span className="font-medium text-fg tabular-nums">{groups.length}</span>{' '}
            {groups.length === 1 ? 'group' : 'groups'}
          </p>
          {labelCols.length > 0 && <ColumnPicker board={board} view={view} columns={labelCols} current={col} label="Chart by" />}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          <Kpi i={card++} icon={<ListChecks />} label="Total items" value={items.length} sub={`${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`} />
          <Kpi i={card++} icon={<CircleCheck />} label="Done" value={donePct} format={(n) => `${Math.round(n)}%`} sub={doneCol ? `${doneN} of ${items.length} by ${doneCol.title}` : 'No “done” label yet'}>
            <span className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, var(--accent) 16%, transparent)` }}>
              <motion.span className="block h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${donePct}%` }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
            </span>
          </Kpi>
          <Kpi
            i={card++}
            icon={<AlarmClock />}
            label="Overdue"
            value={overdueN}
            sub={dueCol ? (overdueN ? <span className="text-red-500">past {dueCol.title.toLowerCase()} and not done</span> : `nothing past ${dueCol.title.toLowerCase()}`) : 'No date column'}
          />
          {numCols.map((c) => (
            <Kpi key={c.id} i={card++} icon={<Sigma />} label={c.title} value={sumOf(c, items)} format={(n) => fmtNumber(Math.round(n), c.unit)} sub="total" />
          ))}
        </div>

        {/* battery per status column */}
        {statusCols.length > 0 && (
          <Card i={card++} title="Progress" icon={<CircleCheck />}>
            <div className="flex flex-col gap-5">
              {statusCols.map((c) => {
                const m = countBy(c, items)
                const bs = bucketsOf(c).filter((b) => m.get(b.id))
                return (
                  <div key={c.id} className="flex flex-col gap-2">
                    {statusCols.length > 1 && <span className="text-[12px] font-medium text-muted">{c.title}</span>}
                    <Battery buckets={bs} counts={m} total={items.length} />
                    <Legend buckets={bs} counts={m} />
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {/* donut */}
          <Card i={card++} title={`Items by ${col?.title.toLowerCase() ?? 'status'}`} icon={<ChartPie />}>
            <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row">
              <div className="relative size-[210px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={66} outerRadius={98} cornerRadius={4} paddingAngle={0} stroke={tk['--panel']} strokeWidth={2} startAngle={90} endAngle={-270} animationDuration={800}>
                      {pie.map((p) => (
                        <Cell key={p.id} fill={p.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={chartTip()} wrapperStyle={{ zIndex: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <span>
                    <span className="block text-[26px] leading-none font-semibold text-fg">
                      <CountUp value={items.length} />
                    </span>
                    <span className="text-[11.5px] text-muted">items</span>
                  </span>
                </div>
              </div>
              <ul className="flex w-full min-w-0 flex-col gap-1.5">
                {shown.map((b) => {
                  const n = counts.get(b.id)!
                  return (
                    <li key={b.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12.5px] hover:bg-hover">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: b.color }} />
                      <span className="flex-1 truncate text-fg">{b.name}</span>
                      <span className="font-mono text-muted tabular-nums">{n}</span>
                      <span className="w-10 text-right font-mono text-faint tabular-nums">{Math.round((n / items.length) * 100)}%</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Card>

          {/* workload */}
          <Card i={card++} title={people ? `Workload by ${people.title.toLowerCase()}` : 'Workload'} icon={<ListChecks />}>
            {people ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2.5">
                  {loadRows.map(([uid, list], idx) => {
                    const m = countBy(col, list)
                    const user = users[uid]
                    return (
                      <div key={uid} className="flex items-center gap-3">
                        <span className="flex w-36 shrink-0 items-center gap-2">
                          {user ? <Avatar user={user} size={22} /> : <span className="size-[22px] shrink-0 rounded-full border border-dashed border-line-strong" />}
                          <span className={cx('truncate text-[12.5px]', user ? 'text-fg' : 'text-muted')}>{user?.name ?? 'Unassigned'}</span>
                        </span>
                        <span className="flex h-5 min-w-0 flex-1">
                          <motion.span
                            className="flex h-full gap-[2px]"
                            initial={{ width: 0 }}
                            animate={{ width: `${(list.length / maxLoad) * 100}%` }}
                            transition={{ duration: 0.7, delay: 0.2 + idx * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
                          >
                            {shown
                              .filter((b) => m.get(b.id))
                              .map((b, j, arr) => (
                                <span
                                  key={b.id}
                                  title={`${b.name}: ${m.get(b.id)}`}
                                  className={cx('h-full min-w-[3px] transition-[filter] hover:brightness-110', j === arr.length - 1 && 'rounded-r-[4px]')}
                                  style={{ flexGrow: m.get(b.id), flexBasis: 0, background: b.color }}
                                />
                              ))}
                          </motion.span>
                          <span className="ml-2 self-center font-mono text-[12px] text-muted tabular-nums">{list.length}</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Legend buckets={shown} />
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-muted">Add a people column to see who carries the load.</p>
            )}
          </Card>

          {/* per group, stacked by label */}
          <Card i={card++} title={`Groups by ${col?.title.toLowerCase() ?? 'status'}`} icon={<LayoutDashboard />} className={numCol ? undefined : 'lg:col-span-2'}>
            <div className="h-[240px]">
              <ResponsiveContainer>
                <BarChart data={groupData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke={tk['--line']} />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={44} />
                  <Tooltip content={chartTip()} cursor={{ fill: tk['--hover'], opacity: 0.6 }} />
                  {stackKeys.map((k, i) => {
                    const b = shown[i]
                    return <Bar key={k} dataKey={k} name={b.name} stackId="s" fill={b.color} stroke={tk['--panel']} strokeWidth={2} maxBarSize={28} radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : 0} animationDuration={700} />
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3">
              <Legend buckets={shown} />
            </div>
          </Card>

          {/* number sum per group */}
          {numCol && (
            <Card
              i={card++}
              title={`${numCol.title} by group`}
              icon={<Sigma />}
              aside={
                numCols.length > 1 && (
                  <div className="flex rounded-lg border border-line p-0.5">
                    {numCols.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setNumId(c.id)}
                        className={cx('h-6 rounded-md px-2 text-[12px] transition-colors', c.id === numCol.id ? 'bg-panel-2 font-medium text-fg' : 'text-muted hover:text-fg')}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                )
              }
            >
              <div className="h-[240px]">
                <ResponsiveContainer>
                  <BarChart data={numData} margin={{ top: 22, right: 4, bottom: 0, left: -6 }}>
                    <CartesianGrid vertical={false} stroke={tk['--line']} />
                    <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={axis} axisLine={false} tickLine={false} width={52} tickFormatter={tickFmt} />
                    <Tooltip content={chartTip((v) => fmtNumber(v, numCol.unit))} cursor={{ fill: tk['--hover'], opacity: 0.6 }} />
                    <Bar dataKey="value" name={numCol.title} maxBarSize={28} radius={[4, 4, 0, 0]} animationDuration={700}>
                      {numData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                      <LabelList
                        dataKey="value"
                        content={(l) => (
                          <text x={Number(l.x) + Number(l.width) / 2} y={Number(l.y) - 6} textAnchor="middle" fontSize={11.5} fill={tk['--muted']}>
                            {fmtNumber(Number(l.value), numCol.unit)}
                          </text>
                        )}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

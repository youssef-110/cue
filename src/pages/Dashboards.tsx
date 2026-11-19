import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, Check, LayoutDashboard, Plus, Settings2, Trash2, X } from 'lucide-react'
import { isLive, labelOf, navigate, openItem, put, remove, useCanEdit, useStore, visibleItem } from '../lib/store'
import { COLORS, today, uid } from '../lib/seed'
import type { Board, Dashboard, Item, Widget, WidgetType } from '../lib/types'
import { Button, EditableText, MenuItem, Popover, cx } from '../components/ui'
import { DueTime } from '../components/departure'

const WIDGETS: { type: WidgetType; label: string; make: () => Partial<Widget> }[] = [
  { type: 'number', label: 'Number', make: () => ({ agg: 'count' }) },
  { type: 'battery', label: 'Status battery', make: () => ({}) },
  { type: 'chart', label: 'Chart', make: () => ({ chart: 'bar', by: 'status' }) },
  { type: 'workload', label: 'Workload summary', make: () => ({}) },
  { type: 'overdue', label: 'Overdue items', make: () => ({}) },
]
const GREY = COLORS.slate
const sel = 'h-8 rounded-md border border-line bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent'

const tip = { background: 'var(--panel)', border: '1px solid var(--line-strong)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg)' }

const saveDash = (d: Dashboard, patch: Partial<Dashboard>) => put('dashboard', { ...d, ...patch })

/** Rows across the dashboard's boards. Columns differ per board, so they are matched by type / title. */
type Row = { item: Item; board: Board; status?: { name: string; color: string; done?: boolean }; people: string[]; due?: string }
function rowsOf(boards: Board[], items: Record<string, Item>, allBoards: Record<string, Board>): Row[] {
  const ids = new Set(boards.map((b) => b.id))
  return Object.values(items)
    .filter((i) => ids.has(i.boardId) && !i.parentId && visibleItem(i, allBoards, items))
    .map((item) => {
      const board = allBoards[item.boardId]
      const st = board.columns.find((c) => c.type === 'status')
      const people = board.columns.filter((c) => c.type === 'people').flatMap((c) => (item.values[c.id] as string[]) ?? [])
      let due: string | undefined
      for (const c of board.columns) {
        const v = item.values[c.id]
        if (c.type === 'date' && typeof v === 'string') due ??= v
        if (c.type === 'timeline' && v && typeof v === 'object') due ??= (v as { end: string }).end
      }
      return { item, board, status: labelOf(st, st && item.values[st.id]), people, due }
    })
}

export function Dashboards({ id }: { id?: string }) {
  const dashes = useStore((s) => s.dashboard)
  const meId = useStore((s) => s.meId)
  const editable = useCanEdit()
  const list = Object.values(dashes).sort((a, b) => a.order - b.order)
  const dash = (id && dashes[id]) || list[0]
  const create = () => {
    const boardIds = Object.values(useStore.getState().board).filter(isLive).map((b) => b.id)
    const d: Dashboard = {
      id: uid('db_'),
      name: 'New dashboard',
      boardIds,
      createdBy: meId,
      order: Date.now(),
      widgets: [
        { id: uid('w_'), type: 'number', title: 'Items', agg: 'count' },
        { id: uid('w_'), type: 'battery', title: 'Status' },
        { id: uid('w_'), type: 'chart', title: 'By person', chart: 'bar', by: 'person' },
        { id: uid('w_'), type: 'overdue', title: 'Overdue' },
      ],
    }
    put('dashboard', d)
    navigate({ page: 'dashboards', id: d.id })
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="caps text-[34px] font-bold leading-none">Dashboards</h1>
            <p className="mt-2 text-[14px] text-muted">Numbers and charts across several boards.</p>
          </div>
          {editable && (
            <Button variant="primary" onClick={create}>
              <Plus /> New dashboard
            </Button>
          )}
        </div>
        {list.length > 1 && (
          <div role="tablist" className="mb-5 flex flex-wrap gap-1 border-b border-line">
            {list.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={d.id === dash?.id}
                onClick={() => navigate({ page: 'dashboards', id: d.id })}
                className={cx('caps -mb-px h-10 border-b-2 px-3 text-[14px] font-semibold tracking-[0.1em]', d.id === dash?.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg')}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
        {dash ? (
          <DashboardBody key={dash.id} dash={dash} />
        ) : (
          <div className="rounded-lg border border-line bg-panel px-6 py-10">
            <LayoutDashboard className="mb-3 size-7 text-faint" />
            <p className="caps text-[19px] font-bold">No dashboards yet</p>
            <p className="mt-1 text-[14px] text-muted">{editable ? 'Create one to track work across boards.' : 'Ask an editor to create one.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DashboardBody({ dash }: { dash: Dashboard }) {
  const allBoards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const editable = useCanEdit()
  const boards = useMemo(() => dash.boardIds.map((id) => allBoards[id]).filter(isLive), [dash.boardIds, allBoards])
  const rows = useMemo(() => rowsOf(boards, items, allBoards), [boards, items, allBoards])
  const addRef = useRef<HTMLButtonElement>(null)
  const boardsRef = useRef<HTMLButtonElement>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [boardsOpen, setBoardsOpen] = useState(false)
  const setWidgets = (widgets: Widget[]) => saveDash(dash, { widgets })
  const move = (i: number, d: number) => {
    const w = [...dash.widgets]
    const [x] = w.splice(i, 1)
    w.splice(i + d, 0, x)
    setWidgets(w)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {editable ? (
          <EditableText value={dash.name} onCommit={(name) => saveDash(dash, { name })} className="caps text-[22px] font-bold" />
        ) : (
          <span className="caps text-[22px] font-bold">{dash.name}</span>
        )}
        <span className="flex-1" />
        <Button ref={boardsRef} variant="outline" onClick={() => setBoardsOpen(true)} disabled={!editable}>
          {boards.length} board{boards.length === 1 ? '' : 's'}
        </Button>
        {editable && (
          <>
            <Button ref={addRef} variant="primary" onClick={() => setAddOpen(true)}>
              <Plus /> Add widget
            </Button>
            <button
              onClick={() => (remove('dashboard', dash.id), navigate({ page: 'dashboards' }))}
              aria-label="Delete dashboard"
              title="Delete dashboard"
              className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-alert-soft hover:text-alert"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        <Popover anchor={boardsRef.current} open={boardsOpen} onClose={() => setBoardsOpen(false)} width={260} align="end">
          <div className="caps px-2.5 pb-1 pt-1.5 text-[12px] font-semibold tracking-[0.12em] text-faint">Boards on this dashboard</div>
          {Object.values(allBoards)
            .filter(isLive)
            .map((b) => {
              const on = dash.boardIds.includes(b.id)
              return (
                <MenuItem key={b.id} active={on} icon={on ? <Check /> : <span />} onClick={() => saveDash(dash, { boardIds: on ? dash.boardIds.filter((x) => x !== b.id) : [...dash.boardIds, b.id] })}>
                  {b.name}
                </MenuItem>
              )
            })}
        </Popover>
        <Popover anchor={addRef.current} open={addOpen} onClose={() => setAddOpen(false)} width={220} align="end">
          {WIDGETS.map((w) => (
            <MenuItem key={w.type} onClick={() => (setWidgets([...dash.widgets, { id: uid('w_'), type: w.type, title: w.label, ...w.make() }]), setAddOpen(false))}>
              {w.label}
            </MenuItem>
          ))}
        </Popover>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {dash.widgets.map((w, i) => (
          <WidgetCard
            key={w.id}
            widget={w}
            boards={boards}
            rows={rows}
            editable={editable}
            onChange={(p) => setWidgets(dash.widgets.map((x) => (x.id === w.id ? { ...x, ...p } : x)))}
            onRemove={() => setWidgets(dash.widgets.filter((x) => x.id !== w.id))}
            onMove={(d) => move(i, d)}
            first={i === 0}
            last={i === dash.widgets.length - 1}
          />
        ))}
        {!dash.widgets.length && <p className="text-[13px] text-muted">No widgets. Add one to get started.</p>}
      </div>
    </>
  )
}

function WidgetCard({
  widget: w, boards, rows, editable, onChange, onRemove, onMove, first, last,
}: {
  widget: Widget
  boards: Board[]
  rows: Row[]
  editable: boolean
  onChange: (p: Partial<Widget>) => void
  onRemove: () => void
  onMove: (d: number) => void
  first: boolean
  last: boolean
}) {
  const [settings, setSettings] = useState(false)
  const numberTitles = [...new Set(boards.flatMap((b) => b.columns.filter((c) => c.type === 'number').map((c) => c.title)))]
  const labelNames = [...new Set(boards.flatMap((b) => b.columns.filter((c) => c.type === 'status').flatMap((c) => c.labels?.map((l) => l.name) ?? [])))]
  const icon = 'grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-fg disabled:opacity-30'
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-line bg-panel">
      <header className="flex h-11 items-center gap-1 border-b-2 border-fg px-4">
        {editable ? (
          <EditableText value={w.title ?? ''} placeholder="Untitled" onCommit={(title) => onChange({ title })} className="caps text-[15px] font-bold tracking-[0.1em]" />
        ) : (
          <h3 className="caps truncate text-[15px] font-bold tracking-[0.1em]">{w.title}</h3>
        )}
        <span className="flex-1" />
        {editable && (
          <>
            {(w.type === 'number' || w.type === 'chart') && (
              <button className={icon} aria-label="Widget settings" onClick={() => setSettings(!settings)}>
                <Settings2 className="size-4" />
              </button>
            )}
            <button className={icon} aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" />
            </button>
            <button className={icon} aria-label="Move down" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" />
            </button>
            <button className={icon} aria-label="Remove widget" onClick={onRemove}>
              <X className="size-4" />
            </button>
          </>
        )}
      </header>
      {settings && w.type === 'number' && (
        <div className="flex flex-wrap gap-2 border-b border-line bg-panel-2 px-4 py-2.5">
          <select aria-label="Aggregate" className={sel} value={w.agg ?? 'count'} onChange={(e) => onChange({ agg: e.target.value as Widget['agg'] })}>
            <option value="count">Count items</option>
            <option value="sum">Sum a number column</option>
          </select>
          {w.agg === 'sum' && (
            <select aria-label="Number column" className={sel} value={w.columnTitle ?? ''} onChange={(e) => onChange({ columnTitle: e.target.value })}>
              <option value="">Choose column…</option>
              {numberTitles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <select aria-label="Status filter" className={sel} value={w.labelName ?? ''} onChange={(e) => onChange({ labelName: e.target.value || undefined })}>
            <option value="">Any status</option>
            {labelNames.map((n) => <option key={n} value={n}>Status: {n}</option>)}
          </select>
        </div>
      )}
      {settings && w.type === 'chart' && (
        <div className="flex flex-wrap gap-2 border-b border-line bg-panel-2 px-4 py-2.5">
          <select aria-label="Chart type" className={sel} value={w.chart ?? 'bar'} onChange={(e) => onChange({ chart: e.target.value as Widget['chart'] })}>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
          </select>
          <select aria-label="Group by" className={sel} value={w.by ?? 'status'} onChange={(e) => onChange({ by: e.target.value as Widget['by'] })}>
            <option value="status">By status</option>
            <option value="person">By person</option>
          </select>
        </div>
      )}
      <div className="p-4">
        <WidgetBody w={w} rows={rows} />
      </div>
    </section>
  )
}

function WidgetBody({ w, rows }: { w: Widget; rows: Row[] }): ReactNode {
  const users = useStore((s) => s.user)
  const t = today()
  if (w.type === 'number') {
    const list = w.labelName ? rows.filter((r) => r.status?.name === w.labelName) : rows
    const value =
      w.agg === 'sum'
        ? list.reduce((s, r) => {
            const c = r.board.columns.find((x) => x.type === 'number' && x.title.toLowerCase() === (w.columnTitle ?? '').toLowerCase())
            return s + (c ? Number(r.item.values[c.id]) || 0 : 0)
          }, 0)
        : list.length
    return (
      <div>
        <div key={value} className="flap font-mono text-[40px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value.toLocaleString()}</div>
        <div className="mt-2 text-[13px] text-muted">
          {w.agg === 'sum' ? `Sum of ${w.columnTitle || '(choose a column)'}` : 'Items'}
          {w.labelName ? ` · status ${w.labelName}` : ''}
        </div>
      </div>
    )
  }
  if (w.type === 'battery' || w.type === 'chart') {
    const by = w.type === 'battery' ? 'status' : (w.by ?? 'status')
    const m = new Map<string, { name: string; value: number; color: string }>()
    for (const r of rows) {
      const keys = by === 'status' ? [r.status ? [r.status.name, r.status.color] : ['No status', GREY]] : r.people.length ? r.people.map((u) => [users[u]?.name ?? 'Someone', users[u]?.color ?? GREY]) : [['Unassigned', GREY]]
      for (const [name, color] of keys) m.set(name, { name, color, value: (m.get(name)?.value ?? 0) + 1 })
    }
    const data = [...m.values()].sort((a, b) => b.value - a.value)
    if (!data.length) return <p className="text-[13.5px] text-muted">No items on the selected boards.</p>
    if (w.type === 'battery') {
      const done = rows.filter((r) => r.status?.done).length
      return (
        <div>
          <div className="mb-2 font-mono text-[13px] tabular-nums text-muted">
            <b className="font-semibold text-fg">{Math.round((done / rows.length) * 100)}%</b> DONE · {rows.length} ITEMS
          </div>
          <div className="flex h-5 gap-px overflow-hidden rounded-sm bg-panel-2">
            {data.map((d) => <span key={d.name} title={`${d.name}: ${d.value}`} style={{ width: `${(d.value / rows.length) * 100}%`, background: d.color }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-1.5 text-[12.5px] text-muted">
                <span className="size-2.5 rounded-[1px]" style={{ background: d.color }} /> {d.name} <span className="font-mono tabular-nums text-fg">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    return (
      <div className="h-56 text-muted">
        <ResponsiveContainer width="100%" height="100%">
          {w.chart === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={1} stroke="var(--panel)" isAnimationActive={false}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tip} itemStyle={{ color: 'var(--fg)' }} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ left: -20, right: 8 }}>
              <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 12 }} interval={0} tickLine={false} axisLine={{ stroke: 'var(--fg)', strokeWidth: 1 }} />
              <YAxis allowDecimals={false} tick={{ fill: 'currentColor', fontSize: 11, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={tip} itemStyle={{ color: 'var(--fg)' }} />
              <Bar dataKey="value" name="Items" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )
  }
  if (w.type === 'workload') {
    const m = new Map<string, { open: number; overdue: number }>()
    for (const r of rows) {
      if (r.status?.done) continue
      for (const u of r.people) {
        const x = m.get(u) ?? { open: 0, overdue: 0 }
        x.open++
        if (r.due && r.due < t) x.overdue++
        m.set(u, x)
      }
    }
    const list = [...m.entries()].filter(([u]) => users[u]).sort((a, b) => b[1].open - a[1].open)
    const max = Math.max(1, ...list.map(([, x]) => x.open))
    if (!list.length) return <p className="text-[13.5px] text-muted">No open assigned items.</p>
    return (
      <ul className="space-y-3">
        {list.map(([u, x]) => (
          <li key={u} className="text-[13.5px]">
            <div className="flex justify-between">
              <span>{users[u].name}</span>
              <span className="font-mono text-[12px] tabular-nums text-muted">
                {x.open} OPEN{x.overdue ? <span className="text-alert"> · {x.overdue} LATE</span> : ''}
              </span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-sm bg-panel-2">
              <span style={{ width: `${((x.open - x.overdue) / max) * 100}%`, background: users[u].color }} />
              <span className="bg-alert" style={{ width: `${(x.overdue / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    )
  }
  const overdue = rows.filter((r) => r.due && r.due < t && !r.status?.done).sort((a, b) => a.due!.localeCompare(b.due!))
  if (!overdue.length) return <p className="text-[13.5px] text-muted">Nothing overdue.</p>
  return (
    <ul className="-mx-4 -my-2 max-h-80 overflow-y-auto">
      {overdue.map((r) => (
        <li key={r.item.id} className="border-b border-line last:border-b-0">
          <button onClick={() => (navigate({ page: 'board', boardId: r.board.id }), openItem(r.item.id))} className="grid w-full grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-left text-[13.5px] hover:bg-hover">
            <DueTime date={r.due} />
            <span className="min-w-0 truncate">{r.item.name}</span>
            <span className="max-w-[140px] shrink-0 truncate text-[12.5px] text-faint">{r.board.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

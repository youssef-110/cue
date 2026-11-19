import { useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { AlertCircle, Check, ExternalLink, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { addTeammate, labelOf, setValue, updateColumn, useStore } from '../lib/store'
import { COLOR_LIST, uid } from '../lib/seed'
import type { Board, Column, Item, Label } from '../lib/types'
import { Avatar, AvatarStack, Popover, cx } from './ui'

export type Range = { start: string; end: string }
export const fmtDate = (d?: string) => (d ? format(parseISO(d), 'MMM d') : '')
export const isDoneItem = (board: Board, item: Item) =>
  board.columns.some((c) => c.type === 'status' && labelOf(c, item.values[c.id])?.done)

/** Wrapper that turns a cell into a popover trigger. */
function PopCell({
  children,
  pop,
  width = 240,
  className,
}: {
  children: ReactNode
  pop: (close: () => void) => ReactNode
  width?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ref} onClick={() => setOpen((o) => !o)} className={cx('h-full w-full', className)}>
        {children}
      </button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={width} align="center">
        {pop(() => setOpen(false))}
      </Popover>
    </>
  )
}

// ---------- status / priority ----------
function LabelEditor({ board, col, onDone }: { board: Board; col: Column; onDone: () => void }) {
  const [labels, setLabels] = useState<Label[]>(col.labels ?? [])
  const save = () => (updateColumn(board.id, col.id, { labels: labels.filter((l) => l.name.trim()) }), onDone())
  return (
    <div className="space-y-1.5 p-1">
      {labels.map((l, i) => (
        <div key={l.id} className="flex items-center gap-1.5">
          <button
            title="Change color"
            className="size-5 shrink-0 rounded-md ring-1 ring-black/10"
            style={{ background: l.color }}
            onClick={() => setLabels(labels.map((x, j) => (j === i ? { ...x, color: COLOR_LIST[(COLOR_LIST.indexOf(x.color) + 1) % COLOR_LIST.length] } : x)))}
          />
          <input
            aria-label="Label name"
            value={l.name}
            onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-panel px-2 text-[13px] outline-none focus:border-accent"
          />
          {col.type === 'status' && (
            <button
              title="Counts as done"
              onClick={() => setLabels(labels.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={cx('grid size-7 place-items-center rounded-md', l.done ? 'bg-green-500/15 text-green-600' : 'text-faint hover:bg-hover')}
            >
              <Check className="size-3.5" />
            </button>
          )}
          <button title="Delete label" onClick={() => setLabels(labels.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-md text-faint hover:bg-hover hover:text-red-500">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => setLabels([...labels, { id: uid('l_'), name: 'New label', color: COLOR_LIST[labels.length % COLOR_LIST.length] }])}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-muted hover:bg-hover"
      >
        <Plus className="size-3.5" /> New label
      </button>
      <button onClick={save} className="h-8 w-full rounded-lg bg-accent text-[13px] font-medium text-white hover:brightness-110">
        Apply
      </button>
    </div>
  )
}

export function StatusCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const label = labelOf(col, item.values[col.id])
  const [editing, setEditing] = useState(false)
  return (
    <PopCell
      width={editing ? 280 : 200}
      pop={(close) =>
        editing ? (
          <LabelEditor board={board} col={col} onDone={() => (setEditing(false), close())} />
        ) : (
          <div className="grid gap-1 p-0.5">
            {col.labels?.map((l) => (
              <button
                key={l.id}
                onClick={() => (setValue(item.id, col.id, l.id), close())}
                className="label-fill h-8 rounded-md text-[13px] font-medium text-white"
                style={{ background: l.color }}
              >
                {l.name}
              </button>
            ))}
            <button onClick={() => (setValue(item.id, col.id, null), close())} className="h-8 rounded-md border border-dashed border-line-strong text-[13px] text-muted hover:bg-hover">
              Clear
            </button>
            <button onClick={() => setEditing(true)} className="mt-1 flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] text-muted hover:bg-hover">
              <Pencil className="size-3.5" /> Edit labels
            </button>
          </div>
        )
      }
    >
      <motion.span
        key={label?.id ?? 'none'}
        initial={{ opacity: 0.4, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={cx('label-fill relative grid h-full w-full place-items-center overflow-hidden px-2 text-[13px] font-medium', label ? 'text-white' : 'text-faint')}
        style={{ background: label?.color ?? 'transparent' }}
      >
        <span className="truncate">{label?.name ?? ''}</span>
        {label?.done && <span className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-white/20 to-transparent" />}
      </motion.span>
    </PopCell>
  )
}

// ---------- people ----------
export function PeoplePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const users = useStore((s) => s.user)
  const [q, setQ] = useState('')
  const list = Object.values(users).filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 rounded-lg border border-line px-2">
        <Search className="size-3.5 text-faint" />
        <input autoFocus aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names" className="h-8 flex-1 bg-transparent text-[13px] outline-none" />
      </div>
      <div className="max-h-60 overflow-auto">
        {list.map((u) => {
          const on = value.includes(u.id)
          return (
            <button key={u.id} onClick={() => onChange(on ? value.filter((x) => x !== u.id) : [...value, u.id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover">
              <Avatar user={u} size={24} />
              <span className="flex-1 truncate">{u.name}</span>
              {on && <Check className="size-4 text-accent" />}
            </button>
          )
        })}
        {q && !list.length && (
          <button onClick={() => onChange([...value, addTeammate(q).id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-accent hover:bg-hover">
            <Plus className="size-4" /> Add “{q}” to team
          </button>
        )}
      </div>
    </div>
  )
}

export function PeopleCell({ col, item }: { col: Column; item: Item }) {
  const users = useStore((s) => s.user)
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  return (
    <PopCell width={250} pop={() => <PeoplePicker value={ids} onChange={(v) => setValue(item.id, col.id, v)} />} className="grid place-items-center hover:bg-hover">
      {ids.length ? (
        <AvatarStack users={ids.map((id) => users[id]).filter(Boolean)} size={26} />
      ) : (
        <span className="grid size-[26px] place-items-center rounded-full border border-dashed border-line-strong text-faint">
          <Plus className="size-3" />
        </span>
      )}
    </PopCell>
  )
}

// ---------- date ----------
export function DateCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const v = item.values[col.id] as string | undefined
  const overdue = v && differenceInCalendarDays(parseISO(v), new Date()) < 0 && !isDoneItem(board, item)
  const soon = v && !overdue && differenceInCalendarDays(parseISO(v), new Date()) <= 1 && !isDoneItem(board, item)
  return (
    <PopCell
      width={220}
      className="hover:bg-hover"
      pop={(close) => (
        <div className="space-y-2 p-1">
          <input
            type="date"
            aria-label={col.title}
            autoFocus
            defaultValue={v}
            onChange={(e) => setValue(item.id, col.id, e.target.value || null)}
            className="h-9 w-full rounded-lg border border-line bg-panel px-2 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex gap-1">
            {[['Today', 0], ['Tomorrow', 1], ['+1 week', 7]].map(([n, d]) => (
              <button key={n} onClick={() => (setValue(item.id, col.id, format(new Date(Date.now() + (d as number) * 864e5), 'yyyy-MM-dd')), close())} className="flex-1 rounded-md bg-panel-2 py-1 text-[12px] hover:bg-hover">
                {n}
              </button>
            ))}
          </div>
          {v && (
            <button onClick={() => (setValue(item.id, col.id, null), close())} className="w-full rounded-md py-1 text-[12px] text-muted hover:bg-hover">
              Clear date
            </button>
          )}
        </div>
      )}
    >
      <span className={cx('flex items-center justify-center gap-1 text-[13px]', overdue ? 'text-red-500' : soon ? 'text-orange-500' : 'text-fg')}>
        {overdue && <AlertCircle className="size-3.5" />}
        {fmtDate(v)}
      </span>
    </PopCell>
  )
}

// ---------- timeline ----------
export function TimelineCell({ board, col, item, color }: { board: Board; col: Column; item: Item; color: string }) {
  const v = item.values[col.id] as Range | undefined
  let pct = 0
  if (v?.start && v?.end) {
    const total = differenceInCalendarDays(parseISO(v.end), parseISO(v.start)) || 1
    pct = Math.max(0, Math.min(100, (differenceInCalendarDays(new Date(), parseISO(v.start)) / total) * 100))
    if (isDoneItem(board, item)) pct = 100
  }
  return (
    <PopCell
      width={240}
      className="px-2"
      pop={() => (
        <div className="grid gap-2 p-1 text-[12px] text-muted">
          {(['start', 'end'] as const).map((k) => (
            <label key={k} className="grid gap-1">
              {k === 'start' ? 'Start' : 'End'}
              <input
                type="date"
                defaultValue={v?.[k]}
                onChange={(e) => {
                  const next = { start: v?.start ?? e.target.value, end: v?.end ?? e.target.value, [k]: e.target.value }
                  if (next.end < next.start) next.end = next.start
                  setValue(item.id, col.id, next)
                }}
                className="h-9 rounded-lg border border-line bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>
      )}
    >
      {v?.start ? (
        <span className="relative block h-6 overflow-hidden rounded-full bg-panel-2 text-[12px] font-medium">
          <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
          <span className="relative grid h-full place-items-center text-fg mix-blend-normal">
            <span className="rounded px-1">{`${fmtDate(v.start)} – ${fmtDate(v.end)}`}</span>
          </span>
        </span>
      ) : (
        <span className="block h-6 rounded-full bg-panel-2" />
      )}
    </PopCell>
  )
}

// ---------- tags ----------
export function TagsCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  const [q, setQ] = useState('')
  const labels = col.labels ?? []
  return (
    <PopCell
      width={240}
      className="px-1.5 hover:bg-hover"
      pop={() => (
        <div>
          <input
            autoFocus
            aria-label="Find or create tag"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !q.trim()) return
              const hit = labels.find((l) => l.name.toLowerCase() === q.trim().toLowerCase())
              const tag = hit ?? { id: uid('l_'), name: q.trim(), color: COLOR_LIST[labels.length % COLOR_LIST.length] }
              if (!hit) updateColumn(board.id, col.id, { labels: [...labels, tag] })
              if (!ids.includes(tag.id)) setValue(item.id, col.id, [...ids, tag.id])
              setQ('')
            }}
            placeholder="Type a tag, Enter to add"
            className="mb-1 h-8 w-full rounded-lg border border-line bg-panel px-2 text-[13px] outline-none focus:border-accent"
          />
          <div className="flex max-h-56 flex-wrap gap-1 overflow-auto p-1">
            {labels
              .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
              .map((l) => {
                const on = ids.includes(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => setValue(item.id, col.id, on ? ids.filter((x) => x !== l.id) : [...ids, l.id])}
                    className={cx('rounded-full px-2.5 py-1 text-[12px] font-medium transition', on ? 'text-white' : 'opacity-70 hover:opacity-100')}
                    style={on ? { background: l.color } : { color: l.color, boxShadow: `inset 0 0 0 1px ${l.color}` }}
                  >
                    {l.name}
                  </button>
                )
              })}
          </div>
        </div>
      )}
    >
      <span className="flex items-center gap-1 overflow-hidden">
        {ids.map((id) => {
          const l = labels.find((x) => x.id === id)
          return l ? (
            <span key={id} className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ color: l.color, background: `color-mix(in oklab, ${l.color} 14%, transparent)` }}>
              {l.name}
            </span>
          ) : null
        })}
      </span>
    </PopCell>
  )
}

// ---------- simple inline inputs ----------
function InlineInput({ item, col, type = 'text', render }: { item: Item; col: Column; type?: string; render: (v: string) => ReactNode }) {
  const raw = item.values[col.id]
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <input
        autoFocus
        type={type}
        aria-label={col.title}
        defaultValue={raw == null ? '' : String(raw)}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          setEditing(false)
          const val = e.target.value
          setValue(item.id, col.id, type === 'number' ? (val === '' ? null : Number(val)) : val)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-full w-full bg-panel px-2 text-center text-[13px] outline-none ring-2 ring-inset ring-accent"
      />
    )
  return (
    <button onClick={() => setEditing(true)} className="h-full w-full truncate px-2 text-[13px] hover:bg-hover">
      {render(raw == null ? '' : String(raw))}
    </button>
  )
}

export function TextCell({ item, col }: { item: Item; col: Column }) {
  return <InlineInput item={item} col={col} render={(v) => <span className="block truncate text-left">{v}</span>} />
}
export function NumberCell({ item, col }: { item: Item; col: Column }) {
  return <InlineInput item={item} col={col} type="number" render={(v) => (v === '' ? '' : <span className="font-mono tabular-nums">{fmtNumber(Number(v), col.unit)}</span>)} />
}
export const fmtNumber = (n: number, unit?: string) => {
  const s = n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (!unit) return s
  return unit.length === 1 && /[€$£¥]/.test(unit) ? unit + s : `${s} ${unit}`
}
export function LinkCell({ item, col }: { item: Item; col: Column }) {
  const v = item.values[col.id] as string | undefined
  return (
    <div className="group relative h-full">
      <InlineInput item={item} col={col} render={(x) => <span className="block truncate text-left text-accent">{x.replace(/^https?:\/\/(www\.)?/, '')}</span>} />
      {v && /^https?:\/\//.test(v) && (
        <a href={v} target="_blank" rel="noreferrer noopener" title="Open link" className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded bg-panel p-1 text-muted shadow-card hover:text-accent group-hover:block">
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  )
}

export function LongTextCell({ item, col }: { item: Item; col: Column }) {
  const v = (item.values[col.id] as string | undefined) ?? ''
  return (
    <PopCell
      width={320}
      className="px-2 hover:bg-hover"
      pop={() => (
        <textarea
          autoFocus
          aria-label={col.title}
          defaultValue={v}
          onBlur={(e) => setValue(item.id, col.id, e.target.value)}
          rows={6}
          className="w-full resize-none rounded-lg border border-line bg-panel p-2 text-[13px] outline-none focus:border-accent"
        />
      )}
    >
      <span className="block truncate text-left text-[13px] text-muted">{v}</span>
    </PopCell>
  )
}

export function CheckboxCell({ item, col }: { item: Item; col: Column }) {
  const on = !!item.values[col.id]
  return (
    <button aria-label={col.title} aria-pressed={on} onClick={() => setValue(item.id, col.id, !on)} className="grid h-full w-full place-items-center hover:bg-hover">
      <motion.span
        animate={{ scale: on ? [1, 1.25, 1] : 1 }}
        transition={{ duration: 0.25 }}
        className={cx('grid size-[18px] place-items-center rounded-md border-2 transition-colors', on ? 'border-green-500 bg-green-500 text-white' : 'border-line-strong')}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </motion.span>
    </button>
  )
}

export function RatingCell({ item, col }: { item: Item; col: Column }) {
  const v = (item.values[col.id] as number | undefined) ?? 0
  const [hover, setHover] = useState(0)
  return (
    <div className="flex h-full items-center justify-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} aria-label={`Rate ${n}`} onMouseEnter={() => setHover(n)} onClick={() => setValue(item.id, col.id, n === v ? 0 : n)} className="p-0.5">
          <Star className={cx('size-4 transition-transform hover:scale-125', (hover || v) >= n ? 'fill-amber-400 text-amber-400' : 'text-line-strong')} />
        </button>
      ))}
    </div>
  )
}

export function ProgressCell({ item, col }: { item: Item; col: Column }) {
  const v = Math.max(0, Math.min(100, (item.values[col.id] as number | undefined) ?? 0))
  return (
    <PopCell
      width={220}
      className="px-3 hover:bg-hover"
      pop={() => (
        <label className="grid gap-2 p-2 text-[12px] text-muted">
          Progress: {v}%
          <input type="range" min={0} max={100} step={5} defaultValue={v} onChange={(e) => setValue(item.id, col.id, Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      )}
    >
      <span className="flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
          <motion.span className="block h-full rounded-full" initial={false} animate={{ width: `${v}%` }} style={{ background: v === 100 ? '#00b884' : 'var(--accent)' }} />
        </span>
        <span className="w-8 text-right font-mono text-[11.5px] tabular-nums text-muted">{v}%</span>
      </span>
    </PopCell>
  )
}

export function Cell({ board, col, item, groupColor }: { board: Board; col: Column; item: Item; groupColor: string }) {
  switch (col.type) {
    case 'status':
    case 'priority':
      return <StatusCell board={board} col={col} item={item} />
    case 'people':
      return <PeopleCell col={col} item={item} />
    case 'date':
      return <DateCell board={board} col={col} item={item} />
    case 'timeline':
      return <TimelineCell board={board} col={col} item={item} color={groupColor} />
    case 'tags':
      return <TagsCell board={board} col={col} item={item} />
    case 'number':
      return <NumberCell col={col} item={item} />
    case 'link':
      return <LinkCell col={col} item={item} />
    case 'longtext':
      return <LongTextCell col={col} item={item} />
    case 'checkbox':
      return <CheckboxCell col={col} item={item} />
    case 'rating':
      return <RatingCell col={col} item={item} />
    case 'progress':
      return <ProgressCell col={col} item={item} />
    default:
      return <TextCell col={col} item={item} />
  }
}

/** Group footer summary: label battery, sums, date span. */
export function Summary({ col, items }: { col: Column; items: Item[] }) {
  if (col.type === 'status' || col.type === 'priority') {
    const total = items.length || 1
    const counts = (col.labels ?? []).map((l) => ({ l, n: items.filter((i) => i.values[col.id] === l.id).length })).filter((x) => x.n)
    return (
      <div className="flex h-5 w-full overflow-hidden rounded-[5px] bg-panel-2" title={counts.map((c) => `${c.l.name}: ${c.n}`).join(' · ')}>
        {counts.map(({ l, n }) => (
          <motion.span key={l.id} layout className="h-full" style={{ background: l.color, width: `${(n / total) * 100}%` }} />
        ))}
      </div>
    )
  }
  if (col.type === 'number' || col.type === 'rating' || col.type === 'progress') {
    const nums = items.map((i) => i.values[col.id]).filter((v): v is number => typeof v === 'number')
    if (!nums.length) return null
    const sum = nums.reduce((a, b) => a + b, 0)
    const val = col.type === 'number' ? fmtNumber(sum, col.unit) : `${Math.round(sum / nums.length)}${col.type === 'progress' ? '%' : ' avg'}`
    return (
      <span className="text-center text-[12px]">
        <span className="font-mono font-semibold tabular-nums">{val}</span>
        <span className="block text-[10px] uppercase tracking-wide text-faint">{col.type === 'number' ? 'sum' : 'average'}</span>
      </span>
    )
  }
  if (col.type === 'date') {
    const ds = items.map((i) => i.values[col.id] as string).filter(Boolean).sort()
    return ds.length ? <span className="whitespace-nowrap rounded-full bg-panel-2 px-2 py-0.5 text-[11.5px] text-muted">{ds.length > 1 ? `${fmtDate(ds[0])} – ${fmtDate(ds.at(-1))}` : fmtDate(ds[0])}</span> : null
  }
  if (col.type === 'checkbox') {
    const n = items.filter((i) => i.values[col.id]).length
    return <span className="text-[12px] text-muted">{n}/{items.length}</span>
  }
  if (col.type === 'people') {
    const ids = new Set(items.flatMap((i) => (i.values[col.id] as string[]) ?? []))
    return <span className="text-[12px] text-muted">{ids.size ? `${ids.size} people` : ''}</span>
  }
  return null
}

export function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded p-0.5 text-faint hover:bg-hover hover:text-fg" aria-label="Clear">
      <X className="size-3.5" />
    </button>
  )
}

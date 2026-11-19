import { useRef, useState, type ReactNode } from 'react'
import { differenceInCalendarDays, format, isThisYear, parseISO } from 'date-fns'
import { Check, ExternalLink, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { addTeammate, labelOf, setValue, updateColumn, useStore } from '../lib/store'
import { COLOR_LIST, uid } from '../lib/seed'
import type { Board, Column, Item, Label } from '../lib/types'
import { Avatar, AvatarStack, Button, LabelPill, Popover, cx } from './ui'
import { fmtDuration, timeTotal } from '../lib/formula'
import { ConnectCell, ContactCell, CreatedCell, DependencyCell, FilesCell, FormulaCell, ItemIdCell, MirrorCell, TimeCell, UpdatedCell, VoteCell } from './cellsExtra'
import { ButtonCell, ColorCell, CountryCell, HourCell, WeekCell, WorldClockCell } from './cellsMore'

export type Range = { start: string; end: string }
export const fmtDate = (d?: string) => (d ? format(parseISO(d), 'MMM d') : '')
/** Timetable short date: "21 NOV" (year added when not this year). */
export const fmtTimetable = (d?: string) => (d ? format(parseISO(d), isThisYear(parseISO(d)) ? 'd MMM' : 'd MMM yy').toUpperCase() : '')
export const isDoneItem = (board: Board, item: Item) =>
  board.columns.some((c) => c.type === 'status' && labelOf(c, item.values[c.id])?.done)
/** Days late for a deadline (0 when not overdue). */
export const daysLate = (d?: string) => (d ? Math.max(0, differenceInCalendarDays(new Date(), parseISO(d))) : 0)
/** An item is delayed when any of its date columns has passed and it is not done. */
export const isDelayed = (board: Board, item: Item) =>
  !isDoneItem(board, item) && board.columns.some((c) => c.type === 'date' && daysLate(item.values[c.id] as string | undefined) > 0)

const FIELD = 'h-8 w-full rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent'
const POP_TITLE = 'caps px-2 pb-1 pt-1 text-[12px] font-semibold tracking-[0.12em] text-muted'

/** Wrapper that turns a cell into a popover trigger. */
export function PopCell({
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
      <button ref={ref} onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cx('h-full w-full transition-colors', open && 'bg-hover', className)}>
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
      <div className={POP_TITLE}>Edit labels</div>
      {labels.map((l, i) => (
        <div key={l.id} className="flex items-center gap-1.5">
          <button
            title="Change colour"
            aria-label="Change colour"
            className="size-6 shrink-0 rounded-sm ring-1 ring-inset ring-black/10"
            style={{ background: l.color }}
            onClick={() => setLabels(labels.map((x, j) => (j === i ? { ...x, color: COLOR_LIST[(COLOR_LIST.indexOf(x.color) + 1) % COLOR_LIST.length] } : x)))}
          />
          <input
            aria-label="Label name"
            value={l.name}
            onChange={(e) => setLabels(labels.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            className={cx(FIELD, 'h-7 min-w-0 flex-1')}
          />
          {col.type === 'status' && (
            <button
              title="Counts as done"
              aria-pressed={!!l.done}
              onClick={() => setLabels(labels.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
              className={cx('grid size-7 place-items-center rounded-sm', l.done ? 'bg-accent-soft text-accent' : 'text-faint hover:bg-hover')}
            >
              <Check className="size-3.5" />
            </button>
          )}
          <button title="Delete label" aria-label="Delete label" onClick={() => setLabels(labels.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => setLabels([...labels, { id: uid('l_'), name: 'New label', color: COLOR_LIST[labels.length % COLOR_LIST.length] }])}
        className="flex h-8 w-full items-center gap-1.5 rounded-sm px-2 text-[13px] text-muted hover:bg-hover hover:text-fg"
      >
        <Plus className="size-3.5" /> New label
      </button>
      <Button variant="primary" onClick={save} className="w-full">
        Apply
      </Button>
    </div>
  )
}

export function StatusCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const label = labelOf(col, item.values[col.id])
  const [editing, setEditing] = useState(false)
  return (
    <PopCell
      width={editing ? 280 : 210}
      className="flex items-center px-3 hover:bg-hover"
      pop={(close) =>
        editing ? (
          <LabelEditor board={board} col={col} onDone={() => (setEditing(false), close())} />
        ) : (
          <div className="grid p-0.5">
            {col.labels?.map((l) => (
              <button
                key={l.id}
                onClick={() => (setValue(item.id, col.id, l.id), close())}
                className={cx('flex h-9 items-center gap-2 rounded-sm px-2 text-left hover:bg-hover', l.id === label?.id && 'bg-accent-soft')}
              >
                <LabelPill label={l} />
                {l.id === label?.id && <Check className="ml-auto size-3.5 text-accent" />}
              </button>
            ))}
            <button onClick={() => (setValue(item.id, col.id, null), close())} className="flex h-9 items-center gap-2 rounded-sm px-2 text-[13px] text-muted hover:bg-hover">
              <LabelPill /> Clear
            </button>
            <div className="my-1 h-px bg-line" />
            <button onClick={() => setEditing(true)} className="flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] text-muted hover:bg-hover hover:text-fg">
              <Pencil className="size-3.5" /> Edit labels
            </button>
          </div>
        )
      }
    >
      {/* keyed so a new value ticks in like a flap board */}
      <span key={label?.id ?? 'none'} className="flap flex min-w-0">
        <LabelPill label={label} />
      </span>
    </PopCell>
  )
}

// ---------- people ----------
export function PeoplePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const users = useStore((s) => s.user)
  const [q, setQ] = useState('')
  const list = Object.values(users).filter((u) => !u.removedAt && u.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 rounded-md border border-line-strong px-2 focus-within:border-accent">
        <Search className="size-3.5 text-faint" />
        <input autoFocus aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names" className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
      </div>
      <div className="max-h-60 overflow-auto">
        {list.map((u) => {
          const on = value.includes(u.id)
          return (
            <button
              key={u.id}
              onClick={() => onChange(on ? value.filter((x) => x !== u.id) : [...value, u.id])}
              aria-pressed={on}
              className={cx('flex h-9 w-full items-center gap-2 rounded-sm px-2 text-left text-[13.5px]', on ? 'bg-accent-soft' : 'hover:bg-hover')}
            >
              <Avatar user={u} size={22} />
              <span className="flex-1 truncate">{u.name}</span>
              {on && <Check className="size-4 text-accent" />}
            </button>
          )
        })}
        {q && !list.length && (
          <button onClick={() => onChange([...value, addTeammate(q).id])} className="flex h-9 w-full items-center gap-2 rounded-sm px-2 text-[13.5px] text-accent hover:bg-hover">
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
    <PopCell width={250} pop={() => <PeoplePicker value={ids} onChange={(v) => setValue(item.id, col.id, v)} />} className="flex items-center px-3 hover:bg-hover">
      {ids.length ? (
        <AvatarStack users={ids.map((id) => users[id]).filter(Boolean)} size={24} />
      ) : (
        <span className="grid size-6 place-items-center rounded-full border border-dashed border-line-strong text-faint">
          <Plus className="size-3" />
        </span>
      )}
    </PopCell>
  )
}

// ---------- date: reads like a departure time ----------
/** "THU 21 NOV" with the day number large; overdue carries a red +Nd delay tag. */
export function Timetable({ value, late, today }: { value: string; late?: number; today?: boolean }) {
  const d = parseISO(value)
  const small = cx('font-mono text-[11px] font-medium uppercase tracking-[0.04em]', late ? 'text-alert' : 'text-faint')
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
      <span className={small}>{format(d, 'EEE')}</span>
      <span className={cx('font-mono text-[16px] font-semibold leading-none tracking-[-0.01em]', late ? 'text-alert' : 'text-fg')}>{format(d, 'dd')}</span>
      <span className={small}>{format(d, isThisYear(d) ? 'MMM' : "MMM ''yy")}</span>
      {!!late && <span className="self-center rounded-sm bg-alert px-1 py-[3px] font-mono text-[10.5px] font-semibold leading-none text-white">+{late}d</span>}
      {today && <span className="caps self-center rounded-sm border border-fg px-1 py-[2px] text-[10.5px] font-semibold leading-none tracking-[0.12em] text-fg">Today</span>}
    </span>
  )
}

export function DateCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const v = item.values[col.id] as string | undefined
  const done = isDoneItem(board, item)
  const late = done ? 0 : daysLate(v)
  const isToday = !!v && !late && differenceInCalendarDays(parseISO(v), new Date()) === 0
  return (
    <PopCell
      width={232}
      className="flex items-center px-3 hover:bg-hover"
      pop={(close) => (
        <div className="space-y-2 p-1">
          <input
            type="date"
            aria-label={col.title}
            autoFocus
            defaultValue={v}
            onChange={(e) => setValue(item.id, col.id, e.target.value || null)}
            className={cx(FIELD, 'h-9 font-mono')}
          />
          <div className="flex gap-1">
            {[['Today', 0], ['Tomorrow', 1], ['+1 week', 7]].map(([n, d]) => (
              <button
                key={n}
                onClick={() => (setValue(item.id, col.id, format(new Date(Date.now() + (d as number) * 864e5), 'yyyy-MM-dd')), close())}
                className="caps h-7 flex-1 rounded-sm border border-line-strong text-[12px] font-semibold tracking-[0.08em] hover:bg-hover"
              >
                {n}
              </button>
            ))}
          </div>
          {v && (
            <button onClick={() => (setValue(item.id, col.id, null), close())} className="h-7 w-full rounded-sm text-[12.5px] text-muted hover:bg-hover hover:text-fg">
              Clear date
            </button>
          )}
        </div>
      )}
    >
      {v && (
        <span key={v + late} className={cx('flap flex min-w-0', done && 'opacity-60')}>
          <Timetable value={v} late={late} today={isToday} />
        </span>
      )}
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
      className="px-3 hover:bg-hover"
      pop={() => (
        <div className="grid gap-2 p-1">
          {(['start', 'end'] as const).map((k) => (
            <label key={k} className="caps grid gap-1 text-[12px] font-semibold tracking-[0.12em] text-muted">
              {k === 'start' ? 'Start' : 'End'}
              <input
                type="date"
                defaultValue={v?.[k]}
                onChange={(e) => {
                  const next = { start: v?.start ?? e.target.value, end: v?.end ?? e.target.value, [k]: e.target.value }
                  if (next.end < next.start) next.end = next.start
                  setValue(item.id, col.id, next)
                }}
                className={cx(FIELD, 'h-9 font-mono normal-case tracking-normal')}
              />
            </label>
          ))}
        </div>
      )}
    >
      {v?.start ? (
        <span className="flex flex-col gap-1.5" title={`${Math.round(pct)}% elapsed`}>
          <span className="truncate text-left font-mono text-[11.5px] font-medium text-fg">{`${fmtTimetable(v.start)} – ${fmtTimetable(v.end)}`}</span>
          <span className="block h-[3px] bg-line">
            <span className="block h-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
          </span>
        </span>
      ) : (
        <span className="block h-[3px] bg-line" />
      )}
    </PopCell>
  )
}

// ---------- tags: outlined, colour as a small square ----------
function Tag({ label, on }: { label: Label; on?: boolean }) {
  return (
    <span className={cx('inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-[12px] font-medium', on ? 'border-accent bg-accent-soft text-fg' : 'border-line-strong text-fg')}>
      <span className="size-[7px] shrink-0" style={{ background: label.color }} />
      {label.name}
    </span>
  )
}

export function TagsCell({ board, col, item }: { board: Board; col: Column; item: Item }) {
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  const [q, setQ] = useState('')
  const labels = col.labels ?? []
  return (
    <PopCell
      width={260}
      className="px-2 hover:bg-hover"
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
            className={cx(FIELD, 'mb-1')}
          />
          <div className="flex max-h-56 flex-wrap gap-1 overflow-auto p-1">
            {labels
              .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
              .map((l) => {
                const on = ids.includes(l.id)
                return (
                  <button key={l.id} aria-pressed={on} onClick={() => setValue(item.id, col.id, on ? ids.filter((x) => x !== l.id) : [...ids, l.id])} className="rounded-sm hover:bg-hover">
                    <Tag label={l} on={on} />
                  </button>
                )
              })}
            {!labels.length && !q && <p className="px-1 py-1 text-[12.5px] text-muted">No tags yet. Type one and press Enter.</p>}
          </div>
        </div>
      )}
    >
      <span className="flex items-center gap-1 overflow-hidden">
        {ids.map((id) => {
          const l = labels.find((x) => x.id === id)
          return l ? <Tag key={id} label={l} /> : null
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
        className={cx('h-full w-full bg-panel px-3 text-[13.5px] outline-none ring-2 ring-inset ring-accent', type === 'number' && 'text-right font-mono')}
      />
    )
  return (
    <button onClick={() => setEditing(true)} className="h-full w-full truncate px-3 text-[13.5px] transition-colors hover:bg-hover">
      {render(raw == null ? '' : String(raw))}
    </button>
  )
}

export function TextCell({ item, col }: { item: Item; col: Column }) {
  return <InlineInput item={item} col={col} render={(v) => <span className="block truncate text-left">{v}</span>} />
}
export function NumberCell({ item, col }: { item: Item; col: Column }) {
  return <InlineInput item={item} col={col} type="number" render={(v) => (v === '' ? '' : <span className="block text-right font-mono text-[13px] tabular-nums">{fmtNumber(Number(v), col.unit)}</span>)} />
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
      <InlineInput item={item} col={col} render={(x) => <span className="block truncate text-left text-accent underline decoration-accent/30 underline-offset-[3px]">{x.replace(/^https?:\/\/(www\.)?/, '')}</span>} />
      {v && /^https?:\/\//.test(v) && (
        <a
          href={v}
          target="_blank"
          rel="noreferrer noopener"
          title="Open link"
          aria-label="Open link"
          className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-sm border border-line-strong bg-panel p-1 text-muted hover:text-accent focus-visible:block group-hover:block"
        >
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
      className="px-3 hover:bg-hover"
      pop={() => (
        <textarea
          autoFocus
          aria-label={col.title}
          defaultValue={v}
          onBlur={(e) => setValue(item.id, col.id, e.target.value)}
          rows={6}
          className="w-full resize-none rounded-md border border-line-strong bg-panel p-2 text-[13.5px] leading-relaxed outline-none focus:border-accent"
        />
      )}
    >
      <span className="block truncate text-left text-[13.5px] text-muted">{v}</span>
    </PopCell>
  )
}

export function CheckboxCell({ item, col }: { item: Item; col: Column }) {
  const on = !!item.values[col.id]
  return (
    <button aria-label={col.title} aria-pressed={on} onClick={() => setValue(item.id, col.id, !on)} className="grid h-full w-full place-items-center transition-colors hover:bg-hover">
      <span key={String(on)} className={cx('flap grid size-4 place-items-center rounded-sm border-[1.5px]', on ? 'border-fg bg-fg text-panel' : 'border-line-strong bg-panel')}>
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
    </button>
  )
}

export function RatingCell({ item, col }: { item: Item; col: Column }) {
  const v = (item.values[col.id] as number | undefined) ?? 0
  const [hover, setHover] = useState(0)
  return (
    <div className="flex h-full items-center justify-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} aria-label={`Rate ${n}`} aria-pressed={v >= n} onMouseEnter={() => setHover(n)} onClick={() => setValue(item.id, col.id, n === v ? 0 : n)} className="p-0.5">
          <Star className={cx('size-[15px] transition-colors', (hover || v) >= n ? 'fill-fg text-fg' : 'text-line-strong')} />
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
        <label className="grid gap-2 p-2 text-[12.5px] text-muted">
          <span>
            Progress <span className="font-mono text-fg">{v}%</span>
          </span>
          <input type="range" min={0} max={100} step={5} defaultValue={v} onChange={(e) => setValue(item.id, col.id, Number(e.target.value))} className="accent-[var(--accent)]" />
        </label>
      )}
    >
      <span className="flex items-center gap-2">
        <span className="h-[3px] flex-1 bg-line">
          <span className={cx('block h-full transition-[width] duration-300', v === 100 ? 'bg-signal' : 'bg-fg')} style={{ width: `${v}%` }} />
        </span>
        <span className="w-9 text-right font-mono text-[11.5px] tabular-nums text-muted">{v}%</span>
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
    case 'formula':
      return <FormulaCell board={board} col={col} item={item} />
    case 'time':
      return <TimeCell col={col} item={item} />
    case 'dependency':
      return <DependencyCell board={board} col={col} item={item} />
    case 'connect':
      return <ConnectCell board={board} col={col} item={item} />
    case 'mirror':
      return <MirrorCell board={board} col={col} item={item} />
    case 'files':
      return <FilesCell col={col} item={item} />
    case 'email':
    case 'phone':
    case 'location':
      return <ContactCell col={col} item={item} />
    case 'vote':
      return <VoteCell col={col} item={item} />
    case 'created':
      return <CreatedCell item={item} />
    case 'updated':
      return <UpdatedCell item={item} />
    case 'itemId':
      return <ItemIdCell item={item} />
    case 'hour':
      return <HourCell col={col} item={item} />
    case 'week':
      return <WeekCell col={col} item={item} />
    case 'country':
      return <CountryCell col={col} item={item} />
    case 'worldclock':
      return <WorldClockCell col={col} item={item} />
    case 'color':
      return <ColorCell col={col} item={item} />
    case 'button':
      return <ButtonCell col={col} item={item} />
    default:
      return <TextCell col={col} item={item} />
  }
}

const SUM_LABEL = 'caps block text-[10.5px] font-semibold tracking-[0.12em] text-faint'

/** Group footer summary: segmented label battery, sums, date span. */
export function Summary({ col, items }: { col: Column; items: Item[] }) {
  if (col.type === 'status' || col.type === 'priority') {
    const total = items.length || 1
    const counts = (col.labels ?? []).map((l) => ({ l, n: items.filter((i) => i.values[col.id] === l.id).length })).filter((x) => x.n)
    return (
      <div className="flex h-1.5 w-full gap-[2px] bg-line" role="img" aria-label={counts.map((c) => `${c.l.name}: ${c.n}`).join(', ') || 'No values'} title={counts.map((c) => `${c.l.name}: ${c.n}`).join(' · ')}>
        {counts.map(({ l, n }) => (
          <span key={l.id} className="h-full transition-[width] duration-300" style={{ background: l.color, width: `${(n / total) * 100}%` }} />
        ))}
      </div>
    )
  }
  if (col.type === 'number' || col.type === 'rating' || col.type === 'progress') {
    const nums = items.map((i) => i.values[col.id]).filter((v): v is number => typeof v === 'number')
    if (!nums.length) return null
    const sum = nums.reduce((a, b) => a + b, 0)
    const val = col.type === 'number' ? fmtNumber(sum, col.unit) : `${Math.round(sum / nums.length)}${col.type === 'progress' ? '%' : ''}`
    return (
      <span className="text-center leading-tight">
        <span className="font-mono text-[12.5px] font-semibold tabular-nums">{val}</span>
        <span className={SUM_LABEL}>{col.type === 'number' ? 'Sum' : 'Average'}</span>
      </span>
    )
  }
  if (col.type === 'date') {
    const ds = items.map((i) => i.values[col.id] as string).filter(Boolean).sort()
    return ds.length ? <span className="whitespace-nowrap font-mono text-[11.5px] text-muted">{ds.length > 1 ? `${fmtTimetable(ds[0])} – ${fmtTimetable(ds.at(-1))}` : fmtTimetable(ds[0])}</span> : null
  }
  if (col.type === 'checkbox') {
    const n = items.filter((i) => i.values[col.id]).length
    return <span className="font-mono text-[12px] text-muted">{n}/{items.length}</span>
  }
  if (col.type === 'people') {
    const ids = new Set(items.flatMap((i) => (i.values[col.id] as string[]) ?? []))
    return <span className="text-[12px] text-muted">{ids.size ? <><span className="font-mono">{ids.size}</span> {ids.size === 1 ? 'person' : 'people'}</> : ''}</span>
  }
  if (col.type === 'time' || col.type === 'vote') {
    const total = items.reduce((a, i) => a + (col.type === 'time' ? timeTotal(i.values[col.id]) : ((i.values[col.id] as string[] | undefined) ?? []).length), 0)
    return (
      <span className="text-center leading-tight">
        <span className="font-mono text-[12.5px] font-semibold tabular-nums">{col.type === 'time' ? fmtDuration(total) : total}</span>
        <span className={SUM_LABEL}>{col.type === 'time' ? 'Total' : 'Votes'}</span>
      </span>
    )
  }
  return null
}

export function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-sm p-0.5 text-faint hover:bg-hover hover:text-fg" aria-label="Clear">
      <X className="size-3.5" />
    </button>
  )
}

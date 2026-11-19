// Cells for the work-management column types (formula, time tracking, links between items, contact fields...).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { Check, Mail, MapPin, Paperclip, Phone, Play, Search, Square, ThumbsUp, Trash2 } from 'lucide-react'
import { openItem, setValue, updateColumn, useStore } from '../lib/store'
import { cellScalar, fmtDuration, fmtVal, mirrorSource, shortId, timeTotal, type Ctx, type TimeVal } from '../lib/formula'
import type { Board, Column, Item } from '../lib/types'
import { inkOn } from '../lib/seed'
import { Avatar, AvatarStack, Button, MenuItem, Popover, cx } from './ui'
import { PopCell } from './cells'

type P = { board: Board; col: Column; item: Item }
const INPUT = 'h-8 w-full rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent'
const POP_TITLE = 'caps text-[12px] font-semibold tracking-[0.12em] text-muted'

function useCtx(): Ctx {
  const users = useStore((s) => s.user)
  const items = useStore((s) => s.item)
  const boards = useStore((s) => s.board)
  return { users, items, boards }
}

/** Items this item depends on (all dependency columns of its board). */
export function dependenciesOf(item: Item, board: Board): Item[] {
  const all = useStore.getState().item
  const ids = new Set(board.columns.filter((c) => c.type === 'dependency').flatMap((c) => (item.values[c.id] as string[] | undefined) ?? []))
  return [...ids].map((id) => all[id]).filter((i): i is Item => !!i && i.boardId === board.id)
}

// ---------- formula ----------
export function FormulaCell({ board, col, item }: P) {
  const ctx = useCtx()
  let text = ''
  let err = ''
  let isNum = false
  try {
    const v = cellScalar(board, col, item, ctx)
    isNum = typeof v === 'number'
    text = fmtVal(v)
  } catch (e) {
    err = e instanceof Error ? e.message : String(e)
  }
  return (
    <PopCell
      width={320}
      className="px-3 hover:bg-hover"
      pop={() => (
        <label className="grid gap-1.5 p-1 text-[12px] text-muted">
          <span className={POP_TITLE}>Formula</span>
          <textarea
            autoFocus
            aria-label="Formula"
            rows={3}
            defaultValue={col.formula}
            placeholder="{Hours} * {Rate}"
            onBlur={(e) => updateColumn(board.id, col.id, { formula: e.target.value })}
            className="w-full resize-none rounded-md border border-line-strong bg-panel p-2 font-mono text-[12.5px] text-fg outline-none focus:border-accent"
          />
          {err && <span className="text-alert">{err}</span>}
          <span className="font-mono text-[11.5px] text-faint">Columns: {board.columns.filter((c) => c.id !== col.id).map((c) => `{${c.title}}`).join(' ')}</span>
          <span className="font-mono text-[11.5px] text-faint">IF SUM AVG MIN MAX ROUND ABS CONCAT LEN UPPER LOWER DAYS TODAY NOW</span>
        </label>
      )}
    >
      <span title={err || undefined} className={cx('block truncate text-[13.5px]', isNum ? 'text-right font-mono text-[13px] tabular-nums' : 'text-left', err && 'text-faint')}>
        {err ? '—' : text}
      </span>
    </PopCell>
  )
}

// ---------- time tracking ----------
export function TimeCell({ col, item }: Omit<P, 'board'>) {
  const v = item.values[col.id] as TimeVal | undefined
  const running = !!v?.runningSince
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [running])
  const toggle = () => setValue(item.id, col.id, running ? { total: timeTotal(v) } : { total: v?.total ?? 0, runningSince: Date.now() })
  return (
    <div className="flex h-full items-center gap-2 px-3">
      <button onClick={toggle} aria-label={running ? 'Stop timer' : 'Start timer'} className={cx('grid size-6 shrink-0 place-items-center rounded-sm border', running ? 'border-accent bg-accent text-panel' : 'border-line-strong text-muted hover:bg-hover hover:text-fg')}>
        {running ? <Square className="size-3" /> : <Play className="size-3" />}
      </button>
      <span className={cx('font-mono text-[12.5px] tabular-nums', running && 'text-accent')}>{v ? fmtDuration(timeTotal(v)) : ''}</span>
    </div>
  )
}

// ---------- dependency / connect ----------
function ItemPicker({ items, value, onChange }: { items: Item[]; value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('')
  const list = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 rounded-md border border-line-strong px-2 focus-within:border-accent">
        <Search className="size-3.5 text-faint" />
        <input autoFocus aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
      </div>
      <div className="max-h-60 overflow-auto">
        {list.map((i) => {
          const on = value.includes(i.id)
          return (
            <button key={i.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== i.id) : [...value, i.id])} className={cx('flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-[13.5px]', on ? 'bg-accent-soft' : 'hover:bg-hover')}>
              <span className="flex-1 truncate">{i.name}</span>
              {on && <Check className="size-4 text-accent" />}
            </button>
          )
        })}
        {!list.length && <p className="px-2 py-1.5 text-[12.5px] text-muted">No matching items</p>}
      </div>
    </div>
  )
}

/** Chips of linked items (click opens the item) + a popover for editing. Not a PopCell: chips are buttons themselves. */
function ItemChips({ items, pop, width = 260, label }: { items: Item[]; pop: (close: () => void) => ReactNode; width?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen(true)}
        className="flex h-full w-full cursor-pointer items-center gap-1 overflow-hidden px-2 transition-colors hover:bg-hover"
      >
        {items.map((i) => (
          <button key={i.id} title={i.name} onClick={(e) => (e.stopPropagation(), openItem(i.id))} className="h-[22px] max-w-[120px] shrink-0 truncate rounded-sm border border-line-strong px-1.5 text-[12px] text-fg hover:border-accent hover:text-accent">
            {i.name}
          </button>
        ))}
      </div>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={width} align="center">
        {pop(() => setOpen(false))}
      </Popover>
    </>
  )
}

export function DependencyCell({ board, col, item }: P) {
  const all = useStore((s) => s.item)
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  const candidates = Object.values(all)
    .filter((i) => i.boardId === board.id && i.id !== item.id && !i.deletedAt)
    .sort((a, b) => a.order - b.order)
  return (
    <ItemChips
      label={`Edit ${col.title}`}
      items={ids.map((id) => all[id]).filter(Boolean)}
      pop={() => <ItemPicker items={candidates} value={ids} onChange={(v) => setValue(item.id, col.id, v)} />}
    />
  )
}

export function ConnectCell({ board, col, item }: P) {
  const boards = useStore((s) => s.board)
  const all = useStore((s) => s.item)
  const target = col.boardId ? boards[col.boardId] : undefined
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  const linked = ids.map((id) => all[id]).filter((i) => i && i.boardId === col.boardId)
  return (
    <ItemChips
      label={`Edit ${col.title}`}
      items={linked}
      pop={() =>
        target ? (
          <div>
            <div className="mb-1 flex items-center justify-between px-1">
              <span className={cx(POP_TITLE, 'truncate')}>{target.name}</span>
              <button onClick={() => updateColumn(board.id, col.id, { boardId: undefined })} className="rounded-sm px-1 text-[12px] text-accent hover:underline">
                Change board
              </button>
            </div>
            <ItemPicker
              items={Object.values(all).filter((i) => i.boardId === target.id && !i.parentId && !i.deletedAt).sort((a, b) => a.order - b.order)}
              value={ids}
              onChange={(v) => setValue(item.id, col.id, v)}
            />
          </div>
        ) : (
          <div>
            <div className={cx(POP_TITLE, 'px-2 pb-1 pt-1')}>Connect items from</div>
            {Object.values(boards).map((b) => (
              <MenuItem key={b.id} onClick={() => updateColumn(board.id, col.id, { boardId: b.id })}>
                {b.name}
              </MenuItem>
            ))}
          </div>
        )
      }
    />
  )
}

// ---------- mirror ----------
export function MirrorCell({ board, col, item }: P) {
  const ctx = useCtx()
  const m = mirrorSource(board, col, item, ctx)
  const connects = board.columns.filter((c) => c.type === 'connect')
  const isLabel = m.tcol?.type === 'status' || m.tcol?.type === 'priority'
  let text = ''
  if (m.tcol && !isLabel)
    text = m.items
      .map((it) => {
        try {
          return fmtVal(cellScalar(m.target!, m.tcol!, it, ctx))
        } catch {
          return '—'
        }
      })
      .filter(Boolean)
      .join(', ')
  return (
    <PopCell
      width={260}
      className="px-2 hover:bg-hover"
      pop={() => (
        <div className="grid gap-2 p-1 text-[12.5px] text-muted">
          <label className="grid gap-1">
            Connect column
            <select value={col.connectColumnId ?? ''} onChange={(e) => updateColumn(board.id, col.id, { connectColumnId: e.target.value || undefined, mirrorColumnId: undefined })} className={INPUT}>
              <option value="">Choose…</option>
              {connects.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          {!connects.length && <span className="text-faint">Add a Connect boards column first.</span>}
          {m.target && (
            <label className="grid gap-1">
              Column to mirror from {m.target.name}
              <select value={col.mirrorColumnId ?? ''} onChange={(e) => updateColumn(board.id, col.id, { mirrorColumnId: e.target.value || undefined })} className={INPUT}>
                <option value="">Choose…</option>
                {m.target.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    >
      <span className="flex items-center gap-1 overflow-hidden">
        {isLabel
          ? m.items.map((it) => {
              const l = m.tcol!.labels?.find((x) => x.id === it.values[m.tcol!.id])
              return l ? (
                <span key={it.id} title={it.name} className="caps shrink-0 rounded-sm px-1.5 py-[3px] text-[11.5px] font-semibold leading-none tracking-[0.08em]" style={{ background: l.color, color: inkOn(l.color) }}>
                  {l.name}
                </span>
              ) : null
            })
          : <span className="truncate text-[13.5px] text-muted">{text}</span>}
      </span>
    </PopCell>
  )
}

// ---------- files (links only) ----------
type FileLink = { name: string; url: string }
export const isHttpUrl = (s: string) => {
  try {
    return /^https?:$/.test(new URL(s.trim()).protocol)
  } catch {
    return false
  }
}

export function FilesCell({ col, item }: Omit<P, 'board'>) {
  const files = (item.values[col.id] as FileLink[] | undefined) ?? []
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const ok = isHttpUrl(url)
  const add = () => {
    if (!ok) return
    setValue(item.id, col.id, [...files, { name: name.trim() || new URL(url.trim()).hostname, url: url.trim() }])
    setName('')
    setUrl('')
  }
  return (
    <PopCell
      width={300}
      className="px-3 hover:bg-hover"
      pop={() => (
        <div className="grid gap-1.5 p-1 text-[13px]">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <Paperclip className="size-3.5 shrink-0 text-faint" />
              {isHttpUrl(f.url) ? (
                <a href={f.url} target="_blank" rel="noreferrer noopener" title={f.url} className="flex-1 truncate text-accent hover:underline">
                  {f.name}
                </a>
              ) : (
                <span className="flex-1 truncate text-muted">{f.name}</span>
              )}
              <button aria-label={`Remove ${f.name}`} onClick={() => setValue(item.id, col.id, files.filter((_, j) => j !== i))} className="grid size-6 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <input aria-label="Link name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={INPUT} />
          <input
            aria-label="Link URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="https://drive.google.com/…"
            className={INPUT}
          />
          {url && !ok && <span className="text-[12px] text-alert">Use a link that starts with http:// or https://</span>}
          <Button variant="primary" onClick={add} disabled={!ok}>
            Add link
          </Button>
        </div>
      )}
    >
      {files.length > 0 && (
        <span className="flex items-center gap-1.5 text-[13.5px] text-muted">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="truncate">{files.length === 1 ? files[0].name : `${files.length} files`}</span>
        </span>
      )}
    </PopCell>
  )
}

// ---------- email / phone / location ----------
const CONTACT = {
  email: { valid: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), href: (v: string) => 'mailto:' + v, Icon: Mail, input: 'email', tip: 'Send email' },
  phone: { valid: (v: string) => /^\+?[\d\s().-]{5,}$/.test(v), href: (v: string) => 'tel:' + v.replace(/[^\d+]/g, ''), Icon: Phone, input: 'tel', tip: 'Call' },
  location: { valid: (v: string) => !!v.trim(), href: (v: string) => 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(v), Icon: MapPin, input: 'text', tip: 'Open in maps' },
}

export function ContactCell({ col, item }: Omit<P, 'board'>) {
  const k = CONTACT[col.type as keyof typeof CONTACT]
  const v = (item.values[col.id] as string | undefined) ?? ''
  const [editing, setEditing] = useState(false)
  const ok = k.valid(v)
  if (editing)
    return (
      <input
        autoFocus
        type={k.input}
        aria-label={col.title}
        defaultValue={v}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => (setEditing(false), setValue(item.id, col.id, e.target.value.trim()))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="h-full w-full bg-panel px-3 text-[13.5px] outline-none ring-2 ring-inset ring-accent"
      />
    )
  return (
    <div className="group relative h-full">
      <button onClick={() => setEditing(true)} title={v && !ok ? `Not a valid ${col.type}` : undefined} className={cx('h-full w-full truncate px-3 text-left text-[13.5px] transition-colors hover:bg-hover', v && !ok && 'text-alert underline decoration-dotted')}>
        {v}
      </button>
      {v && ok && (
        <a href={k.href(v)} target={col.type === 'location' ? '_blank' : undefined} rel="noreferrer noopener" title={k.tip} className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-sm border border-line-strong bg-panel p-1 text-muted hover:text-accent focus-visible:block group-hover:block">
          <k.Icon className="size-3.5" />
        </a>
      )}
    </div>
  )
}

// ---------- vote ----------
export function VoteCell({ col, item }: Omit<P, 'board'>) {
  const meId = useStore((s) => s.meId)
  const users = useStore((s) => s.user)
  const ids = (item.values[col.id] as string[] | undefined) ?? []
  const mine = ids.includes(meId)
  return (
    <button
      aria-pressed={mine}
      aria-label={mine ? 'Remove my vote' : 'Vote'}
      onClick={() => setValue(item.id, col.id, mine ? ids.filter((x) => x !== meId) : [...ids, meId])}
      className="flex h-full w-full items-center justify-center gap-1.5 transition-colors hover:bg-hover"
    >
      <ThumbsUp className={cx('size-4', mine ? 'fill-accent text-accent' : 'text-faint')} />
      <span className="font-mono text-[12px] tabular-nums">{ids.length || ''}</span>
      <AvatarStack users={ids.map((id) => users[id]).filter(Boolean)} size={20} max={2} />
    </button>
  )
}

// ---------- read-only: created / updated / item id ----------
export function CreatedCell({ item }: { item: Item }) {
  const user = useStore((s) => s.user[item.createdBy])
  return (
    <span className="flex h-full items-center gap-2 px-3 font-mono text-[12px] text-muted" title={format(item.createdAt, 'PPpp')}>
      <Avatar user={user} size={20} />
      {format(item.createdAt, 'd MMM yyyy').toUpperCase()}
    </span>
  )
}

export function UpdatedCell({ item }: { item: Item }) {
  const user = useStore((s) => s.user[item.updatedBy ?? item.createdBy])
  const at = item.updatedAt ?? item.createdAt
  return (
    <span className="flex h-full items-center gap-2 px-3 text-[12.5px] text-muted" title={format(at, 'PPpp')}>
      <Avatar user={user} size={20} />
      {formatDistanceToNowStrict(at, { addSuffix: true })}
    </span>
  )
}

export function ItemIdCell({ item }: { item: Item }) {
  return (
    <span className="flex h-full items-center px-3 font-mono text-[12px] uppercase text-muted" title={item.id}>
      {shortId(item)}
    </span>
  )
}

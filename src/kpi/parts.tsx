// Building blocks of a KPI board: the panel frame, headline figures, the marks, and the data tables behind them.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Check, Pencil, Plus, Table2, X } from 'lucide-react'
import { parseAmount } from '../lib/kpi'
import { Button, cx } from '../components/ui'

const clamp01 = (x: number) => Math.max(0, Math.min(1, x || 0))

/** A ruled panel: condensed-caps title over the 2px foreground rule, an Edit (or, for viewers, Data) toggle. */
export function Panel({
  title, editing, onToggle, editable, children, className, aside,
}: {
  title: string
  editing?: boolean
  onToggle?: () => void
  editable: boolean
  children: ReactNode
  className?: string
  aside?: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cx('flex min-w-0 flex-col rounded-lg border border-line bg-panel', className)}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b-2 border-fg pl-5 pr-2.5">
        <h2 id={id} className="caps truncate text-[15px] font-bold tracking-[0.1em]">{title}</h2>
        <span className="flex-1" />
        {aside}
        {onToggle && (
          <button
            onClick={onToggle}
            aria-pressed={editing}
            className={cx(
              'flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium transition-colors [&>svg]:size-3.5',
              editing ? 'bg-ink text-on-ink dark:bg-signal dark:text-on-signal' : 'text-muted hover:bg-hover hover:text-fg',
            )}
          >
            {editing ? <Check /> : editable ? <Pencil /> : <Table2 />}
            {editing ? 'Done' : editable ? 'Edit' : 'Data'}
          </button>
        )}
      </header>
      <div className="flex min-w-0 flex-1 flex-col gap-5 p-5">{children}</div>
    </section>
  )
}

/** The figure a panel leads with, its context in muted text, and one line on how to read the chart. */
export function Headline({ value, children, note }: { value: string; children?: ReactNode; note?: ReactNode }) {
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span key={value} className="flap font-mono text-[38px] font-semibold leading-none tracking-[-0.03em] text-fg">{value}</span>
        {children && <span className="text-[14px] text-muted">{children}</span>}
      </p>
      {note && <p className="mt-2 max-w-[64ch] text-[13px] leading-snug text-faint">{note}</p>}
    </div>
  )
}

/** Mono figure inside running text. */
export const Fig = ({ children }: { children: ReactNode }) => <b className="font-mono font-semibold text-fg">{children}</b>

/** Actual against target on a track of the same ramp. `soft` (pending money) follows the fill, a step lighter. */
export function Meter({ value, soft = 0, hi, label, className }: { value: number; soft?: number; hi?: boolean; label: string; className?: string }) {
  const v = clamp01(value)
  const s = Math.min(clamp01(soft), 1 - v)
  return (
    <div role="img" aria-label={label} title={label} className={cx('relative h-2 overflow-hidden rounded-[2px] bg-chart-track', className)}>
      {v > 0 && <span className={cx('absolute inset-y-0 left-0 rounded-[2px]', hi ? 'bg-chart-hi' : 'bg-chart-lo')} style={{ width: `${v * 100}%` }} />}
      {s > 0 && <span className="absolute inset-y-0 rounded-[2px] bg-chart-soft" style={{ left: `calc(${v * 100}% + ${v > 0 ? 2 : 0}px)`, width: `calc(${s * 100}% - ${v > 0 ? 2 : 0}px)` }} />}
    </div>
  )
}

/** Percent figure in a ruled box; ink-filled when it is the one to watch. */
export const PctBox = ({ value, hi }: { value: string; hi?: boolean }) => (
  <span className={cx('inline-grid h-7 min-w-14 place-items-center rounded-sm border px-1.5 font-mono text-[13px] font-semibold', hi ? 'border-chart-hi bg-chart-hi text-on-chart-hi' : 'border-line-strong text-fg')}>{value}</span>
)

type LadderRow = { stage: { id: string; name: string }; count: number; names: string[] }
/** A stage ladder: furthest stage on top, one bar per stage, the names at each stage under its bar. */
export function Ladder({ rows, max, focus, compact }: { rows: LadderRow[]; max: number; focus?: string; compact?: boolean }) {
  return (
    <ol className="flex flex-col">
      {rows.map((r) => {
        const on = r.stage.id === focus
        return (
          <li key={r.stage.id} className={cx('grid grid-cols-[minmax(88px,30%)_minmax(0,1fr)] gap-x-4', compact ? 'py-1' : 'py-[7px]')}>
            <span className={cx('truncate text-[13.5px] leading-[18px]', on ? 'font-semibold text-fg' : 'text-muted')}>{r.stage.name}</span>
            <div className="min-w-0">
              <div className="flex h-[18px] items-center gap-2.5" title={`${r.stage.name}: ${r.count}`}>
                {r.count > 0 && <span className={cx('h-3.5 shrink-0 rounded-r-[3px]', on ? 'bg-chart-hi' : 'bg-chart-lo')} style={{ width: `calc((100% - 2.5rem) * ${r.count / max})` }} />}
                <span className={cx('font-mono text-[13px] tabular-nums', r.count ? 'font-semibold text-fg' : 'text-faint')}>{r.count}</span>
              </div>
              {!compact && r.names.length > 0 && <p className="mt-1 text-[12.5px] leading-snug text-faint">{r.names.join(', ')}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export type Part = { name: string; value: number; tone: 'hi' | 'lo' | 'track'; display: string }
/** One whole split into parts: a 28px bar, each part its own block with its share printed when it fits. */
export function Segmented({ parts, label }: { parts: Part[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (!total) return null
  const tone = { hi: 'bg-chart-hi text-on-chart-hi', lo: 'bg-chart-lo text-ink', track: 'bg-chart-track text-fg' }
  return (
    <div>
      <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.name} ${p.display} (${Math.round((p.value / total) * 100)}%)`).join(', ')}`} className="flex h-7 gap-[2px]">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const s = p.value / total
            return (
              <span key={p.name} title={`${p.name}: ${p.display} (${Math.round(s * 100)}%)`} className={cx('flex min-w-0 items-center rounded-[3px] px-2 font-mono text-[12px] font-semibold', tone[p.tone])} style={{ flexGrow: s, flexBasis: 0 }}>
                {s >= 0.12 && `${Math.round(s * 100)}%`}
              </span>
            )
          })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-2 text-[13px] text-muted">
            <span className={cx('size-2.5 rounded-[2px]', p.tone === 'hi' ? 'bg-chart-hi' : p.tone === 'lo' ? 'bg-chart-lo' : 'bg-chart-track ring-1 ring-inset ring-line-strong')} />
            {p.name} <b className="font-mono font-semibold text-fg">{p.display}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A 1-5 score as five signal lamps; click a lamp to set it, click it again to clear. */
export function Pips({ score, hi, name, onSet }: { score?: number; hi?: boolean; name: string; onSet?: (n: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label={`${name} score, 1 to 5`} className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={score === n}
          aria-label={`${n} of 5`}
          title={onSet ? (score === n ? 'Clear score' : `Score ${n} of 5`) : `${score ?? 'No'} of 5`}
          disabled={!onSet}
          onClick={() => onSet?.(score === n ? undefined : n)}
          className={cx(
            'h-[18px] w-6 rounded-[2px] transition-[filter] enabled:hover:brightness-90 sm:w-8',
            score && n <= score ? (hi ? 'bg-chart-hi' : 'bg-chart-lo') : 'bg-chart-track',
          )}
        />
      ))}
    </div>
  )
}

/** Eight weekly columns for one measure, this week emphasised. Zero draws nothing above the baseline. */
export function MiniColumns({ values, labels, max }: { values: (number | undefined)[]; labels: string[]; max: number }) {
  return (
    <div className="flex h-14 items-end gap-[3px] border-b border-line-strong">
      {values.map((v, i) => (
        <span key={labels[i]} title={`${labels[i]}: ${v ?? 'not entered'}`} className="flex h-full flex-1 items-end">
          {!!v && <span className={cx('w-full rounded-t-[2px]', i === values.length - 1 ? 'bg-chart-hi' : 'bg-chart-lo')} style={{ height: `${(v / max) * 100}%` }} />}
        </span>
      ))}
    </div>
  )
}

/** Recharts tooltip: value first, series second, short line keys. */
export function ChartTip({ active, payload, label, title, fmt }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string; title: (l: string) => string; fmt: (v: number, key?: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-md border border-line-strong bg-panel px-3 py-2 shadow-pop">
      <div className="caps mb-1 text-[11.5px] font-semibold tracking-[0.12em] text-faint">{title(String(label ?? ''))}</div>
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 shrink-0" style={{ background: p.color }} />
          <b className="font-mono text-[13px] font-semibold text-fg">{p.value == null ? '—' : fmt(p.value, p.dataKey)}</b>
          <span className="text-[12.5px] text-muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-[13.5px] text-muted">{children}</p>

// ---------- the data behind a panel: a spreadsheet-tight table ----------
export type Col<T> = {
  key: keyof T & string
  label: string
  type: 'text' | 'number' | 'date' | 'month' | 'select' | 'check'
  options?: { value: string; label: string }[]
  width?: string
  placeholder?: string
  disabled?: (row: T) => boolean
  hint?: (row: T) => string | undefined // shown instead of a value when the cell is disabled
}
const cell = 'h-9 w-full min-w-0 bg-transparent px-2 text-[13.5px] text-fg outline-none placeholder:text-faint focus:bg-panel focus:shadow-[inset_0_0_0_2px_var(--accent)] disabled:cursor-default disabled:text-faint'

/** Text and number cells keep a draft and commit on blur or Enter; Escape puts the old value back. */
function DraftCell({ value, number, onCommit, disabled, placeholder, label }: { value: unknown; number?: boolean; onCommit: (v: unknown) => void; disabled?: boolean; placeholder?: string; label: string }) {
  const shown = value == null ? '' : number ? Number(value).toLocaleString('en', { maximumFractionDigits: 2 }) : String(value)
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])
  const commit = () => {
    if (draft === shown) return
    if (!number) return onCommit(draft.trim() || undefined)
    const n = parseAmount(draft)
    if (draft.trim() && n == null) return setDraft(shown) // not a number: keep what was there
    onCommit(n)
  }
  return (
    <input
      aria-label={label}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      inputMode={number ? 'decimal' : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') (setDraft(shown), requestAnimationFrame(() => e.currentTarget?.blur()))
      }}
      className={cx(cell, number && 'text-right font-mono tabular-nums')}
    />
  )
}

export function RowsEditor<T extends { id: string }>({
  rows, cols, onPatch, onRemove, onAdd, addLabel, readOnly, caption, rowLabel,
}: {
  rows: T[]
  cols: Col<T>[]
  onPatch: (id: string, key: keyof T & string, value: unknown) => void
  onRemove?: (id: string) => void
  onAdd?: () => void
  addLabel?: string
  readOnly?: boolean
  caption?: string
  rowLabel: (row: T) => string
}) {
  // a row added from here gets the cursor in its first free cell
  const body = useRef<HTMLTableSectionElement>(null)
  const before = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!before.current) return
    const fresh = rows.find((r) => !before.current!.has(r.id))
    if (!fresh) return
    before.current = null
    body.current?.querySelector<HTMLElement>(`tr[data-row="${CSS.escape(fresh.id)}"] :is(input, select):not(:disabled)`)?.focus()
  }, [rows])
  return (
    <div className="min-w-0">
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[520px] table-fixed border-collapse text-left">
          {caption && <caption className="caps pb-1.5 text-left text-[12px] font-semibold tracking-[0.12em] text-muted">{caption}</caption>}
          <colgroup>
            {cols.map((c) => <col key={c.key} style={{ width: c.width }} />)}
            {!readOnly && onRemove && <col style={{ width: 36 }} />}
          </colgroup>
          <thead>
            <tr className="border-b-2 border-fg">
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cx('caps h-8 px-2 text-[11.5px] font-semibold tracking-[0.12em] text-muted', c.type === 'number' && 'text-right')}>
                  {c.label}
                </th>
              ))}
              {!readOnly && onRemove && <th aria-label="Remove" />}
            </tr>
          </thead>
          <tbody ref={body}>
            {rows.map((r) => (
              <tr key={r.id} data-row={r.id} className="group border-b border-line">
                {cols.map((c) => {
                  const v = r[c.key] as unknown
                  const off = readOnly || c.disabled?.(r)
                  const label = `${c.label}, ${rowLabel(r) || 'new row'}`
                  if (off && c.hint?.(r)) return <td key={c.key} className={cx('truncate px-2 font-mono text-[13px] text-faint', c.type === 'number' && 'text-right')}>{c.hint(r)}</td>
                  return (
                    <td key={c.key} className="p-0">
                      {c.type === 'text' || c.type === 'number' ? (
                        <DraftCell value={v} number={c.type === 'number'} disabled={off} placeholder={c.placeholder} label={label} onCommit={(x) => onPatch(r.id, c.key, x)} />
                      ) : c.type === 'select' ? (
                        <select aria-label={label} value={(v as string) ?? ''} disabled={off} onChange={(e) => onPatch(r.id, c.key, e.target.value || undefined)} className={cx(cell, 'pr-1')}>
                          {c.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : c.type === 'check' ? (
                        <label className="flex h-9 items-center px-2">
                          <input type="checkbox" aria-label={label} checked={!!v} disabled={off} onChange={(e) => onPatch(r.id, c.key, e.target.checked || undefined)} />
                        </label>
                      ) : (
                        <input
                          type={c.type}
                          aria-label={label}
                          value={(v as string) ?? ''}
                          disabled={off}
                          onChange={(e) => onPatch(r.id, c.key, e.target.value || undefined)}
                          className={cx(cell, 'font-mono text-[13px] tabular-nums')}
                        />
                      )}
                    </td>
                  )
                })}
                {!readOnly && onRemove && (
                  <td className="p-0 text-center">
                    <button onClick={() => onRemove(r.id)} aria-label={`Remove ${rowLabel(r) || 'row'}`} className="grid size-8 place-items-center rounded-md text-faint opacity-60 transition hover:bg-alert-soft hover:text-alert hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100">
                      <X className="size-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={cols.length + 1} className="px-2 py-3 text-[13px] text-faint">Nothing here yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && onAdd && (
        <Button variant="ghost" className="-ml-2 mt-1.5" onClick={() => ((before.current = new Set(rows.map((r) => r.id))), onAdd())}>
          <Plus /> {addLabel ?? 'Add row'}
        </Button>
      )}
    </div>
  )
}

/** A labelled single value (the round's settings). */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="caps text-[11.5px] font-semibold tracking-[0.12em] text-muted">{label}</span>
      <span className="overflow-hidden rounded-md border border-line-strong bg-panel focus-within:border-accent">{children}</span>
      {hint && <span className="text-[12px] text-faint">{hint}</span>}
    </label>
  )
}
export function FieldInput({ value, number, onCommit, disabled, label, type, placeholder }: { value: unknown; number?: boolean; onCommit: (v: unknown) => void; disabled?: boolean; label: string; type?: 'date'; placeholder?: string }) {
  if (type === 'date')
    return <input type="date" aria-label={label} value={(value as string) ?? ''} disabled={disabled} onChange={(e) => onCommit(e.target.value || undefined)} className={cx(cell, 'font-mono text-[13px]')} />
  return <DraftCell value={value} number={number} onCommit={onCommit} disabled={disabled} label={label} placeholder={placeholder} />
}

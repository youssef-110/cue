import { useRef, useState } from 'react'
import { Filter, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { uid } from '../lib/seed'
import { OP_LABEL, activeRules, filterKind, needsValue, opsFor } from '../lib/filters'
import type { Board, FilterRule, ViewFilter } from '../lib/types'
import { Button, Popover } from './ui'

const sel = 'h-8 min-w-0 rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent'

/** Rule builder: (column, operator, value) rows joined by AND / OR. */
export function FilterBuilder({ board, value, onChange }: { board: Board; value?: ViewFilter; onChange: (f: ViewFilter | undefined) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const f: ViewFilter = value ?? { mode: 'and', rules: [] }
  const n = activeRules(value)
  const save = (rules: FilterRule[], mode = f.mode) => onChange(rules.length ? { mode, rules } : undefined)
  const patch = (id: string, p: Partial<FilterRule>) => save(f.rules.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const add = () => {
    const c = board.columns.find((x) => x.type === 'status') ?? board.columns[0]
    const columnId = c?.id ?? 'name'
    save([...f.rules, { id: uid('f_'), columnId, op: opsFor(c)[0], value: filterKind(c) === 'bool' ? 'true' : '' }])
  }
  return (
    <>
      <Button ref={ref} variant={n ? 'soft' : 'outline'} onClick={() => setOpen(true)}>
        <Filter /> Filter
        {n > 0 && <span className="rounded-sm bg-fg px-1 font-mono text-[11px] font-semibold text-panel">{n}</span>}
      </Button>
      <Popover anchor={ref.current} open={open} onClose={() => setOpen(false)} width={560}>
        <div className="space-y-2 p-1.5">
          <div className="caps border-b-2 border-fg pb-1.5 text-[15px] font-bold tracking-[0.1em]">Filter items</div>
          {f.rules.map((r, i) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <span className="caps w-14 shrink-0 text-[12.5px] font-semibold tracking-[0.1em] text-muted">
                {i === 0 ? (
                  'Where'
                ) : i === 1 ? (
                  <select aria-label="Match all or any" className={sel} value={f.mode} onChange={(e) => save(f.rules, e.target.value as ViewFilter['mode'])}>
                    <option value="and">and</option>
                    <option value="or">or</option>
                  </select>
                ) : (
                  f.mode
                )}
              </span>
              <select
                aria-label="Column"
                className={sel + ' w-36'}
                value={r.columnId}
                onChange={(e) => {
                  const c = board.columns.find((x) => x.id === e.target.value)
                  patch(r.id, { columnId: e.target.value, op: opsFor(c)[0], value: filterKind(c) === 'bool' ? 'true' : '' })
                }}
              >
                <option value="name">Item name</option>
                {board.columns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select aria-label="Operator" className={sel + ' w-32'} value={r.op} onChange={(e) => patch(r.id, { op: e.target.value as FilterRule['op'] })}>
                {opsFor(board.columns.find((c) => c.id === r.columnId)).map((op) => (
                  <option key={op} value={op}>{OP_LABEL[op]}</option>
                ))}
              </select>
              {needsValue(r.op) ? <RuleValue board={board} rule={r} onChange={(v) => patch(r.id, { value: v })} /> : <span className="flex-1" />}
              <button onClick={() => save(f.rules.filter((x) => x.id !== r.id))} aria-label="Remove rule" title="Remove rule" className="grid size-7 shrink-0 place-items-center rounded-sm text-faint hover:bg-alert-soft hover:text-alert">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {!f.rules.length && <p className="px-1 py-2 text-[13.5px] text-muted">No filters yet. Add a rule to narrow down the items on this view.</p>}
          <div className="flex items-center justify-between border-t border-line pt-2">
            <Button variant="outline" onClick={add}>
              <Plus /> Add rule
            </Button>
            {f.rules.length > 0 && (
              <button onClick={() => onChange(undefined)} className="text-[13px] text-muted hover:text-alert">
                Clear all
              </button>
            )}
          </div>
        </div>
      </Popover>
    </>
  )
}

function RuleValue({ board, rule, onChange }: { board: Board; rule: FilterRule; onChange: (v: string) => void }) {
  const users = useStore((s) => s.user)
  const col = board.columns.find((c) => c.id === rule.columnId)
  const kind = rule.columnId === 'name' ? 'text' : filterKind(col)
  const v = rule.value ?? ''
  if (kind === 'choice')
    return (
      <select aria-label="Value" className={sel + ' flex-1'} value={v} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {col?.type === 'people'
          ? Object.values(users).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)
          : col?.labels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    )
  if (kind === 'bool')
    return (
      <select aria-label="Value" className={sel + ' flex-1'} value={v || 'true'} onChange={(e) => onChange(e.target.value)}>
        <option value="true">checked</option>
        <option value="false">not checked</option>
      </select>
    )
  return (
    <input
      aria-label="Value"
      type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'}
      value={v}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Value"
      className={sel + ' flex-1'}
    />
  )
}

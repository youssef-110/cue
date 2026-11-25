// Feeding a KPI ladder (investor funnel, sales pipeline) from a Cue board: each item is an entry, its status picks the stage.
import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { isLive, navigate, saveKpi, useStore, visibleItem } from '../lib/store'
import { autoMap, linkedBoard, linkedEntries } from '../lib/kpi'
import type { Board, Item, Kpi, KpiLink } from '../lib/types'
import { LabelPill, cx } from '../components/ui'

export type Which = 'investor' | 'account'
const KEY = { investor: 'investorLink', account: 'accountLink' } as const
const stagesOf = (k: Kpi, w: Which) => (w === 'investor' ? k.investorStages : k.accountStages)
const sel = 'h-8 min-w-0 max-w-full rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent disabled:text-muted'
const save = (k: Kpi, w: Which, link?: KpiLink) => saveKpi(k.id, (x) => ({ ...x, [KEY[w]]: link }))

/** Live top-level items of one board. */
function useBoardItems(boardId?: string) {
  const items = useStore((s) => s.item)
  const boards = useStore((s) => s.board)
  return useMemo(() => (boardId ? Object.values(items).filter((i) => i.boardId === boardId && !i.parentId && visibleItem(i, boards, items)) : []), [boardId, items, boards])
}

/** A fresh link to `b`: its first status column, labels matched to stages by name, amount and chance columns guessed by title. */
function makeLink(k: Kpi, w: Which, b: Board, columnId?: string): KpiLink {
  const col = b.columns.find((c) => c.id === columnId) ?? b.columns.find((c) => c.type === 'status')!
  const amount = b.columns.find((c) => c.type === 'number' && (w === 'investor' ? /ticket|amount|invest|commit|raise/i : /value|revenue|mrr|arr|price|pay|deal|contract/i).test(c.title))
  return {
    boardId: b.id,
    columnId: col.id,
    map: autoMap(col.labels ?? [], stagesOf(k, w), w === 'investor'),
    amountColumnId: amount?.id,
    monthly: w === 'account' && !!amount && /month|mrr/i.test(amount.title),
    chanceColumnId: w === 'account' ? b.columns.find((c) => (c.type === 'number' || c.type === 'progress') && /chance|prob|likel|confidence/i.test(c.title))?.id : undefined,
  }
}

/** Under the ladder: where the entries come from, and what the board has that is not counted. */
export function LinkNote({ k, which }: { k: Kpi; which: Which }) {
  const link = k[KEY[which]]
  const boards = useStore((s) => s.board)
  const b = linkedBoard(link, boards)
  const items = useBoardItems(b?.id)
  const skipped = useMemo(() => (link && b ? linkedEntries(link, b, items).skipped : []), [link, b, items])
  if (!link) return null
  if (!b) return <p className="text-[12.5px] text-faint">Linked to a board that is archived, in the trash, or not shared with you.</p>
  return (
    <p className="text-[12.5px] leading-snug text-faint">
      Live from{' '}
      <button onClick={() => navigate({ page: 'board', boardId: b.id })} className="inline-flex items-center gap-0.5 font-medium text-accent hover:underline">
        {b.name}
        <ArrowUpRight className="size-3" />
      </button>
      {skipped.length > 0 && <> · not counted: {skipped.map((s) => `${s.name} (${s.count})`).join(', ')}</>}
    </p>
  )
}

/** In edit mode: typed here, or from a board with its status labels mapped to this ladder's stages. */
export function LinkEditor({ k, which, editable }: { k: Kpi; which: Which; editable: boolean }) {
  const boards = useStore((s) => s.board)
  const link = k[KEY[which]]
  const list = useMemo(() => Object.values(boards).filter((b) => isLive(b) && b.columns.some((c) => c.type === 'status')).sort((a, b) => a.order - b.order), [boards])
  const b = linkedBoard(link, boards)
  const items = useBoardItems(b?.id)
  const col = b?.columns.find((c) => c.id === link?.columnId)
  const preferred = list.find((x) => (which === 'investor' ? /investor|fundrais|raise|vc\b/i : /sales|pipeline|customer|lead|deal|account/i).test(x.name)) ?? list[0]
  const noun = which === 'investor' ? 'investors' : 'accounts'
  const set = (patch: Partial<KpiLink>) => link && save(k, which, { ...link, ...patch })
  const nums = b?.columns.filter((c) => c.type === 'number' || (which === 'account' && c.type === 'progress')) ?? []
  const stageOpts = [...stagesOf(k, which).map((s) => ({ value: s.id, label: s.name })), ...(which === 'investor' ? [{ value: 'passed', label: 'Passed' }] : [])]
  const opt = (on: boolean) => cx('h-7 rounded-[3px] px-3 text-[13px] font-medium transition-colors disabled:opacity-45', on ? 'bg-ink text-on-ink dark:bg-signal dark:text-on-signal' : 'text-muted hover:text-fg')

  return (
    <div className="rounded-md border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="caps text-[12px] font-semibold tracking-[0.12em] text-muted">Where the {noun} come from</span>
        <div role="radiogroup" aria-label={`Where the ${noun} come from`} className="flex gap-0.5 rounded-md border border-line-strong p-0.5">
          <button role="radio" aria-checked={!link} disabled={!editable} onClick={() => link && save(k, which, undefined)} className={opt(!link)}>
            Typed here
          </button>
          <button
            role="radio"
            aria-checked={!!link}
            disabled={!editable || !preferred}
            title={preferred ? undefined : 'Make a board with a status column first'}
            onClick={() => !link && preferred && save(k, which, makeLink(k, which, preferred))}
            className={opt(!!link)}
          >
            From a board
          </button>
        </div>
      </div>
      {!link && <p className="mt-2 text-[13px] text-faint">Typed here: the list below. From a board: every item on that board is one of the {noun}, and its status sets the stage. Your typed list is kept either way.</p>}
      {link && (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="caps text-[11.5px] font-semibold tracking-[0.12em] text-muted">Board</span>
              <select className={sel} disabled={!editable} value={link.boardId} onChange={(e) => boards[e.target.value] && save(k, which, makeLink(k, which, boards[e.target.value]))}>
                {!b && <option value={link.boardId}>Not available</option>}
                {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            {b && (
              <>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="caps text-[11.5px] font-semibold tracking-[0.12em] text-muted">Stage column</span>
                  <select className={sel} disabled={!editable} value={link.columnId} onChange={(e) => save(k, which, makeLink(k, which, b, e.target.value))}>
                    {b.columns.filter((c) => c.type === 'status').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="caps text-[11.5px] font-semibold tracking-[0.12em] text-muted">{which === 'investor' ? 'Ticket column' : 'Value column'}</span>
                  <select className={sel} disabled={!editable} value={link.amountColumnId ?? ''} onChange={(e) => set({ amountColumnId: e.target.value || undefined })}>
                    <option value="">None</option>
                    {nums.filter((c) => c.type === 'number').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  {which === 'account' && link.amountColumnId && (
                    <span className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
                      <input type="checkbox" id={`${k.id}-monthly`} checked={!!link.monthly} disabled={!editable} onChange={(e) => set({ monthly: e.target.checked })} />
                      <label htmlFor={`${k.id}-monthly`}>Per month (counted ×12)</label>
                    </span>
                  )}
                </label>
                {which === 'account' && (
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="caps text-[11.5px] font-semibold tracking-[0.12em] text-muted">Chance column, 0–100</span>
                    <select className={sel} disabled={!editable} value={link.chanceColumnId ?? ''} onChange={(e) => set({ chanceColumnId: e.target.value || undefined })}>
                      <option value="">None</option>
                      {nums.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
          {col && (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[13.5px]">
                <caption className="caps pb-1.5 text-left text-[12px] font-semibold tracking-[0.12em] text-muted">Board status → stage</caption>
                <thead>
                  <tr className="border-b-2 border-fg">
                    <th className="caps h-8 px-2 text-left text-[11.5px] font-semibold tracking-[0.12em] text-muted">{col.title} on {b!.name}</th>
                    <th className="caps h-8 px-2 text-right text-[11.5px] font-semibold tracking-[0.12em] text-muted">Items</th>
                    <th className="caps h-8 px-2 text-left text-[11.5px] font-semibold tracking-[0.12em] text-muted">Counts as</th>
                  </tr>
                </thead>
                <tbody>
                  {(col.labels ?? []).map((l) => (
                    <tr key={l.id} className="h-10 border-b border-line">
                      <td className="px-2"><LabelPill label={l} /></td>
                      <td className="px-2 text-right font-mono tabular-nums">{items.filter((i: Item) => i.values[col.id] === l.id).length}</td>
                      <td className="px-2">
                        <select
                          aria-label={`${l.name} counts as`}
                          className={sel}
                          disabled={!editable}
                          value={link.map[l.id] ?? ''}
                          onChange={(e) => set({ map: { ...link.map, [l.id]: e.target.value } })}
                        >
                          <option value="">Not counted</option>
                          {stageOpts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[12.5px] text-faint">Items with no status, or a status that is not counted, stay out of the {noun}. Change items on the board; this panel follows live.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Remove-guard for the stages editor: a stage the link maps a label to cannot go. */
export const linkUses = (k: Kpi, which: Which, stageId: string) => Object.values(k[KEY[which]]?.map ?? {}).includes(stageId)

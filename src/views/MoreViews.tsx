// Cards (item gallery), Form (structured intake that creates items) and Files (every attachment link on the board).
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ClipboardList, ExternalLink, LayoutGrid, Paperclip, Send } from 'lucide-react'
import { toast } from 'sonner'
import { addItem, liveGroups, openItem, useCanEdit, useStore } from '../lib/store'
import type { Board, CellValue, Column, Item, View } from '../lib/types'
import { Cell } from '../components/cells'
import { Avatar, Button, cx } from '../components/ui'
import { countryName } from '../components/cellsMore'
import { EmptyView } from './KanbanView'

type Props = { board: Board; items: Item[]; view: View }
const NO_CARD: Column['type'][] = ['button', 'vote', 'longtext', 'files']

// ---------- cards ----------
export function CardsView({ board, items }: Props) {
  const cols = board.columns.filter((c) => !NO_CARD.includes(c.type)).slice(0, 5)
  const groups = Object.fromEntries(board.groups.map((g) => [g.id, g]))
  const top = items.filter((i) => !i.parentId)
  if (!top.length)
    return (
      <EmptyView icon={<LayoutGrid />} title="No items to show">
        Add an item, or clear the filters, to see it as a card.
      </EmptyView>
    )
  return (
    <div className="h-full overflow-y-auto px-6 pb-10 pt-2 sm:px-8">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {top.map((it) => (
          <li key={it.id} className="overflow-hidden rounded-lg border border-line bg-panel transition-shadow hover:shadow-card">
            <div className="h-1" style={{ background: groups[it.groupId]?.color }} />
            <button onClick={() => openItem(it.id)} className="block w-full px-4 pb-2 pt-3 text-left">
              <span className="caps block text-[11.5px] font-semibold tracking-[0.12em] text-faint">{groups[it.groupId]?.title}</span>
              <span className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug hover:underline">{it.name}</span>
            </button>
            <dl className="border-t border-line">
              {cols.map((c) => (
                <div key={c.id} className="grid h-9 grid-cols-[112px_1fr] items-center border-b border-line last:border-0">
                  <dt className="caps truncate px-4 text-[11px] font-semibold tracking-[0.1em] text-faint">{c.title}</dt>
                  <dd className="h-full min-w-0 overflow-hidden">
                    <Cell board={board} col={c} item={it} groupColor={groups[it.groupId]?.color ?? '#121212'} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- form ----------
const FORM_TYPES: Column['type'][] = ['text', 'longtext', 'number', 'email', 'phone', 'link', 'location', 'date', 'status', 'priority', 'people', 'checkbox', 'rating', 'hour', 'country', 'tags']
const FIELD = 'h-10 w-full rounded-md border border-line-strong bg-panel px-3 text-[14.5px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent'

function FormField({ col, value, onChange }: { col: Column; value: CellValue; onChange: (v: CellValue) => void }) {
  const users = useStore((s) => s.user)
  const id = `f-${col.id}`
  const str = (value as string | undefined) ?? ''
  let input
  switch (col.type) {
    case 'longtext':
      input = <textarea id={id} rows={4} value={str} onChange={(e) => onChange(e.target.value)} className={cx(FIELD, 'h-auto py-2')} />
      break
    case 'status':
    case 'priority':
    case 'tags':
      input = (
        <select id={id} value={col.type === 'tags' ? ((value as string[] | undefined)?.[0] ?? '') : str} onChange={(e) => onChange(col.type === 'tags' ? (e.target.value ? [e.target.value] : []) : e.target.value)} className={FIELD}>
          <option value="">Choose…</option>
          {col.labels?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name || '(blank)'}
            </option>
          ))}
        </select>
      )
      break
    case 'people':
      input = (
        <select id={id} value={(value as string[] | undefined)?.[0] ?? ''} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])} className={FIELD}>
          <option value="">Choose a person…</option>
          {Object.values(users)
            .filter((u) => !u.removedAt)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      )
      break
    case 'checkbox':
      input = (
        <label className="flex h-10 items-center gap-2 text-[14.5px]">
          <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="size-4" /> Yes
        </label>
      )
      break
    case 'rating':
      input = (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} className={FIELD}>
          <option value="">No rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      )
      break
    case 'country':
      input = <input id={id} value={str} maxLength={2} placeholder="Two-letter code, e.g. FR" onChange={(e) => onChange(e.target.value.toUpperCase())} className={cx(FIELD, 'font-mono')} />
      break
    default: {
      const type = { number: 'number', email: 'email', phone: 'tel', link: 'url', date: 'date', hour: 'time' }[col.type as string] ?? 'text'
      input = <input id={id} type={type} value={str} onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)} className={cx(FIELD, ['date', 'time', 'number'].includes(type) && 'font-mono')} />
    }
  }
  return (
    <div>
      <label htmlFor={id} className="caps mb-1 block text-[12.5px] font-semibold tracking-[0.12em] text-muted">
        {col.title}
        {col.type === 'country' && str.length === 2 && <span className="ml-2 normal-case tracking-normal text-faint">{countryName(str)}</span>}
      </label>
      {input}
    </div>
  )
}

export function FormView({ board }: Props) {
  const editable = useCanEdit()
  const groups = liveGroups(board)
  const fields = board.columns.filter((c) => FORM_TYPES.includes(c.type))
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')
  const [name, setName] = useState('')
  const [values, setValues] = useState<Record<string, CellValue>>({})
  const [sent, setSent] = useState(0)
  if (!editable)
    return (
      <EmptyView icon={<ClipboardList />} title="View-only access">
        Forms add new items, so they need Member or Admin access.
      </EmptyView>
    )
  const submit = () => {
    if (!name.trim() || !groupId) return
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && !v.length)))
    const it = addItem(board.id, groupId, name.trim(), { values: clean })
    setName('')
    setValues({})
    setSent((n) => n + 1)
    toast.success('Item added', { action: it ? { label: 'Open', onClick: () => openItem(it.id) } : undefined })
  }
  return (
    <div className="h-full overflow-y-auto px-6 pb-12 pt-2 sm:px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mx-auto max-w-xl overflow-hidden rounded-lg border border-line bg-panel"
      >
        <div className="band bg-signal px-6 py-5 text-on-signal">
          <h2 className="caps text-[28px] font-bold leading-none">{board.name}</h2>
          <p className="mt-1.5 text-[14px]">{board.description || 'Fill this in to add an item to the board.'}</p>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label htmlFor="f-name" className="caps mb-1 block text-[12.5px] font-semibold tracking-[0.12em] text-muted">
              Name <span className="text-alert">*</span>
            </label>
            <input id="f-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
          </div>
          {fields.map((c) => (
            <FormField key={c.id} col={c} value={values[c.id]} onChange={(v) => setValues((s) => ({ ...s, [c.id]: v }))} />
          ))}
          {groups.length > 1 && (
            <div>
              <label htmlFor="f-group" className="caps mb-1 block text-[12.5px] font-semibold tracking-[0.12em] text-muted">
                Add to group
              </label>
              <select id="f-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={FIELD}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          <span className="mr-auto font-mono text-[12.5px] text-faint">{sent ? `${sent} added this session` : `${fields.length + 1} fields`}</span>
          <Button variant="primary" className="h-10 px-5" disabled={!name.trim()}>
            <Send /> Submit
          </Button>
        </div>
      </form>
    </div>
  )
}

// ---------- files ----------
type FileLink = { name: string; url: string }

export function FilesView({ board, items }: Props) {
  const users = useStore((s) => s.user)
  const fileCols = board.columns.filter((c) => c.type === 'files')
  const rows = useMemo(
    () =>
      items.flatMap((it) =>
        fileCols.flatMap((c) => ((it.values[c.id] as FileLink[] | undefined) ?? []).map((f, n) => ({ key: `${it.id}-${c.id}-${n}`, f, it, col: c }))),
      ),
    [items, fileCols],
  )
  if (!fileCols.length)
    return (
      <EmptyView icon={<Paperclip />} title="No Files column yet">
        Add a Files column to this board and attach links to items. They all collect here.
      </EmptyView>
    )
  if (!rows.length)
    return (
      <EmptyView icon={<Paperclip />} title="No files attached">
        Open an item’s Files cell and add a link to a document in your shared drive.
      </EmptyView>
    )
  return (
    <div className="h-full overflow-y-auto px-6 pb-10 pt-2 sm:px-8">
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[640px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b-2 border-fg">
              {['File', 'Item', 'Column', 'Added by'].map((h) => (
                <th key={h} className="caps h-9 px-3 text-left text-[12px] font-semibold tracking-[0.14em]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, f, it, col }) => (
              <tr key={key} className="border-b border-line last:border-0 hover:bg-hover">
                <td className="px-3 py-2">
                  <a href={f.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2 font-medium text-accent hover:underline">
                    <Paperclip className="size-3.5 shrink-0" /> {f.name} <ExternalLink className="size-3 opacity-60" />
                  </a>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => openItem(it.id)} className="truncate text-left hover:underline">
                    {it.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted">{col.title}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 text-[13px] text-muted">
                    <Avatar user={users[it.updatedBy ?? it.createdBy]} size={20} />
                    {format(it.updatedAt ?? it.createdAt, 'd MMM').toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

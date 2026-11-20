import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { updateBoard, useStore } from '../lib/store'
import { uid } from '../lib/seed'
import type { Automation, AutomationAction, AutomationTrigger, Board } from '../lib/types'
import { Modal } from './TemplateModal'
import { cx } from './ui'

const sel = 'h-8 max-w-[190px] rounded-md border border-line bg-panel px-2 text-[13.5px] font-medium text-fg outline-none hover:border-line-strong focus:border-accent focus:ring-1 focus:ring-accent'

/** The fixed words of a rule sentence: WHEN … THEN … */
function Word({ children }: { children: ReactNode }) {
  return <span className="caps shrink-0 text-[14px] font-bold tracking-[0.14em]">{children}</span>
}

const RECIPES: { name: string; make: (b: Board) => Automation | null }[] = [
  {
    name: 'When status is done, move item to a group',
    make: (b) => {
      const s = b.columns.find((c) => c.type === 'status')
      const done = s?.labels?.find((l) => l.done) ?? s?.labels?.at(-1)
      const g = b.groups.at(-1)
      return s && done && g ? { id: uid('au_'), enabled: true, trigger: { kind: 'status_changes', columnId: s.id, labelId: done.id }, action: { kind: 'move_to_group', groupId: g.id } } : null
    },
  },
  {
    name: 'When status is stuck, notify the owner',
    make: (b) => {
      const s = b.columns.find((c) => c.type === 'status')
      const stuck = s?.labels?.find((l) => /stuck|block/i.test(l.name)) ?? s?.labels?.[0]
      return s && stuck ? { id: uid('au_'), enabled: true, trigger: { kind: 'status_changes', columnId: s.id, labelId: stuck.id }, action: { kind: 'notify', userId: '' } } : null
    },
  },
  {
    name: 'When an item is created, assign me',
    make: (b) => {
      const p = b.columns.find((c) => c.type === 'people')
      const me = useStore.getState().meId
      return p ? { id: uid('au_'), enabled: true, trigger: { kind: 'item_created' }, action: { kind: 'assign', columnId: p.id, userId: me } } : null
    },
  },
  {
    name: 'Every weekday, a dated task-tracking item (Mon–Fri)',
    make: (b) => {
      const g = b.groups.find((x) => !x.archived && !x.deletedAt)
      return g ? { id: uid('au_'), enabled: true, trigger: { kind: 'recurring', every: 'weekdays', groupId: g.id, name: 'Task tracking {date}' }, action: { kind: 'none' } } : null
    },
  },
  {
    name: 'Every Monday, create a weekly check-in',
    make: (b) => {
      const g = b.groups.find((x) => !x.archived && !x.deletedAt)
      return g ? { id: uid('au_'), enabled: true, trigger: { kind: 'recurring', every: 'monday', groupId: g.id, name: 'Weekly check-in {date}' }, action: { kind: 'none' } } : null
    },
  },
  {
    name: 'One day before the date, notify assignees',
    make: (b) => {
      const d = b.columns.find((c) => c.type === 'date')
      return d ? { id: uid('au_'), enabled: true, trigger: { kind: 'before_date', columnId: d.id, days: 1 }, action: { kind: 'notify', userId: '' } } : null
    },
  },
  {
    name: 'When the date arrives, notify assignees',
    make: (b) => {
      const d = b.columns.find((c) => c.type === 'date')
      return d ? { id: uid('au_'), enabled: true, trigger: { kind: 'date_arrives', columnId: d.id }, action: { kind: 'notify', userId: '' } } : null
    },
  },
]

export function Automations({ board, open, onClose }: { board: Board; open: boolean; onClose: () => void }) {
  const save = (list: Automation[]) => updateBoard(board.id, { automations: list })
  const patch = (id: string, p: Partial<Automation>) => save(board.automations.map((a) => (a.id === id ? { ...a, ...p } : a)))
  return (
    <Modal open={open} onClose={onClose} title="Automations" width={800}>
      <div className="p-6">
        <p className="mb-4 text-[14px] text-muted">Let the board do the busywork. Rules run instantly for everyone on the team.</p>
        <h3 className="caps mb-2 text-[15px] font-bold tracking-[0.1em]">
          Rules <span className="ml-1 font-mono text-[12px] font-medium normal-case tracking-normal text-muted">{board.automations.length}</span>
        </h3>
        <ul className="rounded-lg border border-line bg-panel">
          {board.automations.map((a) => (
            <li key={a.id} className="flex items-start gap-3 border-b border-line px-4 py-3 text-[14px] last:border-b-0">
              <div className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5', !a.enabled && 'opacity-55')}>
                <TriggerEditor
                  board={board}
                  value={a.trigger}
                  // a schedule only creates the item unless told otherwise
                  onChange={(trigger) => patch(a.id, trigger.kind === 'recurring' && a.trigger.kind !== 'recurring' ? { trigger, action: { kind: 'none' } } : { trigger })}
                />
                <Word>Then</Word>
                <ActionEditor board={board} value={a.action} recurring={a.trigger.kind === 'recurring'} onChange={(action) => patch(a.id, { action })} />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  role="switch"
                  aria-checked={a.enabled}
                  aria-label="Enable automation"
                  title={a.enabled ? 'On' : 'Off'}
                  onClick={() => patch(a.id, { enabled: !a.enabled })}
                  className={cx('relative h-5 w-9 rounded-sm transition-colors', a.enabled ? 'bg-fg' : 'bg-line-strong')}
                >
                  <span className={cx('absolute left-0.5 top-0.5 size-4 rounded-[2px] bg-panel transition-transform duration-[120ms]', a.enabled && 'translate-x-4')} />
                </button>
                <button
                  onClick={() => save(board.automations.filter((x) => x.id !== a.id))}
                  aria-label="Delete automation"
                  className="grid size-8 place-items-center rounded-md text-faint transition-colors hover:bg-alert-soft hover:text-alert"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
          {!board.automations.length && <li className="px-4 py-6 text-[14px] text-muted">No automations yet. Start from a recipe below.</li>}
        </ul>

        <h3 className="caps mb-2 mt-8 text-[15px] font-bold tracking-[0.1em]">Recipes</h3>
        <ul className="rounded-lg border border-line bg-panel">
          {RECIPES.map((r) => {
            const sample = r.make(board)
            return (
              <li key={r.name} className="border-b border-line last:border-b-0">
                <button
                  disabled={!sample}
                  onClick={() => sample && save([...board.automations, sample])}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus className="size-4 shrink-0 text-muted group-hover:text-fg" />
                  <span className="flex-1">{r.name}</span>
                  <span className="caps text-[12px] font-semibold tracking-[0.12em] text-muted group-hover:text-fg">Add</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}

function TriggerEditor({ board, value, onChange }: { board: Board; value: AutomationTrigger; onChange: (t: AutomationTrigger) => void }) {
  const statusCols = board.columns.filter((c) => c.type === 'status')
  const dateCols = board.columns.filter((c) => c.type === 'date')
  const peopleCols = board.columns.filter((c) => c.type === 'people')
  const groups = board.groups.filter((g) => !g.archived && !g.deletedAt)
  return (
    <>
      <Word>When</Word>
      <select
        aria-label="Trigger"
        className={sel}
        value={value.kind}
        onChange={(e) => {
          const k = e.target.value as AutomationTrigger['kind']
          if (k === 'item_created') onChange({ kind: k })
          if (k === 'status_changes' && statusCols[0]) onChange({ kind: k, columnId: statusCols[0].id, labelId: statusCols[0].labels?.[0]?.id ?? '' })
          if (k === 'date_arrives' && dateCols[0]) onChange({ kind: k, columnId: dateCols[0].id })
          if (k === 'before_date' && dateCols[0]) onChange({ kind: k, columnId: dateCols[0].id, days: 1 })
          if (k === 'column_changes') onChange({ kind: k, columnId: '' })
          if (k === 'person_assigned' && peopleCols[0]) onChange({ kind: k, columnId: peopleCols[0].id })
          if (k === 'recurring' && groups[0]) onChange({ kind: k, every: 'monday', groupId: groups[0].id, name: 'Weekly check-in {date}' })
        }}
      >
        <option value="status_changes">a status changes</option>
        <option value="column_changes">a column changes</option>
        <option value="item_created">an item is created</option>
        {peopleCols.length > 0 && <option value="person_assigned">a person is assigned</option>}
        <option value="date_arrives">a date arrives</option>
        <option value="before_date">days before a date</option>
        <option value="recurring">on a schedule</option>
      </select>
      {value.kind === 'column_changes' && (
        <select aria-label="Column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
          <option value="">any column</option>
          {board.columns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
      {value.kind === 'person_assigned' && (
        <>
          <span className="text-muted">in</span>
          <select aria-label="People column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
            {peopleCols.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </>
      )}
      {value.kind === 'before_date' && (
        <>
          <input aria-label="Days before" type="number" min={1} max={365} className={cx(sel, 'w-16')} value={value.days} onChange={(e) => onChange({ ...value, days: Math.max(1, Number(e.target.value) || 1) })} />
          <select aria-label="Date column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
            {dateCols.map((c) => (
              <option key={c.id} value={c.id}>before {c.title}</option>
            ))}
          </select>
        </>
      )}
      {value.kind === 'recurring' && (
        <>
          <select aria-label="Every" className={sel} value={value.every} onChange={(e) => onChange({ ...value, every: e.target.value as 'day' | 'monday' | 'weekdays' })}>
            <option value="day">every day</option>
            <option value="weekdays">every weekday (Mon–Fri)</option>
            <option value="monday">every Monday</option>
          </select>
          <span className="text-muted">create</span>
          <input aria-label="Item name" title="{date} becomes today's date" className={cx(sel, 'w-44')} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          <span className="text-muted">in</span>
          <select aria-label="Group" className={sel} value={value.groupId} onChange={(e) => onChange({ ...value, groupId: e.target.value })}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
          <span className="text-muted">with meeting link</span>
          <input
            aria-label="Meeting link"
            type="url"
            placeholder="https://meet.google.com/… (optional)"
            title="Added to each item in a Meeting link column, with a Join button on the calendar"
            className={cx(sel, 'w-60', value.link && !/^https:\/\/\S+$/.test(value.link.trim()) && 'border-alert')}
            value={value.link ?? ''}
            onChange={(e) => onChange({ ...value, link: e.target.value || undefined })}
          />
          {value.every === 'weekdays' && <span className="basis-full text-[12.5px] text-faint">Creates the week’s Monday–Friday items in one go, each dated, so they show on the calendar. Weekends stay empty.</span>}
        </>
      )}
      {value.kind === 'status_changes' && (
        <>
          <select aria-label="Status column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value, labelId: statusCols.find((c) => c.id === e.target.value)?.labels?.[0]?.id ?? '' })}>
            {statusCols.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <span className="text-muted">to</span>
          <select aria-label="Status label" className={sel} value={value.labelId} onChange={(e) => onChange({ ...value, labelId: e.target.value })}>
            {statusCols.find((c) => c.id === value.columnId)?.labels?.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </>
      )}
      {value.kind === 'date_arrives' && (
        <select aria-label="Date column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
          {dateCols.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
    </>
  )
}

function ActionEditor({ board, value, onChange, recurring }: { board: Board; value: AutomationAction; onChange: (a: AutomationAction) => void; recurring: boolean }) {
  const users = useStore((s) => s.user)
  const boards = useStore((s) => s.board)
  const statusCols = board.columns.filter((c) => c.type === 'status')
  const peopleCols = board.columns.filter((c) => c.type === 'people')
  const dateCols = board.columns.filter((c) => c.type === 'date')
  const live = <T extends { archived?: boolean; deletedAt?: number }>(x: T) => !x.archived && !x.deletedAt
  const otherBoards = Object.values(boards).filter((b) => b.id !== board.id && live(b))
  const groupsOf = (b?: Board) => b?.groups.filter(live) ?? []
  const switchKind = (k: AutomationAction['kind']) => {
    if (k === 'move_to_group' && board.groups[0]) onChange({ kind: k, groupId: board.groups[0].id })
    if (k === 'notify') onChange({ kind: k, userId: '' })
    if (k === 'set_status' && statusCols[0]) onChange({ kind: k, columnId: statusCols[0].id, labelId: statusCols[0].labels?.[0]?.id ?? '' })
    if (k === 'assign' && peopleCols[0]) onChange({ kind: k, columnId: peopleCols[0].id, userId: Object.keys(users)[0] })
    if (k === 'set_date_today' && dateCols[0]) onChange({ kind: k, columnId: dateCols[0].id })
    if (k === 'create_in_board' && otherBoards[0]) onChange({ kind: k, boardId: otherBoards[0].id, groupId: groupsOf(otherBoards[0])[0]?.id ?? '' })
    if (k === 'clear_column' && board.columns[0]) onChange({ kind: k, columnId: board.columns[0].id })
    if (k === 'archive' || k === 'duplicate' || k === 'none') onChange({ kind: k })
  }
  return (
    <>
      <select aria-label="Action" className={sel} value={value.kind} onChange={(e) => switchKind(e.target.value as AutomationAction['kind'])}>
        {recurring && <option value="none">nothing else</option>}
        <option value="move_to_group">move item to group</option>
        <option value="notify">notify</option>
        <option value="set_status">set status</option>
        {peopleCols.length > 0 && <option value="assign">assign</option>}
        {dateCols.length > 0 && <option value="set_date_today">set date to today</option>}
        {otherBoards.length > 0 && <option value="create_in_board">create an item in board</option>}
        <option value="duplicate">duplicate item</option>
        <option value="archive">archive item</option>
        <option value="clear_column">clear a column</option>
      </select>
      {value.kind === 'create_in_board' && (
        <>
          <select aria-label="Board" className={sel} value={value.boardId} onChange={(e) => onChange({ ...value, boardId: e.target.value, groupId: groupsOf(boards[e.target.value])[0]?.id ?? '' })}>
            {otherBoards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select aria-label="Group" className={sel} value={value.groupId} onChange={(e) => onChange({ ...value, groupId: e.target.value })}>
            {groupsOf(boards[value.boardId]).map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </>
      )}
      {value.kind === 'clear_column' && (
        <select aria-label="Column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
          {board.columns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
      {value.kind === 'move_to_group' && (
        <select aria-label="Group" className={sel} value={value.groupId} onChange={(e) => onChange({ ...value, groupId: e.target.value })}>
          {board.groups.map((g) => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      )}
      {value.kind === 'notify' && (
        <select aria-label="Who" className={sel} value={value.userId} onChange={(e) => onChange({ ...value, userId: e.target.value })}>
          <option value="">the assignees</option>
          {Object.values(users).filter((u) => !u.removedAt).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      )}
      {value.kind === 'set_status' && (
        <select aria-label="Label" className={sel} value={value.labelId} onChange={(e) => onChange({ ...value, labelId: e.target.value })}>
          {statusCols.find((c) => c.id === value.columnId)?.labels?.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}
      {value.kind === 'assign' && (
        <select aria-label="Person" className={sel} value={value.userId} onChange={(e) => onChange({ ...value, userId: e.target.value })}>
          {Object.values(users).filter((u) => !u.removedAt).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      )}
      {value.kind === 'set_date_today' && (
        <select aria-label="Date column" className={sel} value={value.columnId} onChange={(e) => onChange({ ...value, columnId: e.target.value })}>
          {dateCols.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
    </>
  )
}

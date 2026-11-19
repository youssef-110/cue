import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, Zap, ArrowRight } from 'lucide-react'
import { updateBoard, useStore } from '../lib/store'
import { uid } from '../lib/seed'
import type { Automation, AutomationAction, AutomationTrigger, Board } from '../lib/types'
import { Modal } from './TemplateModal'
import { cx } from './ui'

const sel = 'h-8 max-w-[180px] rounded-lg border border-line bg-panel px-2 text-[13px] font-medium text-accent outline-none focus:border-accent'

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
    <Modal open={open} onClose={onClose} title="Automations" width={760}>
      <div className="p-6">
        <p className="mb-4 text-[13.5px] text-muted">Let the board do the busywork. Rules run instantly for everyone on the team.</p>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {board.automations.map((a) => (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className={cx('flex flex-wrap items-center gap-2 rounded-xl border p-3.5 text-[13.5px] transition', a.enabled ? 'border-line bg-panel shadow-card' : 'border-dashed border-line bg-panel-2 opacity-70')}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-amber-400/15 text-amber-500">
                  <Zap className="size-4" />
                </span>
                <TriggerEditor board={board} value={a.trigger} onChange={(trigger) => patch(a.id, { trigger })} />
                <ArrowRight className="size-4 text-faint" />
                <ActionEditor board={board} value={a.action} onChange={(action) => patch(a.id, { action })} />
                <div className="ml-auto flex items-center gap-1">
                  <button
                    role="switch"
                    aria-checked={a.enabled}
                    aria-label="Enable automation"
                    onClick={() => patch(a.id, { enabled: !a.enabled })}
                    className={cx('relative h-5 w-9 rounded-full transition-colors', a.enabled ? 'bg-accent' : 'bg-line-strong')}
                  >
                    <motion.span layout className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow', a.enabled ? 'right-0.5' : 'left-0.5')} />
                  </button>
                  <button onClick={() => save(board.automations.filter((x) => x.id !== a.id))} aria-label="Delete automation" className="grid size-8 place-items-center rounded-lg text-faint hover:bg-hover hover:text-red-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {!board.automations.length && <div className="rounded-xl border border-dashed border-line-strong p-6 text-center text-[13.5px] text-muted">No automations yet — start from a recipe below.</div>}
        </div>

        <h3 className="mb-3 mt-7 text-[12px] font-semibold uppercase tracking-wide text-faint">Recipes</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {RECIPES.map((r) => {
            const sample = r.make(board)
            return (
              <button
                key={r.name}
                disabled={!sample}
                onClick={() => sample && save([...board.automations, sample])}
                className="group flex items-center gap-3 rounded-xl border border-line p-3 text-left text-[13px] transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
                  <Plus className="size-4" />
                </span>
                {r.name}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

function TriggerEditor({ board, value, onChange }: { board: Board; value: AutomationTrigger; onChange: (t: AutomationTrigger) => void }) {
  const statusCols = board.columns.filter((c) => c.type === 'status')
  const dateCols = board.columns.filter((c) => c.type === 'date')
  return (
    <>
      <span className="text-muted">When</span>
      <select
        aria-label="Trigger"
        className={sel}
        value={value.kind}
        onChange={(e) => {
          const k = e.target.value as AutomationTrigger['kind']
          if (k === 'item_created') onChange({ kind: k })
          if (k === 'status_changes' && statusCols[0]) onChange({ kind: k, columnId: statusCols[0].id, labelId: statusCols[0].labels?.[0]?.id ?? '' })
          if (k === 'date_arrives' && dateCols[0]) onChange({ kind: k, columnId: dateCols[0].id })
        }}
      >
        <option value="status_changes">a status changes</option>
        <option value="item_created">an item is created</option>
        <option value="date_arrives">a date arrives</option>
      </select>
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

function ActionEditor({ board, value, onChange }: { board: Board; value: AutomationAction; onChange: (a: AutomationAction) => void }) {
  const users = useStore((s) => s.user)
  const statusCols = board.columns.filter((c) => c.type === 'status')
  const peopleCols = board.columns.filter((c) => c.type === 'people')
  const dateCols = board.columns.filter((c) => c.type === 'date')
  const switchKind = (k: AutomationAction['kind']) => {
    if (k === 'move_to_group' && board.groups[0]) onChange({ kind: k, groupId: board.groups[0].id })
    if (k === 'notify') onChange({ kind: k, userId: '' })
    if (k === 'set_status' && statusCols[0]) onChange({ kind: k, columnId: statusCols[0].id, labelId: statusCols[0].labels?.[0]?.id ?? '' })
    if (k === 'assign' && peopleCols[0]) onChange({ kind: k, columnId: peopleCols[0].id, userId: Object.keys(users)[0] })
    if (k === 'set_date_today' && dateCols[0]) onChange({ kind: k, columnId: dateCols[0].id })
  }
  return (
    <>
      <select aria-label="Action" className={sel} value={value.kind} onChange={(e) => switchKind(e.target.value as AutomationAction['kind'])}>
        <option value="move_to_group">move item to group</option>
        <option value="notify">notify</option>
        <option value="set_status">set status</option>
        {peopleCols.length > 0 && <option value="assign">assign</option>}
        {dateCols.length > 0 && <option value="set_date_today">set date to today</option>}
      </select>
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
          {Object.values(users).map((u) => (
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
          {Object.values(users).map((u) => (
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

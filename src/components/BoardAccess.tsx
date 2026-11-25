import { useEffect, useState } from 'react'
import { Loader2, Lock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PUBLIC, isPrivate, setBoardAccess, useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { saveBoardAccess, useMembers } from '../lib/team'
import type { Board } from '../lib/types'
import { Modal } from './TemplateModal'
import { Avatar, Button, cx } from './ui'

/** Who may change access: the board's creator, or an admin. */
export const canManageAccess = (b: Pick<Board, 'createdBy'>, meId: string, isAdmin: boolean) => isAdmin || b.createdBy === meId

type Shared = Pick<Board, 'id' | 'name' | 'readers' | 'createdBy'>
/** Who sees a board (or, with `onSave`, any other shared document such as a KPI board). */
export function BoardAccess({
  board, open, onClose, onSave, title = 'Board access', noun = 'board', privateHint,
}: {
  board: Shared
  open: boolean
  onClose: () => void
  onSave?: (readers: string[]) => Promise<void> | void
  title?: string
  noun?: string
  privateHint?: string
}) {
  const meId = useStore((s) => s.meId)
  const isAdmin = useStore((s) => s.isAdmin)
  const users = useStore((s) => s.user)
  const members = useMembers()
  // team mode lists real logins; local mode lists the profiles on this device
  const people = auth ? members.map((m) => ({ id: m.uid, name: m.name, admin: m.role === 'admin' })) : Object.values(users).map((u) => ({ id: u.id, name: u.name, admin: false }))
  const [priv, setPriv] = useState(isPrivate(board))
  const [picked, setPicked] = useState<Set<string>>(new Set(board.readers ?? []))
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setPriv(isPrivate(board))
    setPicked(new Set(board.readers?.includes('*') ? [meId] : (board.readers ?? [meId])))
  }, [open, board, meId])
  const manage = canManageAccess(board, meId, isAdmin)

  const save = async () => {
    setBusy(true)
    try {
      const readers = priv ? [...new Set([meId, ...picked])] : PUBLIC
      await (onSave ? onSave(readers) : setBoardAccess(board.id, readers, auth ? saveBoardAccess : undefined))
      toast.success(priv ? `${board.name} is private` : `${board.name} is open to the whole team`)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  const option = (value: boolean, icon: React.ReactNode, title: string, hint: string) => (
    <label className={cx('flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors', priv === value ? 'border-fg bg-panel-2' : 'border-line hover:bg-hover', !manage && 'cursor-default')}>
      <input type="radio" name="access" className="mt-1" checked={priv === value} disabled={!manage} onChange={() => setPriv(value)} />
      <span className="mt-0.5 text-muted [&>svg]:size-4">{icon}</span>
      <span>
        <span className="block text-[14.5px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted">{hint}</span>
      </span>
    </label>
  )

  return (
    <Modal open={open} onClose={onClose} title={title} width={520}>
      <div className="space-y-3 p-6">
        {option(false, <Users />, 'Whole team', `Everyone with a login can see this ${noun}.`)}
        {option(true, <Lock />, 'Private', privateHint ?? 'Only the people you pick can see this board, its items, updates and docs. Admins can always open it.')}
        {priv && (
          <fieldset className="rounded-md border border-line">
            <legend className="caps ml-3 px-1 text-[12px] font-semibold tracking-[0.12em] text-muted">Who can see it</legend>
            <ul className="max-h-64 overflow-auto p-1">
              {people.map((p) => {
                const self = p.id === meId
                const on = self || picked.has(p.id)
                return (
                  <li key={p.id}>
                    <label className={cx('flex h-10 items-center gap-3 rounded-sm px-2 text-[14px]', manage && !self && 'cursor-pointer hover:bg-hover')}>
                      <input
                        type="checkbox"
                        checked={on || p.admin}
                        disabled={!manage || self || p.admin}
                        onChange={(e) => setPicked((s) => (e.target.checked ? new Set([...s, p.id]) : new Set([...s].filter((x) => x !== p.id))))}
                      />
                      <Avatar user={users[p.id]} size={24} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-[12.5px] text-faint">{self ? 'You' : p.admin ? 'Admin, always' : ''}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )}
        {!manage && <p className="text-[13px] text-faint">Only the person who made this {noun}, or an admin, can change who sees it.</p>}
      </div>
      {manage && (
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Save access
          </Button>
        </div>
      )}
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { Loader2, Lock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PUBLIC, isPrivate, setBoardAccess, useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { saveBoardAccess, useMembers } from '../lib/team'
import type { Board } from '../lib/types'
import { Modal } from './TemplateModal'
import { Avatar, Button, cx } from './ui'

/** Who may change access: the board's creator, or an admin (older boards without a creator: any editor). */
export const canManageAccess = (b: Board, meId: string, isAdmin: boolean) => isAdmin || !b.createdBy || b.createdBy === meId

export function BoardAccess({ board, open, onClose }: { board: Board; open: boolean; onClose: () => void }) {
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
      await setBoardAccess(board.id, priv ? [...picked] : PUBLIC, auth ? saveBoardAccess : undefined)
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
    <Modal open={open} onClose={onClose} title="Board access" width={520}>
      <div className="space-y-3 p-6">
        {option(false, <Users />, 'Whole team', 'Everyone with a login can see this board.')}
        {option(true, <Lock />, 'Private', 'Only the people you pick can see this board, its items, updates and docs. Admins can always open it.')}
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
        {!manage && <p className="text-[13px] text-faint">Only the person who made this board, or an admin, can change who sees it.</p>}
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

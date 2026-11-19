import { useState } from 'react'
import { Copy, KeyRound, Loader2, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { USERNAME_RE, createAccount, normalizeUsername, removeAccount, resetPassword, setRole, tempPassword, useMembers, type Member, type Role } from '../lib/team'
import { auth } from '../lib/sync'
import { useStore } from '../lib/store'
import { Modal } from './TemplateModal'
import { Button, cx } from './ui'

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', member: 'Member', viewer: 'Viewer' }
const ROLE_HINT: Record<Role, string> = {
  admin: 'Edits everything and manages logins',
  member: 'Edits boards and items',
  viewer: 'Reads and comments only',
}
const field = 'h-9 min-w-0 rounded-md border border-line bg-panel px-3 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent'
const head = 'caps h-9 px-3 text-left text-[12px] font-semibold tracking-[0.14em] text-fg'

/** One-time display of a login so the admin can pass it on: a yellow ticket. */
function Credentials({ username, password, onDone }: { username: string; password: string; onDone: () => void }) {
  const text = `Cue login\nAddress: ${location.href.split('#')[0]}\nUsername: ${username}\nTemporary password: ${password}\nYou'll choose your own password when you first sign in.`
  return (
    <div role="status" className="mb-6 overflow-hidden rounded-lg border border-on-signal bg-signal text-on-signal">
      <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-4">
        <h3 className="caps text-[20px] font-bold leading-none">Login ticket</h3>
        <span className="font-mono text-[11.5px] font-medium">SHOWN ONCE</span>
      </div>
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 border-y border-dashed border-on-signal/50 px-5 py-4">
        <dt className="caps text-[12px] font-semibold tracking-[0.14em]">Username</dt>
        <dd className="select-all font-mono text-[16px] font-semibold">{username}</dd>
        <dt className="caps text-[12px] font-semibold tracking-[0.14em]">Password</dt>
        <dd className="select-all font-mono text-[16px] font-semibold">{password}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <p className="mr-auto text-[13px]">Give these to them. They replace the password at first sign-in.</p>
        <button
          onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Login copied'))}
          className="flex h-8 items-center gap-1.5 rounded-md bg-on-signal px-3 text-[13px] font-semibold text-signal hover:bg-on-signal/85"
        >
          <Copy className="size-4" /> Copy login
        </button>
        <button onClick={onDone} className="h-8 rounded-md px-3 text-[13px] font-medium hover:bg-on-signal/10">
          Done
        </button>
      </div>
    </div>
  )
}

export function TeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useMembers()
  const isAdmin = useStore((s) => s.isAdmin)
  const myUid = auth?.currentUser?.uid
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setNewRole] = useState<Role>('member')
  const [busy, setBusy] = useState<string | null>(null)
  const [shown, setShown] = useState<{ username: string; password: string } | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(null)
  }

  const add = () =>
    run('add', async () => {
      const u = normalizeUsername(username)
      if (!USERNAME_RE.test(u)) throw new Error('Usernames use 2–32 lowercase letters, digits, dots, dashes or underscores.')
      const password = tempPassword()
      await createAccount({ username: u, name: name.trim(), password, role })
      setShown({ username: u, password })
      setName('')
      setUsername('')
    })

  const reset = (m: Member) =>
    run(m.uid, async () => {
      const password = tempPassword()
      await resetPassword(m.uid, password)
      setShown({ username: m.username, password })
    })

  return (
    <Modal open={open} onClose={() => (setShown(null), onClose())} title="Team" width={720}>
      <div className="p-6">
        {shown && <Credentials {...shown} onDone={() => setShown(null)} />}

        {isAdmin && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
            className="mb-6"
          >
            <h3 className="caps mb-2 text-[15px] font-bold tracking-[0.1em]">New login</h3>
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" className={field} />
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="username"
                aria-label="Username"
                autoCapitalize="none"
                spellCheck={false}
                className={cx(field, 'font-mono text-[13px]')}
              />
              <select value={role} onChange={(e) => setNewRole(e.target.value as Role)} aria-label="Role" title={ROLE_HINT[role]} className={field}>
                {(['member', 'viewer', 'admin'] as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <Button variant="primary" disabled={busy === 'add'} className="h-9 px-4">
                {busy === 'add' ? <Loader2 className="animate-spin" /> : <UserPlus />} Create login
              </Button>
            </div>
            <p className="mt-1.5 text-[12.5px] text-faint">{ROLE_HINT[role]}.</p>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b-2 border-fg">
                <th className={head}>Person</th>
                <th className={head}>Username</th>
                <th className={head}>Role</th>
                {isAdmin && <th className={cx(head, 'text-right')}>Access</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const self = m.uid === myUid
                return (
                  <tr key={m.uid} className="border-b border-line last:border-0 hover:bg-hover">
                    <td className="px-3 py-2.5">
                      <span className="block font-medium">
                        {m.name} {self && <span className="font-normal text-faint">(you)</span>}
                      </span>
                      <span className="text-[12.5px] text-faint">Added {formatDistanceToNow(m.addedAt, { addSuffix: true })}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px]">{m.username}</td>
                    <td className="px-3 py-2.5">
                      {isAdmin && !self ? (
                        <select
                          value={m.role}
                          aria-label={`Role for ${m.name}`}
                          title={ROLE_HINT[m.role]}
                          onChange={(e) => run(m.uid, () => setRole(m.uid, e.target.value as Role))}
                          className="h-8 rounded-md border border-line bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        >
                          {(['admin', 'member', 'viewer'] as Role[]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span title={ROLE_HINT[m.role]} className="caps inline-block rounded-sm border border-line-strong px-1.5 pb-px pt-0.5 text-[12px] font-semibold tracking-[0.1em]">
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2.5 text-right">
                        {!self && (
                          <span className="inline-flex gap-1">
                            <button
                              onClick={() => reset(m)}
                              disabled={busy === m.uid}
                              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-panel-2 hover:text-fg disabled:opacity-50"
                            >
                              {busy === m.uid ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />} Reset password
                            </button>
                            <button
                              onClick={() => confirmRemove(m) && run(m.uid, () => removeAccount(m.uid).then(() => toast(`${m.name} no longer has access`)))}
                              aria-label={`Remove ${m.name}`}
                              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-alert transition-colors hover:bg-alert-soft"
                            >
                              <Trash2 className="size-3.5" /> Remove
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!isAdmin && <p className="mt-4 text-[13px] text-faint">Only admins can create logins or reset passwords.</p>}
      </div>
    </Modal>
  )
}

// shortcut: native confirm for an irreversible removal; swap for the app dialog when one exists for yes/no
const confirmRemove = (m: Member) => window.confirm(`Remove ${m.name} (${m.username})? Their login stops working immediately. Their past work stays.`)

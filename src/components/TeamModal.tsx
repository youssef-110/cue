import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Copy, Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { addMember, myEmail, removeMember, setRole, useMembers, type Role } from '../lib/team'
import { useStore } from '../lib/store'
import { Modal } from './TemplateModal'
import { cx } from './ui'

export function TeamModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useMembers()
  const isAdmin = useStore((s) => s.isAdmin)
  const [email, setEmail] = useState('')
  const [role, setNewRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const me = myEmail()
  const link = location.href.split('#')[0]

  const add = async () => {
    setBusy(true)
    try {
      await addMember(email, role)
      toast.success(`${email.trim()} can now join`, { description: 'Send them the app link — they create an account with that email.' })
      setEmail('')
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Team" width={620}>
      <div className="p-6">
        {isAdmin && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
            className="mb-5 flex gap-2"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              aria-label="Teammate email"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-[14px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <select value={role} onChange={(e) => setNewRole(e.target.value as Role)} aria-label="Role" className="h-10 rounded-xl border border-line bg-panel px-2 text-[13px] outline-none focus:border-accent">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button disabled={busy} className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13.5px] font-medium text-white hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add
            </button>
          </form>
        )}

        <div className="mb-5 flex items-center gap-2 rounded-xl bg-panel-2 px-3 py-2.5 text-[12.5px] text-muted">
          <span className="flex-1">
            New teammates open <span className="font-medium text-fg">{link}</span> and choose <span className="font-medium text-fg">Create account</span> with the email you added.
          </span>
          <button onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))} aria-label="Copy app link" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-hover">
            <Copy className="size-4" />
          </button>
        </div>

        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          <AnimatePresence initial={false}>
            {members.map((m) => (
              <motion.li key={m.email} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 bg-panel px-4 py-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold uppercase text-accent">{m.email[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">
                    {m.email} {m.email === me && <span className="text-[12px] font-normal text-faint">(you)</span>}
                  </span>
                  <span className="text-[12px] text-faint">Added {formatDistanceToNow(m.addedAt, { addSuffix: true })}</span>
                </span>
                {isAdmin && m.email !== me ? (
                  <>
                    <select
                      value={m.role}
                      aria-label={`Role for ${m.email}`}
                      onChange={(e) => setRole(m.email, e.target.value as Role).catch((err) => toast.error(err.message))}
                      className="h-8 rounded-lg border border-line bg-panel px-2 text-[12.5px] outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.email).then(() => toast(`${m.email} removed from the team`)).catch((err) => toast.error(err.message))}
                      aria-label={`Remove ${m.email}`}
                      className="grid size-8 place-items-center rounded-lg text-faint hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                ) : (
                  <span className={cx('flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium', m.role === 'admin' ? 'bg-accent-soft text-accent' : 'bg-panel-2 text-muted')}>
                    {m.role === 'admin' && <ShieldCheck className="size-3.5" />}
                    {m.role === 'admin' ? 'Admin' : 'Member'}
                  </span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {!isAdmin && <p className="mt-4 text-[12.5px] text-faint">Only admins can add or remove people.</p>}
      </div>
    </Modal>
  )
}

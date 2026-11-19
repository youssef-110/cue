import { useEffect, useState } from 'react'
import { Loader2, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'
import { updateUser, useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { sendTestEmail } from '../lib/team'
import { COLOR_LIST } from '../lib/seed'
import { Modal } from './TemplateModal'
import { Avatar, Button, cx } from './ui'

const FIELD = 'h-10 w-full rounded-md border border-line-strong bg-panel px-3 text-[14.5px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const LABEL = 'caps mb-1 block text-[12.5px] font-semibold tracking-[0.12em] text-muted'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Your name, colour and where your notifications go. */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.user[s.meId])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('')
  const [email, setEmail] = useState('')
  const [notify, setNotify] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (!open || !me) return
    setName(me.name)
    setTitle(me.title ?? '')
    setColor(me.color)
    setEmail(me.email ?? '')
    setNotify(!!me.emailNotify)
  }, [open, me])
  if (!me) return null
  const emailOk = !email || EMAIL_RE.test(email.trim())

  const save = () => {
    if (!name.trim() || !emailOk) return
    updateUser(me.id, { name: name.trim(), title: title.trim() || undefined, color, email: email.trim() || undefined, emailNotify: !!email.trim() && notify })
    toast.success('Profile saved')
    onClose()
  }
  const test = async () => {
    save()
    setTesting(true)
    try {
      await new Promise((r) => setTimeout(r, 800)) // shortcut: let the profile write land before the server reads it
      const r = await sendTestEmail()
      toast.success(`Test email sent to ${r.to}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
    setTesting(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Your profile" width={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-4">
            <Avatar user={{ ...me, name: name || me.name, color }} size={48} />
            <div className="flex flex-wrap gap-2">
              {COLOR_LIST.slice(0, 10).map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label="Pick colour"
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                  className={cx('size-6 rounded-full ring-offset-2 ring-offset-panel', c === color ? 'ring-2 ring-fg' : 'hover:ring-1 hover:ring-line-strong')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-name" className={LABEL}>
                Name
              </label>
              <input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label htmlFor="p-title" className={LABEL}>
                Job title
              </label>
              <input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </div>
          </div>

          <fieldset className="rounded-md border border-line p-4">
            <legend className="caps px-1 text-[12.5px] font-semibold tracking-[0.12em] text-muted">Email notifications</legend>
            <label htmlFor="p-email" className={LABEL}>
              Your email
            </label>
            <input
              id="p-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={!emailOk || undefined}
              className={cx(FIELD, !emailOk && 'border-alert')}
            />
            {!emailOk && <p className="mt-1 text-[12.5px] text-alert">That doesn’t look like an email address.</p>}
            <label className={cx('mt-3 flex items-start gap-3 text-[14px]', !email.trim() && 'opacity-50')}>
              <input type="checkbox" className="mt-1 size-4" disabled={!email.trim()} checked={notify && !!email.trim()} onChange={(e) => setNotify(e.target.checked)} />
              <span>
                <span className="block font-medium">Email me my notifications</span>
                <span className="text-[13px] text-muted">When someone assigns you, mentions you, replies to you or an automation alerts you. Your Inbox still gets everything.</span>
              </span>
            </label>
            <p className="mt-3 text-[12.5px] text-faint">Your teammates can see this address on your profile.</p>
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
          {auth && (
            <Button type="button" variant="outline" onClick={test} disabled={!email.trim() || !emailOk || testing} className="mr-auto">
              {testing ? <Loader2 className="animate-spin" /> : <Mail />} Send a test email
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim() || !emailOk}>
            <Send /> Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

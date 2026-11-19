import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Loader2, Mail, MailCheck, RotateCw, Send, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { updateUser, useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { confirmEmail, disconnectEmail, sendTestEmail, startEmail, useMembers } from '../lib/team'
import { COLOR_LIST } from '../lib/seed'
import { Modal } from './TemplateModal'
import { Avatar, Button, cx } from './ui'

const FIELD = 'h-10 w-full rounded-md border border-line-strong bg-panel px-3 text-[14.5px] text-fg outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent'
const LABEL = 'caps mb-1 block text-[12.5px] font-semibold tracking-[0.12em] text-muted'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Your name, colour, title, and the email your notifications go to. */
export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.user[s.meId])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('')
  useEffect(() => {
    if (!open || !me) return
    setName(me.name)
    setTitle(me.title ?? '')
    setColor(me.color)
  }, [open, me])
  if (!me) return null

  const save = () => {
    if (!name.trim()) return
    updateUser(me.id, { name: name.trim(), title: title.trim() || undefined, color })
    toast.success('Profile saved')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Your profile" width={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <Avatar user={{ ...me, name: name || me.name, color }} size={56} />
            <div className="min-w-0">
              <p className="caps truncate text-[22px] font-bold leading-none">{name || me.name}</p>
              {me.username && <p className="mt-1 font-mono text-[12.5px] text-faint">@{me.username}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar colour">
                {COLOR_LIST.slice(0, 10).map((c) => (
                  <button
                    type="button"
                    key={c}
                    role="radio"
                    aria-label={`Colour ${c}`}
                    aria-checked={c === color}
                    onClick={() => setColor(c)}
                    className={cx('size-5 rounded-full ring-offset-2 ring-offset-panel transition-shadow', c === color ? 'ring-2 ring-fg' : 'hover:ring-1 hover:ring-line-strong')}
                    style={{ background: c }}
                  />
                ))}
              </div>
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
              <input id="p-title" value={title} placeholder="Optional" onChange={(e) => setTitle(e.target.value)} className={FIELD} />
            </div>
          </div>
          {auth ? <EmailPanel /> : <p className="rounded-md border border-line bg-panel-2 p-3 text-[13px] text-muted">Email notifications need team mode (a connected Firebase project).</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!name.trim()}>
            Save profile
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Connect an address with a 6-digit code, then switch email notifications on or off. */
function EmailPanel() {
  const me = useStore((s) => s.user[s.meId])
  const members = useMembers()
  const connected = members.find((m) => m.uid === auth?.currentUser?.uid)?.notifyEmail
  const [step, setStep] = useState<'idle' | 'code'>('idle')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error((e as Error).message)
    }
    setBusy(null)
  }
  const sendCode = () =>
    run('start', async () => {
      await startEmail(email.trim())
      setStep('code')
      setCode('')
      toast.success(`Code sent to ${email.trim()}`)
      setTimeout(() => codeRef.current?.focus(), 50)
    })
  const confirm = () =>
    run('confirm', async () => {
      const r = await confirmEmail(code)
      setStep('idle')
      setEmail('')
      toast.success(`${r.email} is connected`)
    })
  const notifyOn = !!me?.emailNotify

  return (
    <section aria-labelledby="email-h" className="overflow-hidden rounded-lg border border-line">
      <header className="flex items-center gap-2 border-b border-line bg-panel-2 px-4 py-2.5">
        <Mail className="size-4 text-muted" />
        <h3 id="email-h" className="caps text-[14px] font-bold tracking-[0.1em]">
          Email notifications
        </h3>
        {connected && (
          <span className="ml-auto flex items-center gap-1 rounded-sm bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold text-on-ink dark:bg-signal dark:text-on-signal">
            <Check className="size-3" /> CONNECTED
          </span>
        )}
      </header>

      <div className="p-4">
        {connected && step === 'idle' ? (
          <>
            <div className="flex items-center gap-3">
              <MailCheck className="size-5 shrink-0 text-fg" />
              <span className="min-w-0 flex-1 truncate font-mono text-[14px]">{connected}</span>
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-line px-3 py-2.5">
              <span>
                <span className="block text-[14px] font-medium">Email me my notifications</span>
                <span className="text-[12.5px] text-muted">Assignments, @mentions and replies. Your Inbox still gets everything.</span>
              </span>
              <Switch on={notifyOn} onChange={(v) => me && updateUser(me.id, { emailNotify: v })} label="Email me my notifications" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={busy === 'test'} onClick={() => run('test', async () => toast.success(`Test email sent to ${(await sendTestEmail()).to}`))}>
                {busy === 'test' ? <Loader2 className="animate-spin" /> : <Send />} Send a test email
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy === 'remove'}
                onClick={() => run('remove', async () => (await disconnectEmail(), toast(`${connected} is disconnected`)))}
                className="ml-auto"
              >
                {busy === 'remove' ? <Loader2 className="animate-spin" /> : <Unlink />} Disconnect
              </Button>
            </div>
          </>
        ) : step === 'idle' ? (
          <>
            <p className="text-[13.5px] text-muted">Get an email when someone assigns you, mentions you or replies to you. We send a 6-digit code to confirm the address is yours.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                aria-label="Your email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), EMAIL_RE.test(email.trim()) && sendCode())}
                className={FIELD}
              />
              <Button type="button" variant="primary" className="h-10 px-4" disabled={!EMAIL_RE.test(email.trim()) || busy === 'start'} onClick={sendCode}>
                {busy === 'start' ? <Loader2 className="animate-spin" /> : <Mail />} Send code
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13.5px] text-muted">
              Enter the 6-digit code we sent to <span className="font-medium text-fg">{email || 'your email'}</span>. It works for 15 minutes.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="Confirmation code"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), code.length === 6 && confirm())}
                className={cx(FIELD, 'h-12 text-center font-mono text-[24px] font-semibold tracking-[0.5em] placeholder:text-line-strong')}
              />
              <Button type="button" variant="primary" className="h-12 px-5" disabled={code.length !== 6 || busy === 'confirm'} onClick={confirm}>
                {busy === 'confirm' ? <Loader2 className="animate-spin" /> : <Check />} Connect
              </Button>
            </div>
            <div className="mt-2 flex gap-3 text-[13px]">
              <button type="button" onClick={() => setStep('idle')} className="flex items-center gap-1 text-muted hover:text-fg">
                <ArrowLeft className="size-3.5" /> Use a different email
              </button>
              <button type="button" disabled={!email || busy === 'start'} onClick={sendCode} className="flex items-center gap-1 text-muted hover:text-fg disabled:opacity-50">
                <RotateCw className="size-3.5" /> Send a new code
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => (e.preventDefault(), onChange(!on))}
      className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-ink dark:bg-signal' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-1 size-4 rounded-full bg-panel transition-[left] duration-150', on ? 'left-5' : 'left-1')} />
    </button>
  )
}

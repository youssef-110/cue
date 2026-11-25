import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword, verifyBeforeUpdateEmail } from 'firebase/auth'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { auth } from '../lib/sync'
import { EMAIL_RE, hasRealEmail, usernameOf } from '../lib/team'
import { Modal } from './TemplateModal'
import { Button } from './ui'

const field = 'h-10 w-full rounded-md border border-line bg-panel px-3 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent'
const label = 'caps mb-1.5 block text-[12px] font-semibold tracking-[0.1em] text-muted'

const message = (e: unknown) => {
  const code = (e as { code?: string }).code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Your current password is not right.',
    'auth/wrong-password': 'Your current password is not right.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/weak-password': 'Use at least 8 characters.',
    'auth/email-already-in-use': 'Another login already uses that email.',
    'auth/invalid-email': 'That does not look like an email address.',
    'auth/requires-recent-login': 'Sign out and in again, then retry.',
  }
  return map[code] ?? (e as Error).message
}

/** Your own login: change the password (needs the current one), switch sign-in to a real email, or get a reset link at it. */
export function YourLogin({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = auth?.currentUser
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<'pw' | 'email' | 'reset' | null>(null)
  const real = hasRealEmail(user?.email)
  if (!user?.email) return null
  const proveIt = () => reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, current))
  const run = async (key: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast.error(message(e))
    }
    setBusy(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Your sign-in" width={520}>
      <div className="space-y-6 p-6">
        <p className="text-[14px] text-muted">
          You sign in with <b className="font-mono font-semibold text-fg">{real ? user.email : usernameOf(user.email)}</b>
          {real ? '.' : ' (a username: Cue cannot email it).'}
        </p>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (next.length < 8) return void toast.error('Use at least 8 characters.')
            if (next !== repeat) return void toast.error('The new passwords don’t match.')
            run('pw', async () => {
              await proveIt()
              await updatePassword(user, next)
              setCurrent('')
              setNext('')
              setRepeat('')
              toast.success('Password changed')
            })
          }}
        >
          <h3 className="caps text-[15px] font-bold tracking-[0.1em]">Change password</h3>
          <label className="block">
            <span className={label}>Current password</span>
            <input className={field} aria-label="Current password" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>New password (8+)</span>
              <input className={field} aria-label="New password" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <label className="block">
              <span className={label}>Repeat new password</span>
              <input className={field} aria-label="Repeat new password" type="password" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
          </div>
          <Button variant="primary" disabled={!!busy}>
            {busy === 'pw' && <Loader2 className="animate-spin" />} Save new password
          </Button>
        </form>

        <div className="space-y-2 border-t border-line pt-5">
          <h3 className="caps text-[15px] font-bold tracking-[0.1em]">Forgot your current password?</h3>
          {real ? (
            <>
              <p className="text-[13.5px] text-muted">We email a link to {user.email} where you set a new one. You sign in again afterwards.</p>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => run('reset', async () => (await sendPasswordResetEmail(auth!, user.email!, { url: location.href.split('#')[0] }), void toast.success(`Link sent to ${user.email}. Check spam too.`)))}
              >
                {busy === 'reset' && <Loader2 className="animate-spin" />} Email me a reset link
              </Button>
            </>
          ) : (
            <p className="text-[13.5px] text-muted">Your login has no email yet. Add one below while you still know your password, or ask another admin to reset it from this Team screen.</p>
          )}
        </div>

        <form
          className="space-y-3 border-t border-line pt-5"
          onSubmit={(e) => {
            e.preventDefault()
            const to = email.trim().toLowerCase()
            if (!EMAIL_RE.test(to)) return void toast.error('That does not look like an email address.')
            run('email', async () => {
              await proveIt()
              await verifyBeforeUpdateEmail(user, to, { url: location.href.split('#')[0] })
              setEmail('')
              toast.success(`Check ${to}: click the link there to sign in with it from then on.`)
            })
          }}
        >
          <h3 className="caps text-[15px] font-bold tracking-[0.1em]">{real ? 'Change sign-in email' : 'Sign in with your email'}</h3>
          <p className="text-[13.5px] text-muted">After you click the link we send, you sign in with this email instead{real ? '' : ' of your username'}, and can get reset links there. Uses the current password above.</p>
          <label className="block">
            <span className={label}>Email</span>
            <input className={field} aria-label="New sign-in email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <Button variant="outline" disabled={!!busy || !current}>
            {busy === 'email' && <Loader2 className="animate-spin" />} Send confirmation link
          </Button>
        </form>
      </div>
    </Modal>
  )
}

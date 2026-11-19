import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Loader2, Mail, ShieldCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { bootstrap, useStore } from '../lib/store'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../lib/sync'
import { claimWorkspace } from '../lib/team'
import { COLOR_LIST, uid } from '../lib/seed'
import { Logo, Wordmark, cx } from '../components/ui'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden bg-bg p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[#6b5cff]/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-32 size-[560px] rounded-full bg-[#14c4c4]/20 blur-[120px]" />
        <div className="absolute inset-0 [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full max-w-[400px] rounded-3xl border border-line bg-panel/90 p-8 shadow-pop backdrop-blur-xl"
      >
        {children}
      </motion.div>
    </div>
  )
}

export function Splash() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }} transition={{ repeat: Infinity, duration: 1.6 }}>
        <Logo size={48} />
      </motion.div>
    </div>
  )
}

const input = 'h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-[14px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15'

const authError = (e: unknown) => {
  const code = (e as { code?: string }).code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/weak-password': 'Use at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/invalid-email': 'That doesn’t look like an email address.',
  }
  toast.error(map[code] ?? (e as Error).message)
}

const primary =
  'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] transition hover:brightness-110 disabled:opacity-60'

/** Team mode: email + password; new accounts must verify their email. */
export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!auth) return
    setBusy(true)
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, email, password)
      if (mode === 'up') {
        if (password.length < 8) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' })
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await sendEmailVerification(user, { url: location.href.split('#')[0] })
      }
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email)
        toast.success('If that email has an account, a reset link is on its way.')
        setMode('in')
      }
    } catch (e) {
      authError(e)
    }
    setBusy(false)
  }
  const title = { in: 'Welcome back', up: 'Create your account', reset: 'Reset your password' }[mode]
  return (
    <Shell>
      <Wordmark className="mb-8" />
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">{mode === 'up' ? 'Use the email your admin added to the team.' : 'Sign in to your team’s workspace.'}</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input className={input} type="email" required autoComplete="email" placeholder="you@team.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== 'reset' && (
          <input
            className={input}
            type="password"
            required
            minLength={mode === 'up' ? 8 : undefined}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            placeholder={mode === 'up' ? 'Choose a password (8+ characters)' : 'Password'}
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <button disabled={busy} className={primary}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : { in: 'Sign in', up: 'Create account', reset: 'Send reset link' }[mode]}
          {!busy && <ArrowRight className="size-4" />}
        </button>
      </form>
      <div className="mt-5 flex justify-between text-[13px]">
        {mode === 'in' ? (
          <>
            <button onClick={() => setMode('up')} className="text-accent hover:underline">
              First time here? Create account
            </button>
            <button onClick={() => setMode('reset')} className="text-muted hover:text-fg">
              Forgot password
            </button>
          </>
        ) : (
          <button onClick={() => setMode('in')} className="text-accent hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </Shell>
  )
}

export function VerifyEmail() {
  const [busy, setBusy] = useState(false)
  const email = auth?.currentUser?.email
  return (
    <Shell>
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Mail className="size-6" />
      </span>
      <h1 className="font-display text-[24px] font-semibold tracking-tight">Check your inbox</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        We sent a verification link to <span className="font-medium text-fg">{email}</span>. Click it, then come back here.
      </p>
      <button
        className={primary}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await auth?.currentUser?.reload()
          if (auth?.currentUser?.emailVerified) {
            await auth.currentUser.getIdToken(true) // refresh the token so rules see email_verified
            location.reload()
          } else toast('Not verified yet. Check your spam folder if you can’t find the email.')
          setBusy(false)
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : 'I’ve verified my email'}
      </button>
      <div className="mt-5 flex justify-between text-[13px]">
        <button
          onClick={() =>
            auth?.currentUser &&
            sendEmailVerification(auth.currentUser)
              .then(() => toast.success('Sent again'))
              .catch(authError)
          }
          className="text-accent hover:underline"
        >
          Resend email
        </button>
        <button onClick={() => auth && signOut(auth)} className="text-muted hover:text-fg">
          Use another account
        </button>
      </div>
    </Shell>
  )
}

export function NotOnTeam() {
  return (
    <Shell>
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-500">
        <UserX className="size-6" />
      </span>
      <h1 className="font-display text-[24px] font-semibold tracking-tight">You’re not on this team yet</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        Ask an admin to add <span className="font-medium text-fg">{auth?.currentUser?.email}</span> on Tideline’s Team screen, then try again.
      </p>
      <button className={primary} onClick={() => location.reload()}>
        Try again
      </button>
      <button onClick={() => auth && signOut(auth)} className="mt-4 w-full text-center text-[13px] text-muted hover:text-fg">
        Sign out
      </button>
    </Shell>
  )
}

export function ClaimWorkspace() {
  const [busy, setBusy] = useState(false)
  return (
    <Shell>
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="font-display text-[24px] font-semibold tracking-tight">Set up your team</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">
        This workspace is brand new. Claim it and <span className="font-medium text-fg">{auth?.currentUser?.email}</span> becomes the admin who adds everyone else.
      </p>
      <button
        className={primary}
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await claimWorkspace()
            location.reload()
          } catch (e) {
            toast.error('Could not claim: ' + (e as Error).message)
            setBusy(false)
          }
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : 'Claim workspace'}
      </button>
      <button onClick={() => auth && signOut(auth)} className="mt-4 w-full text-center text-[13px] text-muted hover:text-fg">
        Sign out
      </button>
    </Shell>
  )
}

/** First visit: create your profile (and starter boards if the workspace is empty). */
export function Onboarding({ localKey }: { localKey: string }) {
  const authId = useStore((s) => s.meId)
  const empty = useStore((s) => !Object.keys(s.workspace).length)
  const others = useStore((s) => Object.keys(s.user).length)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [demo, setDemo] = useState(!auth) // real teams start clean
  const [color, setColor] = useState(COLOR_LIST[3])
  const start = () => {
    if (!name.trim()) return
    const id = authId || uid('u_')
    if (!auth) localStorage.setItem(localKey, id)
    useStore.setState({ meId: id })
    bootstrap({ id, name: name.trim(), title: title.trim() || undefined, color, email: auth?.currentUser?.email ?? undefined }, empty && demo)
  }
  return (
    <Shell>
      <Logo size={40} className="mb-6" />
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">{empty ? 'Set up your workspace' : 'Join your team'}</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">{empty ? 'Unlimited boards. Unlimited seats. Free forever.' : `${others} teammate${others === 1 ? ' is' : 's are'} already here.`}</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
      >
        <input className={input} autoFocus required placeholder="Your name" aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} placeholder="Role (optional)" aria-label="Role" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex items-center gap-2 py-1">
          <span className="text-[13px] text-muted">Avatar color</span>
          {COLOR_LIST.slice(0, 8).map((c) => (
            <button type="button" key={c} aria-label="Pick color" onClick={() => setColor(c)} className={cx('size-5 rounded-full transition hover:scale-110', c === color && 'ring-2 ring-offset-2 ring-offset-panel')} style={{ background: c, ['--tw-ring-color' as string]: c }} />
          ))}
        </div>
        {empty && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-[13px]">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            <span>
              <span className="block font-medium">Add example boards</span>
              <span className="text-muted">Tasks, sales pipeline, roadmap and content calendar</span>
            </span>
          </label>
        )}
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] transition hover:brightness-110">
          Get started <ArrowRight className="size-4" />
        </button>
      </form>
      {!auth && <p className="mt-5 text-center text-[12px] text-faint">Local mode — data stays in this browser. Connect Firebase to share with your team.</p>}
    </Shell>
  )
}

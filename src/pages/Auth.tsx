import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { format } from 'date-fns'
import { ArrowRight, Loader2 } from 'lucide-react'
import { bootstrap, useStore } from '../lib/store'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth'
import { auth } from '../lib/sync'
import { USERNAME_RE, claimWorkspace, clearPasswordFlag, loginEmail, normalizeUsername, usernameOf } from '../lib/team'
import { COLOR_LIST, uid } from '../lib/seed'
import { Button, Logo, cx } from '../components/ui'

/** Station sign: the yellow band that carries the Cue name across the top of every auth screen. */
function Sign() {
  return (
    <header className="flex items-center justify-between border-b-2 border-on-signal bg-signal px-6 py-4 text-on-signal sm:px-10">
      <span className="flex items-center gap-3">
        <Logo size={34} />
        <span className="font-display text-[34px] font-bold leading-none tracking-[0.01em]">Cue</span>
      </span>
      <span className="font-mono text-[13px] font-medium tabular-nums">{format(new Date(), 'EEE d MMM · HH:mm').toUpperCase()}</span>
    </header>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Sign />
      <main className="grid flex-1 place-items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="w-full max-w-[400px] rounded-lg border border-line bg-panel p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}

export function Splash() {
  return (
    <div className="flex h-full flex-col bg-bg">
      <Sign />
      <p role="status" className="grid flex-1 place-items-center font-mono text-[12px] tracking-[0.08em] text-faint">
        LOADING…
      </p>
    </div>
  )
}

const input = 'h-10 w-full rounded-md border border-line bg-panel px-3 text-[14px] text-fg outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent'
const primaryCls = 'h-10 w-full text-[14px] font-semibold'

const authMessage = (e: unknown) => {
  const code = (e as { code?: string }).code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Wrong username or password.',
    'auth/user-not-found': 'Wrong username or password.',
    'auth/wrong-password': 'Wrong username or password.',
    'auth/email-already-in-use': 'That username is taken.',
    'auth/weak-password': 'Use at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/operation-not-allowed': 'New accounts are created by your admin.',
    'auth/admin-restricted-operation': 'New accounts are created by your admin.',
    'auth/requires-recent-login': 'Sign in again, then change your password.',
  }
  return map[code] ?? (e as Error).message
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="caps text-[30px] font-bold leading-none">{children}</h1>
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="mb-6 mt-2 text-[14px] leading-snug text-muted">{children}</p>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="caps mb-1.5 block text-[12px] font-semibold tracking-[0.1em] text-muted">{label}</span>
      {children}
    </label>
  )
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null
  return (
    <p role="alert" className="text-[13px] font-medium text-alert">
      {text}
    </p>
  )
}

function Who() {
  return <span className="font-mono text-[13px] text-fg">{usernameOf(auth?.currentUser?.email)}</span>
}

/** Team mode: username + password accounts created by an admin. */
export function SignIn() {
  const [mode, setMode] = useState<'in' | 'setup' | 'forgot'>('in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = (m: typeof mode) => (setMode(m), setError(''))
  const submit = async () => {
    if (!auth) return
    const u = normalizeUsername(username)
    if (!USERNAME_RE.test(u)) return setError('Usernames use lowercase letters, digits, dots, dashes or underscores.')
    setError('')
    setBusy(true)
    try {
      if (mode === 'in') await signInWithEmailAndPassword(auth, loginEmail(u), password)
      if (mode === 'setup') {
        if (password.length < 8) throw Object.assign(new Error('weak'), { code: 'auth/weak-password' })
        if (password !== confirm) throw new Error('The passwords don’t match.')
        await createUserWithEmailAndPassword(auth, loginEmail(u), password)
      }
    } catch (e) {
      setError(authMessage(e))
    }
    setBusy(false)
  }
  return (
    <Shell>
      <Title>{mode === 'setup' ? 'Set up the owner' : mode === 'forgot' ? 'Forgot password' : 'Sign in'}</Title>
      <Lead>
        {mode === 'setup'
          ? 'One time only: the owner of a brand-new workspace creates their login here.'
          : mode === 'forgot'
            ? 'Your admin can set a new one for you from the Team screen. You’ll choose your own the next time you sign in.'
            : 'Use the username and password your admin gave you.'}
      </Lead>
      {mode !== 'forgot' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="Username">
            <input
              className={cx(input, 'font-mono')}
              required
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-label="Username"
              aria-invalid={!!error || undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label={mode === 'setup' ? 'Password (8+ characters)' : 'Password'}>
            <input
              className={input}
              type="password"
              required
              minLength={mode === 'setup' ? 8 : undefined}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
              aria-label="Password"
              aria-invalid={!!error || undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {mode === 'setup' && (
            <Field label="Repeat password">
              <input className={input} type="password" required autoComplete="new-password" aria-label="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          )}
          <ErrorLine text={error} />
          <Button variant="primary" disabled={busy} className={primaryCls}>
            {busy ? <Loader2 className="animate-spin" /> : mode === 'setup' ? 'Create owner account' : 'Sign in'}
            {!busy && <ArrowRight />}
          </Button>
        </form>
      )}
      <div className="mt-6 flex justify-between border-t border-line pt-4 text-[13px]">
        {mode === 'in' ? (
          <>
            <button onClick={() => go('forgot')} className="text-muted hover:text-fg">
              Forgot password
            </button>
            <button onClick={() => go('setup')} className="text-muted hover:text-fg">
              New workspace setup
            </button>
          </>
        ) : (
          <button onClick={() => go('in')} className="text-accent hover:underline">
            Back to sign in
          </button>
        )}
      </div>
    </Shell>
  )
}

/** Shown when an admin created or reset the account: pick your own password. */
export function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Shell>
      <Title>Choose your password</Title>
      <Lead>
        Signed in as <Who />. Replace the temporary password before you continue.
      </Lead>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (password.length < 8) return setError('Use at least 8 characters.')
          if (password !== confirm) return setError('The passwords don’t match.')
          setError('')
          setBusy(true)
          try {
            await updatePassword(auth!.currentUser!, password)
            await clearPasswordFlag()
            location.reload()
          } catch (err) {
            setError(authMessage(err))
            setBusy(false)
          }
        }}
      >
        <Field label="New password (8+ characters)">
          <input className={input} type="password" required minLength={8} autoComplete="new-password" aria-label="New password" aria-invalid={!!error || undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repeat new password">
          <input className={input} type="password" required autoComplete="new-password" aria-label="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <ErrorLine text={error} />
        <Button variant="primary" disabled={busy} className={primaryCls}>
          {busy ? <Loader2 className="animate-spin" /> : 'Save password'}
        </Button>
      </form>
    </Shell>
  )
}

export function NotOnTeam() {
  return (
    <Shell>
      <Title>Not on the team</Title>
      <Lead>
        <Who /> has no access to this workspace. Ask your admin for a login.
      </Lead>
      <Button variant="primary" className={primaryCls} onClick={() => auth && signOut(auth)}>
        Sign out
      </Button>
    </Shell>
  )
}

export function ClaimWorkspace() {
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  return (
    <Shell>
      <Title>Claim this workspace</Title>
      <Lead>
        It’s brand new. Claim it and <Who /> becomes the admin who creates everyone else’s login. Only the configured owner can do this, once.
      </Lead>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setBusy(true)
          try {
            await claimWorkspace(name.trim())
            location.reload()
          } catch {
            setError('This login can’t claim the workspace. Only the owner set at deploy time can.')
            setBusy(false)
          }
        }}
      >
        <Field label="Your full name">
          <input className={input} required autoFocus aria-label="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ErrorLine text={error} />
        <Button variant="primary" className={primaryCls} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : 'Claim workspace'}
        </Button>
      </form>
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
    bootstrap({ id, name: name.trim(), title: title.trim() || undefined, color, username: usernameOf(auth?.currentUser?.email) || undefined }, empty && demo)
  }
  return (
    <Shell>
      <Title>{empty ? 'Set up your workspace' : 'Join your team'}</Title>
      <Lead>{empty ? 'Create your profile. Boards and seats are unlimited.' : `${others} teammate${others === 1 ? ' is' : 's are'} already here.`}</Lead>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
      >
        <Field label="Your name">
          <input className={input} autoFocus required aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Role (optional)">
          <input className={input} aria-label="Role" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <fieldset>
          <legend className="caps mb-1.5 text-[12px] font-semibold tracking-[0.1em] text-muted">Avatar colour</legend>
          <div className="flex items-center gap-2.5">
            {COLOR_LIST.slice(0, 8).map((c) => (
              <button
                type="button"
                key={c}
                aria-label="Pick color"
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={cx('size-6 rounded-full ring-offset-2 ring-offset-panel transition-shadow', c === color ? 'ring-2 ring-fg' : 'hover:ring-1 hover:ring-line-strong')}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        {empty && (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3 text-[13.5px] hover:bg-hover">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <span className="block font-medium">Add example boards</span>
              <span className="text-muted">Tasks, sales pipeline, roadmap and content calendar</span>
            </span>
          </label>
        )}
        <Button variant="primary" className={primaryCls}>
          Get started <ArrowRight />
        </Button>
      </form>
      {!auth && <p className="mt-5 border-t border-line pt-4 text-[12.5px] text-faint">Local mode: data stays in this browser. Connect Firebase to share with your team.</p>}
    </Shell>
  )
}

import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { bootstrap, useStore } from '../lib/store'
import { supabase } from '../lib/sync'
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

/** Cloud mode: teammates sign in with password or a one-time email link. */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const go = async (magic: boolean) => {
    if (!supabase || !email) return
    setBusy(true)
    const { error } = magic
      ? await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0], shouldCreateUser: false } })
      : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) toast.error(error.message)
    else if (magic) setSent(true)
  }
  return (
    <Shell>
      <Wordmark className="mb-8" />
      <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">Sign in to your team’s workspace.</p>
      {sent ? (
        <div className="rounded-xl bg-accent-soft p-4 text-[14px] text-accent">
          <Mail className="mb-2 size-5" />
          Check {email} for your sign-in link.
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            go(!password)
          }}
        >
          <input className={input} type="email" required autoComplete="email" placeholder="you@team.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" autoComplete="current-password" placeholder="Password (or leave empty for a link)" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] transition hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : password ? 'Sign in' : 'Email me a sign-in link'}
            {!busy && <ArrowRight className="size-4" />}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-[12px] text-faint">Access is invite-only. Ask your workspace admin for an invite.</p>
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
  const [demo, setDemo] = useState(true)
  const [color, setColor] = useState(COLOR_LIST[3])
  const start = () => {
    if (!name.trim()) return
    const id = authId || uid('u_')
    if (!supabase) localStorage.setItem(localKey, id)
    useStore.setState({ meId: id })
    bootstrap({ id, name: name.trim(), title: title.trim() || undefined, color }, empty && demo)
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
      {!supabase && <p className="mt-5 text-center text-[12px] text-faint">Local mode — data stays in this browser. Connect Supabase to share with your team.</p>}
    </Shell>
  )
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { Button } from './ui'

export type TourKind = 'member' | 'admin'
type Step = { target?: string; title: string; body: string }

const doneKey = (kind: TourKind, uid: string) => `cue:tour:${kind}:${uid}`
/** Replay a tour from anywhere (Help page, command palette). */
export const startTour = (kind: TourKind) => window.dispatchEvent(new CustomEvent('cue:tour', { detail: kind }))

function steps(kind: TourKind, name: string, viewer: boolean): Step[] {
  const first = name.split(' ')[0] || 'there'
  const everyone: Step[] = [
    {
      target: 'boards',
      title: 'Your boards',
      body: 'Boards sit in workspaces on the left. A board is a table of items in groups. Each column holds one kind of value: a status, an owner, a date.',
    },
    { target: 'search', title: 'Find anything', body: 'Press Ctrl K to jump to any board, item or doc, or to run a command without leaving the keyboard.' },
    { target: 'my-work', title: 'My work', body: 'Everything assigned to you across every board, sorted by when it is due. Start your day here.' },
    { target: 'inbox', title: 'Inbox', body: 'Mentions, updates on items you follow and automation alerts land here. The yellow count is what you have not read yet.' },
    {
      title: 'Working on an item',
      body: 'Click an item to open it. Post updates there and @mention a teammate to notify them. On a board, N adds an item and / searches it.',
    },
    {
      target: 'profile',
      title: 'Your profile',
      body: 'Click your name to change your colour and title, and to connect your email if you want your notifications by email too.',
    },
    { target: 'help', title: 'Help is always here', body: 'The guide covers every column, view and automation, and what each role can do. You can replay this tour from it.' },
  ]
  if (kind === 'admin')
    return [
      {
        title: `Welcome, ${first}`,
        body: 'You are the admin. First, how to bring the team in. Then a quick look at what everyone sees. It takes about a minute.',
      },
      {
        target: 'team',
        title: 'Add your team',
        body: 'Open Team to create a login: name, username and role. Cue shows a one-time ticket with a starting password. Send it to them, and they choose their own password when they first sign in.',
      },
      {
        target: 'team',
        title: 'Roles and forgotten passwords',
        body: 'Change anyone’s role from the same list. Admin manages logins, Member edits work, Viewer reads and comments. If someone forgets a password, Reset password gives you a new ticket for them.',
      },
      {
        target: 'new-board',
        title: 'Start a board',
        body: 'Pick a template or start blank. Import turns a CSV or Excel sheet into boards, which is the quickest way to bring your spreadsheets in.',
      },
      ...everyone,
    ]
  return [
    {
      title: `Welcome to Cue, ${first}`,
      body: viewer
        ? 'Cue is where the team keeps its work. You have view-only access: you can read everything and comment, but not edit. Here is a one-minute tour.'
        : 'Cue is where the team keeps its work: items with owners, dates and updates. Here is a one-minute tour.',
    },
    ...everyone,
  ]
}

const CARD_W = 344
const GAP = 14

export function Tour() {
  const meId = useStore((s) => s.meId)
  const isAdmin = useStore((s) => s.isAdmin)
  const role = useStore((s) => s.role)
  const name = useStore((s) => s.user[s.meId]?.name ?? '')
  const [kind, setKind] = useState<TourKind | null>(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  // first visit: admins get the admin tour, everyone else the member tour
  useEffect(() => {
    if (!meId) return
    const k: TourKind = isAdmin ? 'admin' : 'member'
    if (!localStorage.getItem(doneKey(k, meId))) (setKind(k), setI(0))
    const replay = (e: Event) => (setKind((e as CustomEvent<TourKind>).detail), setI(0))
    addEventListener('cue:tour', replay)
    return () => removeEventListener('cue:tour', replay)
  }, [meId, isAdmin])

  const list = kind ? steps(kind, name, role === 'viewer') : []
  const step = list[i]
  const target = step?.target
  const open = !!step

  const finish = useCallback(() => {
    if (kind && meId) localStorage.setItem(doneKey(kind, meId), '1')
    setKind(null)
  }, [kind, meId])

  // follow the highlighted element through resizes and scrolling
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const el = target ? document.querySelector<HTMLElement>(`[data-tour="${target}"]`) : null
      const r = el?.getBoundingClientRect()
      setRect(r && r.width && r.height ? r : null)
    }
    measure()
    addEventListener('resize', measure)
    addEventListener('scroll', measure, true)
    return () => (removeEventListener('resize', measure), removeEventListener('scroll', measure, true))
  }, [open, target, i]) // keyed on primitives: the step objects are rebuilt every render

  useEffect(() => nextRef.current?.focus(), [i, kind])

  useEffect(() => {
    if (!kind) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, list.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [kind, list.length, finish])

  if (!kind || !step) return null

  const last = i === list.length - 1
  const pad = 6
  const hole = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
  const vw = innerWidth
  const vh = innerHeight
  const cardW = Math.min(CARD_W, vw - 32)
  // beside the target when there is room (the rail is on the left), otherwise below it, otherwise centred
  let pos: { top: number; left: number }
  if (hole && hole.left + hole.width + GAP + cardW < vw - 16) pos = { left: hole.left + hole.width + GAP, top: Math.min(Math.max(16, hole.top), vh - 280) }
  else if (hole) pos = { left: Math.min(Math.max(16, hole.left), vw - cardW - 16), top: Math.min(hole.top + hole.height + GAP, vh - 280) }
  else pos = { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 140) }
  const t = reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] as const }

  return createPortal(
    <div className="fixed inset-0 z-[60]" aria-hidden={false}>
      {hole ? (
        <motion.div
          className="pointer-events-none absolute rounded-md outline outline-2 outline-signal"
          style={{ boxShadow: '0 0 0 9999px rgb(18 18 18 / 0.55)' }}
          initial={false}
          animate={hole}
          transition={t}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/55" />
      )}
      <motion.div
        role="dialog"
        aria-modal
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="absolute overflow-hidden rounded-lg border border-line-strong bg-panel text-fg shadow-pop"
        style={{ width: cardW }}
        initial={false}
        animate={pos}
        transition={t}
      >
        <div className="flex items-center justify-between bg-signal px-4 py-2 text-on-signal">
          <span className="caps text-[12px] font-semibold tracking-[0.14em]">{kind === 'admin' ? 'Admin tour' : 'Welcome tour'}</span>
          <span className="font-mono text-[12px] font-medium" aria-label={`Step ${i + 1} of ${list.length}`}>
            {String(i + 1).padStart(2, '0')}/{String(list.length).padStart(2, '0')}
          </span>
        </div>
        <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="px-4 pb-4 pt-3.5">
          <h2 id="tour-title" className="caps text-[22px] font-bold leading-tight">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 text-[14px] leading-relaxed text-muted">
            {step.body}
          </p>
        </motion.div>
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <button onClick={finish} className="mr-auto text-[13px] text-muted hover:text-fg">
            {last ? 'Close' : 'Skip tour'}
          </button>
          {i > 0 && (
            <Button variant="ghost" onClick={() => setI(i - 1)} aria-label="Previous step">
              <ArrowLeft />
            </Button>
          )}
          <Button ref={nextRef} variant="primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Done' : 'Next'} {!last && <ArrowRight />}
          </Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

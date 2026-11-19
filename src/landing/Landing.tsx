import { AnimatePresence, MotionConfig, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Check, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Logo, Wordmark, cx } from '../components/ui'
import { HeroBoard } from './HeroBoard'
import { Automations, Features, SelfHost, Views } from './Sections'
import { APP_URL, GitHubMark, REPO_URL, Reveal, RevealItem, SectionHead, Tideline } from './shared'

const NAV = [
  ['Features', '#features'],
  ['Views', '#views'],
  ['Automations', '#automations'],
  ['Self-host', '#self-host'],
  ['FAQ', '#faq'],
] as const

export function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="lp-shell min-h-full">
        <a href="#main" className="sr-only z-[60] rounded-lg bg-accent px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <Nav />
        <main id="main">
          <Hero />
          <Stats />
          <Views />
          <Automations />
          <Features />
          <SelfHost />
          <Pricing />
          <Faq />
          <Closing />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}

/* ───────────────────────── Theme ───────────────────────── */

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  const toggle = () =>
    setDark((d) => {
      try {
        localStorage.setItem('tideline:theme', d ? 'light' : 'dark')
      } catch {
        /* storage blocked: theme still switches for this visit */
      }
      return !d
    })
  return { dark, toggle }
}

/* ───────────────────────── Nav ───────────────────────── */

function Nav() {
  const { dark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <header className={cx('sticky top-0 z-50 transition-[border-color,background-color] duration-300', scrolled || open ? 'lp-glass border-b border-line' : 'border-b border-transparent')}>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <a href="#top" className="rounded-lg" aria-label="Tideline home">
          <Wordmark />
        </a>
        <ul className="hidden items-center gap-1 text-[14px] text-muted md:flex">
          {NAV.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="rounded-lg px-3 py-2 transition-colors hover:bg-hover hover:text-fg">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-fg" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a href={REPO_URL} className="hidden items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-muted transition-colors hover:bg-hover hover:text-fg sm:flex">
            <GitHubMark /> GitHub
          </a>
          <a href={APP_URL} className="rounded-lg bg-accent px-3.5 py-2 text-[14px] font-medium text-white shadow-[0_6px_16px_-6px_var(--accent)] transition-[filter,transform] hover:brightness-110 active:translate-y-px">
            Open Tideline
          </a>
          <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-hover md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.ul
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 md:hidden"
          >
            {[...NAV, ['GitHub', REPO_URL] as const].map(([label, href]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 text-[16px] text-fg hover:bg-hover">
                  {label}
                </a>
              </li>
            ))}
            <li className="h-3" />
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ───────────────────────── Hero ───────────────────────── */

const ease = [0.2, 0.8, 0.2, 1] as const

function Hero() {
  const reduce = useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'start 25%'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1])

  return (
    <section id="top" aria-labelledby="hero-h" className="relative isolate -mt-16 overflow-hidden pt-16">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-blob lp-blob-a top-[-12%] left-[-10%] size-[46vw] max-w-[620px] min-w-[300px]" />
        <div className="lp-blob lp-blob-b top-[8%] right-[-14%] size-[42vw] max-w-[560px] min-w-[280px]" />
        <div className="lp-blob lp-blob-c top-[38%] left-[30%] size-[34vw] max-w-[480px] min-w-[240px]" />
        <div className="lp-grid absolute inset-0" />
        <div className="lp-noise absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24 lg:pt-28">
        <h1 id="hero-h" className="max-w-[13ch] font-display text-[clamp(2.9rem,8.4vw,6.6rem)] leading-[0.92] font-bold tracking-[-0.045em] text-balance">
          {['Keep every', 'project above', 'the tideline.'].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ delay: 0.1 + i * 0.09, duration: 0.9, ease }}>
                {line}{' '}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7, ease }} className="mt-8 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="max-w-[34rem] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-relaxed text-pretty text-muted">
            Boards, timelines, dashboards and automations for small teams. Open source and self-hosted on free tiers you control.{' '}
            <span className="text-fg">Free forever. Every seat.</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={APP_URL} className="rounded-xl bg-accent px-5 py-3 text-[15px] font-medium text-white shadow-[0_10px_30px_-10px_var(--accent)] transition-[filter,transform] hover:brightness-110 active:translate-y-px">
              Open Tideline
            </a>
            <a href="#self-host" className="rounded-xl border border-line-strong bg-panel/70 px-5 py-3 text-[15px] font-medium backdrop-blur transition-colors hover:bg-panel">
              Host your own
            </a>
          </div>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-4 text-[13px] text-faint md:text-right">
          Local mode needs no account. Your boards stay in your browser until you connect a team.
        </motion.p>

        <div ref={stage} className="relative mt-14 [perspective:1600px] sm:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 1, ease }}
            style={reduce ? undefined : { rotateX, scale, transformOrigin: '50% 0%' }}
          >
            <HeroBoard />
          </motion.div>
        </div>
      </div>
      <Tideline className="mt-16 sm:mt-24" />
    </section>
  )
}

/* ───────────────────────── Stats ───────────────────────── */

function Stats() {
  const stats = [
    ['Unlimited', 'boards'],
    ['Unlimited', 'seats'],
    ['5', 'views'],
    ['13', 'column types'],
    ['€0', 'per seat, forever'],
  ]
  return (
    <section aria-labelledby="stats-h" className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <h2 id="stats-h" className="text-[15px] text-muted">
        Everything your team runs on
      </h2>
      <Reveal as="ul" className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([v, k]) => (
          <RevealItem as="li" key={k}>
            <div className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none font-bold tracking-[-0.03em]">{v}</div>
            <div className="mt-2 text-[14px] text-muted">{k}</div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  )
}

/* ───────────────────────── Pricing ───────────────────────── */

const INCLUDED = [
  'Unlimited boards, items and teammates',
  'Table, Kanban, Timeline, Calendar and Dashboard views',
  'Automations, templates and CSV import or export',
  'Updates, @mentions, likes and a notifications inbox',
  'Realtime sync through your own Supabase project',
  'Local mode with no account at all',
  'MIT license: fork it, change it, keep it',
]

function Pricing() {
  return (
    <section aria-labelledby="price-h" id="pricing" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <Reveal className="relative overflow-hidden rounded-[28px] border border-line bg-panel">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="lp-blob lp-blob-c -top-1/2 -right-1/4 size-[520px] opacity-25" />
          <div className="lp-blob lp-blob-a -bottom-1/2 -left-1/4 size-[420px] opacity-20" />
        </div>
        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:p-14">
          <RevealItem>
            <h2 id="price-h" className="text-[17px] font-medium text-muted">
              Pricing
            </h2>
            <div className="mt-4 flex items-end gap-4">
              <span className="font-display text-[clamp(5.5rem,16vw,9.5rem)] leading-[0.8] font-bold tracking-[-0.06em]">€0</span>
              <span className="pb-2 text-[17px] leading-tight text-muted">
                forever,
                <br />
                every seat
              </span>
            </div>
            <p className="mt-8 max-w-sm text-[16px] leading-relaxed text-muted">
              No plans, no trials, no seat counting. The hosting runs on free tiers, so a small team pays nothing to run it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={APP_URL} className="rounded-xl bg-accent px-5 py-3 text-[15px] font-medium text-white transition-[filter] hover:brightness-110">
                Open Tideline
              </a>
              <a href={REPO_URL} className="flex items-center gap-2 rounded-xl border border-line-strong px-5 py-3 text-[15px] font-medium transition-colors hover:bg-hover">
                <GitHubMark /> Read the source
              </a>
            </div>
          </RevealItem>
          <RevealItem>
            <h3 className="font-display text-[19px] font-semibold tracking-tight">Everything is included</h3>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {INCLUDED.map((t) => (
                <li key={t} className="flex items-start gap-3 py-3.5 text-[15px]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </RevealItem>
        </div>
      </Reveal>
    </section>
  )
}

/* ───────────────────────── FAQ ───────────────────────── */

const FAQ = [
  {
    q: 'Is it really free?',
    a: 'Yes. Tideline is MIT-licensed open source with no paid tier and no seat limits. You host it yourself on free plans: a static host for the app and a Supabase project for team sync.',
  },
  {
    q: 'Where is my data stored?',
    a: 'In local mode, in your browser on your device. In team mode, in the Postgres database of the Supabase project you create. Tideline has no servers of its own, so your data only ever goes where you send it.',
  },
  {
    q: 'Do I need Supabase?',
    a: 'Only to work together in realtime. Local mode needs no setup and no account; it is a good way to try Tideline or to run your own boards. Add the two Supabase values to your environment when you want to bring the team in.',
  },
  {
    q: 'Who can sign in to our workspace?',
    a: 'Only people you invite. The setup guide has you turn off public sign-ups in Supabase and invite teammates by email, and row-level security only lets signed-in members read or write.',
  },
  {
    q: 'Can I bring in data from spreadsheets?',
    a: 'Yes. Import a CSV into a board and map each column to a type, and export any board back to CSV whenever you like.',
  },
  {
    q: 'Who makes Tideline?',
    a: 'The Deep Echo team, who built it to run their own work and released it for any small team that wants the same. Issues and pull requests are welcome on GitHub.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  const base = useId()
  return (
    <section aria-labelledby="faq-h" id="faq" className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 sm:px-6 sm:pb-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <SectionHead id="faq-h" title="Questions, answered">
        Anything else? Open an issue on GitHub and we will add it here.
      </SectionHead>
      <Reveal className="border-t border-line">
        {FAQ.map((f, i) => {
          const isOpen = open === i
          return (
            <RevealItem key={f.q} className="border-b border-line">
              <h3>
                <button
                  type="button"
                  id={`${base}-q${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`${base}-a${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left font-display text-[18px] font-semibold tracking-tight transition-colors hover:text-accent"
                >
                  {f.q}
                  <ChevronDown size={18} className={cx('shrink-0 text-muted transition-transform duration-300', isOpen && 'rotate-180')} />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`${base}-a${i}`}
                    role="region"
                    aria-labelledby={`${base}-q${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="overflow-hidden"
                  >
                    <p className="max-w-[62ch] pb-6 text-[15.5px] leading-relaxed text-muted">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </RevealItem>
          )
        })}
      </Reveal>
    </section>
  )
}

/* ───────────────────────── Closing + footer ───────────────────────── */

function Closing() {
  return (
    <section aria-labelledby="cta-h" className="relative isolate overflow-hidden border-t border-line">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-blob lp-blob-a bottom-[-40%] left-[5%] size-[520px]" />
        <div className="lp-blob lp-blob-c bottom-[-50%] right-[0%] size-[560px]" />
        <div className="lp-noise absolute inset-0" />
      </div>
      <Reveal className="mx-auto max-w-6xl px-4 pt-24 pb-16 sm:px-6 sm:pt-32">
        <RevealItem>
          <h2 id="cta-h" className="max-w-[14ch] font-display text-[clamp(2.6rem,7vw,5.6rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance">
            Your first board is one click away.
          </h2>
        </RevealItem>
        <RevealItem className="mt-10 flex flex-wrap items-center gap-3">
          <a href={APP_URL} className="rounded-xl bg-accent px-6 py-3.5 text-[16px] font-medium text-white shadow-[0_10px_30px_-10px_var(--accent)] transition-[filter,transform] hover:brightness-110 active:translate-y-px">
            Open Tideline
          </a>
          <a href={REPO_URL} className="flex items-center gap-2 rounded-xl border border-line-strong bg-panel/70 px-6 py-3.5 text-[16px] font-medium backdrop-blur transition-colors hover:bg-panel">
            <GitHubMark /> Star on GitHub
          </a>
        </RevealItem>
      </Reveal>
      <Tideline className="opacity-80" />
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight">
            <Logo size={26} /> tideline
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">Free, open-source work management for small teams. Made by the Deep Echo team.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-[14px] sm:grid-cols-3">
          {[
            ['Features', '#features'],
            ['Views', '#views'],
            ['Automations', '#automations'],
            ['Self-host', '#self-host'],
            ['FAQ', '#faq'],
            ['Open the app', APP_URL],
            ['Source code', REPO_URL],
            ['MIT license', `${REPO_URL}/blob/main/LICENSE`],
          ].map(([l, h]) => (
            <a key={l} href={h} className="rounded py-1 text-muted transition-colors hover:text-fg">
              {l}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-[13px] text-faint sm:px-6">© 2026 Deep Echo. Released under the MIT license.</div>
    </footer>
  )
}

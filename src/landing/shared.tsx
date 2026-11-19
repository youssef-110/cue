import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { cx } from '../components/ui'

// shortcut: placeholder repo URL, set this to the real repository before launch.
export const REPO_URL = 'https://github.com/youssef-110/tideline'
export const APP_URL = './app.html'

/** Mirrors the app's label palette so the mocks look like the real product. */
export const C = {
  green: '#00b884',
  teal: '#14b8c4',
  sky: '#3b9bff',
  indigo: '#5b5bf0',
  violet: '#9a5cf5',
  pink: '#ec4f9a',
  red: '#f0475a',
  orange: '#ff8a3d',
  amber: '#f7b500',
  slate: '#8a93a6',
} as const

export const PEOPLE = {
  maya: { name: 'Maya Lind', color: C.violet },
  leo: { name: 'Leo Okafor', color: C.orange },
  ines: { name: 'Inès Duval', color: C.teal },
  sam: { name: 'Sam Reyes', color: C.pink },
} as const
export type Person = (typeof PEOPLE)[keyof typeof PEOPLE]

export function Face({ p, size = 22, ring }: { p: Person; size?: number; ring?: boolean }) {
  const initials = p.name
    .split(' ')
    .map((s) => s[0])
    .join('')
  return (
    <span
      title={p.name}
      className={cx('inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', ring && 'ring-2 ring-panel')}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${p.color}, color-mix(in oklab, ${p.color} 68%, #000))` }}
    >
      {initials}
    </span>
  )
}

export function Pill({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('grid h-full w-full place-items-center truncate px-1.5 text-[11px] font-medium text-white', className)} style={{ background: color }}>
      {children}
    </span>
  )
}

const revealParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
export const revealChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } },
}

/** Staggered scroll reveal. Children should be <Reveal.Item>. */
export function Reveal({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={revealParent} initial="hidden" whileInView="show" viewport={{ once: true, margin: '0px 0px -12% 0px' }}>
      {children}
    </Tag>
  )
}
export function RevealItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Tag = motion[as]
  return (
    <Tag className={className} variants={revealChild}>
      {children}
    </Tag>
  )
}

export function SectionHead({ id, title, children, center }: { id: string; title: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={cx('max-w-2xl', center && 'mx-auto text-center')}>
      <RevealItem>
        <h2 id={id} className="font-display text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance">
          {title}
        </h2>
      </RevealItem>
      {children && (
        <RevealItem>
          <p className="mt-5 text-[17px] leading-relaxed text-pretty text-muted">{children}</p>
        </RevealItem>
      )}
    </Reveal>
  )
}

export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** Three stacked waves taken from the logo, rolling sideways. Decorative. */
export function Tideline({ className }: { className?: string }) {
  const wave = (amp: number) => {
    let d = `M0 ${20}`
    for (let x = 0; x < 2400; x += 120) d += ` q30 ${-amp} 60 0 t60 0`
    return d
  }
  return (
    <div className={cx('pointer-events-none overflow-hidden', className)} aria-hidden>
      {[
        { amp: 9, color: '#5b5bf0', dur: '18s', op: 0.55 },
        { amp: 7, color: '#4a7dff', dur: '13s', op: 0.45 },
        { amp: 5, color: '#14c4c4', dur: '9s', op: 0.6 },
      ].map((w, i) => (
        <svg key={i} className="lp-wave block h-6 w-[200%]" style={{ ['--dur' as string]: w.dur, marginTop: i ? -10 : 0 }} viewBox="0 0 2400 40" preserveAspectRatio="none">
          <path d={wave(w.amp)} fill="none" stroke={w.color} strokeOpacity={w.op} strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      ))}
    </div>
  )
}

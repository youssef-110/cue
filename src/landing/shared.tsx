import { useEffect, useRef, useState, type ReactNode } from 'react'
import cx from 'clsx'

export const REPO_URL = 'https://github.com/youssef-110/tideline'
export const APP_URL = './app.html'

/** Page column: 16px gutter on phones, wider on desktop. */
/**
 * The Cue mark, same drawing as Logo in components/ui. Duplicated so the site
 * does not pull the app's UI module (and its animation library) into its bundle.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="5" fill="#F6D11F" />
      <path d="M22.4 9.6A9 9 0 1 0 22.4 22.4" fill="none" stroke="#121212" strokeWidth="4" />
      <path d="M16 16h7.5" stroke="#121212" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.4" fill="#121212" />
    </svg>
  )
}

export const WRAP = 'mx-auto w-full max-w-[1240px] px-4 sm:px-8'

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad = (n: number) => String(n).padStart(2, '0')

/** "THU 19 NOV 10:42", refreshed every 20 seconds. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(t)
  }, [])
  return {
    day: `${DAYS[now.getDay()]} ${pad(now.getDate())} ${MONTHS[now.getMonth()]}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  }
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Split-flap text: when `text` changes, every character that differs spins through
 * glyphs and settles left to right, like a station board. Unchanged characters stay put.
 * `tiles` draws each character on its own flap; otherwise it is plain fixed-width text.
 */
export function Flap({ text, tiles, className, tileClassName }: { text: string; tiles?: boolean; className?: string; tileClassName?: string }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(text)
  const prev = useRef(text)
  useEffect(() => {
    const from = prev.current
    prev.current = text
    if (reduced || from === text) {
      setShown(text)
      return
    }
    const len = Math.max(from.length, text.length)
    const start = performance.now()
    const settleAt = (i: number) => (tiles ? 160 + i * 45 : 110 + i * 16)
    let raf = 0
    const step = (now: number) => {
      const t = now - start
      let out = ''
      let done = true
      for (let i = 0; i < len; i++) {
        const target = text[i] ?? ' '
        if (t >= settleAt(i) || target === (from[i] ?? ' ')) out += target
        else {
          done = false
          out += GLYPHS[(Math.floor(t / 55) * 7 + i * 11) % GLYPHS.length]
        }
      }
      setShown(done ? text : out)
      if (!done) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text, tiles, reduced])

  if (!tiles) return <span className={cx('whitespace-pre', className)}>{shown}</span>
  return (
    <span className={cx('flex', className)}>
      {[...shown].map((ch, i) => (
        <span key={i} className={cx('flap-tile', ch === ':' && 'flap-tile--narrow', tileClassName)}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

/** Section header: big condensed caps over the 2px ink rule the app uses under column headers. */
export function SectionHead({ id, title, children, onInk }: { id: string; title: ReactNode; children?: ReactNode; onInk?: boolean }) {
  return (
    <div className={cx('grid gap-x-12 gap-y-4 border-b-2 pb-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-end', onInk ? 'border-on-ink' : 'border-fg')}>
      <h2 id={id} className="caps text-[clamp(2.5rem,6.4vw,5rem)] leading-[0.88] font-bold tracking-[0.01em] text-balance">
        {title}
      </h2>
      {children && <p className={cx('max-w-[46ch] text-[17px] leading-[1.5] text-pretty', onInk ? 'text-on-ink-muted' : 'text-muted')}>{children}</p>}
    </div>
  )
}

export function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** Small solid label tag, the app's status grammar. */
export function Tag({ color, ink, children }: { color: string; ink?: boolean; children: ReactNode }) {
  return (
    <span className="caps inline-block rounded-sm px-1.5 pt-[3px] pb-[2px] text-[12px] leading-none font-semibold tracking-[0.08em]" style={{ background: color, color: ink ? '#121212' : '#ffffff' }}>
      {children}
    </span>
  )
}

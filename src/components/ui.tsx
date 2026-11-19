import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { User } from '../lib/types'
import { inkOn } from '../lib/seed'

export const cx = clsx

/** Cue mark: a signal tile whose C is a clock face, its hand pointing into the gap. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="5" fill="#F6D11F" />
      <path d="M22.4 9.6A9 9 0 1 0 22.4 22.4" fill="none" stroke="#121212" strokeWidth="4" />
      <path d="M16 16h7.5" stroke="#121212" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="2.4" fill="#121212" />
    </svg>
  )
}

export function Wordmark({ className, onInk }: { className?: string; onInk?: boolean }) {
  return (
    <span className={cx('flex items-center gap-2', className)}>
      <Logo size={26} />
      <span className={cx('font-display text-[22px] font-bold leading-none tracking-[0.01em]', onInk ? 'text-on-ink' : 'text-fg')}>Cue</span>
    </span>
  )
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function Avatar({ user, size = 26, ring }: { user?: User; size?: number; ring?: boolean }) {
  if (!user) return null
  return (
    <span
      title={user.name}
      // neutral ink circle (no saturated user fills); in dark a raised panel circle with a hairline edge
      className={cx(
        'inline-grid shrink-0 select-none place-items-center rounded-full bg-ink font-semibold tracking-[0.02em] text-on-ink dark:bg-panel-2 dark:text-fg',
        ring ? 'ring-2 ring-panel' : 'dark:ring-1 dark:ring-inset dark:ring-line-strong',
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials(user.name)}
    </span>
  )
}

export function AvatarStack({ users, size = 24, max = 3, ringClass = 'ring-panel' }: { users: User[]; size?: number; max?: number; ringClass?: string }) {
  const shown = users.slice(0, max)
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <span key={u.id} className={cx('inline-flex rounded-full ring-2', ringClass)}>
          <Avatar user={u} size={size} />
        </span>
      ))}
      {users.length > max && (
        <span className={cx('inline-grid place-items-center rounded-full bg-panel-2 font-mono text-[10px] font-medium text-muted ring-2', ringClass)} style={{ width: size, height: size }}>
          +{users.length - max}
        </span>
      )}
    </span>
  )
}

/** Floating layer anchored to an element; portals out of scroll containers. */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  width = 240,
  align = 'start',
  className,
}: {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  align?: 'start' | 'center' | 'end'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, up: false })
  useLayoutEffect(() => {
    if (!open || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const h = ref.current?.offsetHeight ?? 280
      const up = r.bottom + h + 12 > innerHeight && r.top > h + 12
      let left = align === 'center' ? r.left + r.width / 2 - width / 2 : align === 'end' ? r.right - width : r.left
      left = Math.max(8, Math.min(left, innerWidth - width - 8))
      setPos({ top: up ? r.top - h - 6 : r.bottom + 6, left, up })
    }
    place()
    const raf = requestAnimationFrame(place)
    addEventListener('resize', place)
    addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', place)
      removeEventListener('scroll', place, true)
    }
  }, [open, anchor, width, align])
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open, anchor, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: pos.up ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.14, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width, zIndex: 60 }}
          className={cx('rounded-lg border border-line-strong bg-panel p-1 shadow-pop', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function MenuItem({ icon, children, onClick, danger, active, kbd }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; kbd?: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex h-8 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-[13.5px] transition-colors',
        danger ? 'text-alert hover:bg-alert-soft' : active ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-hover',
      )}
    >
      {icon && <span className={cx('grid w-4 place-items-center [&>svg]:size-4', danger ? 'text-alert' : active ? 'text-accent' : 'text-muted')}>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {kbd && <kbd className="font-mono text-[11px] text-faint">{kbd}</kbd>}
    </button>
  )
}

/** primary = ink (signal in dark), outline = ruled, ghost = bare, soft = quiet filled (also the "on" state of toolbar toggles). */
export function Button({
  children,
  variant = 'ghost',
  className,
  ...rest
}: React.ComponentProps<'button'> & { variant?: 'primary' | 'ghost' | 'outline' | 'soft' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13.5px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 [&>svg]:size-4',
        variant === 'primary' && 'bg-ink font-semibold text-on-ink hover:bg-ink/85 dark:bg-signal dark:text-on-signal dark:hover:bg-signal/90',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        variant === 'outline' && 'border border-line-strong bg-panel text-fg hover:bg-hover',
        variant === 'soft' && 'border border-line-strong bg-panel-2 text-fg hover:bg-hover',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Inline-editable text that commits on blur / Enter. */
export function EditableText({ value, onCommit, className, placeholder }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  if (!editing)
    return (
      <span onClick={() => setEditing(true)} className={cx('-mx-1 cursor-text truncate rounded-sm px-1 transition-shadow hover:ring-1 hover:ring-line-strong', className)}>
        {value || <span className="opacity-60">{placeholder}</span>}
      </span>
    )
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => (setEditing(false), draft.trim() && onCommit(draft.trim()))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') (setDraft(value), setEditing(false))
      }}
      className={cx('-mx-1 min-w-0 rounded-sm bg-panel px-1 text-fg outline-none ring-2 ring-accent', className)}
    />
  )
}

/** Small solid tag for a status / priority label; empty = dashed outline. */
export function LabelPill({ label, className }: { label?: { name: string; color: string }; className?: string }) {
  const base = 'caps inline-flex h-[22px] max-w-full items-center rounded-sm px-2 text-[12px] font-semibold leading-none tracking-[0.08em]'
  if (!label) return <span className={cx(base, 'border border-dashed border-line-strong text-faint', className)}>—</span>
  return (
    <span className={cx(base, className)} style={{ background: label.color, color: inkOn(label.color) }}>
      <span className="truncate">{label.name}</span>
    </span>
  )
}

export function Kbd({ children, onInk }: { children: ReactNode; onInk?: boolean }) {
  return (
    <kbd className={cx('rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px]', onInk ? 'border-on-ink/20 text-on-ink-muted' : 'border-line-strong bg-panel-2 text-muted')}>
      {children}
    </kbd>
  )
}

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { User } from '../lib/types'

export const cx = clsx

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="tl-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b5cff" />
          <stop offset="0.55" stopColor="#4a7dff" />
          <stop offset="1" stopColor="#14c4c4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#tl-g)" />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="2.6">
        <path d="M7 11.5q4.5-3.6 9 0t9 0" />
        <path d="M7 17q4.5-3.6 9 0t5 0" opacity=".85" />
        <path d="M7 22.5q3-2.4 6 0" opacity=".7" />
      </g>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx('flex items-center gap-2 font-display font-semibold tracking-tight', className)}>
      <Logo size={26} />
      <span className="text-[17px]">tideline</span>
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
      className={cx('inline-grid shrink-0 select-none place-items-center rounded-full font-medium text-white', ring && 'ring-2 ring-panel')}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${user.color}, color-mix(in oklab, ${user.color} 70%, #000))` }}
    >
      {initials(user.name)}
    </span>
  )
}

export function AvatarStack({ users, size = 24, max = 3 }: { users: User[]; size?: number; max?: number }) {
  const shown = users.slice(0, max)
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {users.length > max && (
        <span className="inline-grid place-items-center rounded-full bg-panel-2 text-[10px] font-semibold text-muted ring-2 ring-panel" style={{ width: size, height: size }}>
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
          initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width, zIndex: 60 }}
          className={cx('rounded-xl border border-line bg-panel p-1.5 shadow-pop', className)}
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
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors',
        danger ? 'text-red-500 hover:bg-red-500/10' : 'text-fg hover:bg-hover',
        active && 'bg-accent-soft text-accent',
      )}
    >
      {icon && <span className="grid w-4 place-items-center text-muted [&>svg]:size-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {kbd && <kbd className="font-mono text-[11px] text-faint">{kbd}</kbd>}
    </button>
  )
}

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
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4',
        variant === 'primary' && 'bg-accent text-white shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_4px_14px_-4px_var(--accent)] hover:brightness-110',
        variant === 'ghost' && 'text-muted hover:bg-hover hover:text-fg',
        variant === 'outline' && 'border border-line bg-panel text-fg hover:bg-hover',
        variant === 'soft' && 'bg-accent-soft text-accent hover:brightness-95',
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
      <span onClick={() => setEditing(true)} className={cx('cursor-text truncate rounded px-1 -mx-1 hover:ring-1 hover:ring-line-strong', className)}>
        {value || <span className="text-faint">{placeholder}</span>}
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
      className={cx('-mx-1 min-w-0 rounded bg-panel px-1 outline-none ring-2 ring-accent', className)}
    />
  )
}

/** Small colored chip for a status / priority / tag label. */
export function LabelPill({ label, className }: { label?: { name: string; color: string }; className?: string }) {
  if (!label) return <span className={cx('rounded-md bg-panel-2 px-2 py-0.5 text-[12px] text-faint', className)}>—</span>
  return (
    <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium text-white', className)} style={{ background: label.color }}>
      {label.name}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{children}</kbd>
}

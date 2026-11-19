import { differenceInCalendarDays, format, isSameDay, isSameYear, parseISO } from 'date-fns'
import type { Board, Item } from '../lib/types'
import { cx } from './ui'

/** First date-like value of an item: a date column, else a timeline's end. */
export function dueOf(board: Board, item: Item): string | undefined {
  for (const c of board.columns) {
    const v = item.values[c.id]
    if (c.type === 'date' && typeof v === 'string') return v
    if (c.type === 'timeline' && v && typeof v === 'object') return (v as { end: string }).end
  }
}

/** A deadline read like a departure: "THU 21 NOV", with a red +Nd delay tag when late. */
export function DueTime({ date, done, className }: { date?: string; done?: boolean; className?: string }) {
  if (!date) return <span className={cx('font-mono text-[12px] text-faint', className)}>—</span>
  const d = parseISO(date)
  const late = done ? 0 : differenceInCalendarDays(new Date(), d)
  return (
    <span key={date} className={cx('flap inline-flex items-baseline gap-1.5 font-mono tabular-nums', className)}>
      <span className={cx('text-[11px] font-medium tracking-[0.04em]', late > 0 ? 'text-alert' : 'text-faint')}>{format(d, 'EEE').toUpperCase()}</span>
      <span className={cx('text-[17px] font-semibold leading-none', late > 0 ? 'text-alert' : done ? 'text-muted' : 'text-fg')}>{format(d, 'dd')}</span>
      <span className={cx('text-[11px] font-medium tracking-[0.04em]', late > 0 ? 'text-alert' : 'text-faint')}>{format(d, 'MMM').toUpperCase()}</span>
      {late > 0 && <span className="self-center rounded-sm bg-alert px-1 py-[3px] text-[10.5px] font-semibold leading-none text-white">+{late}d</span>}
      {late === 0 && !done && <span className="caps self-center rounded-sm border border-fg px-1 pb-px pt-[2px] text-[10.5px] font-semibold leading-none tracking-[0.1em]">Today</span>}
    </span>
  )
}

/** Compact mono timestamp for logs: 10:42 today, 19 NOV this year, 19 NOV 25 otherwise. */
export function Stamp({ at, className }: { at: number; className?: string }) {
  const now = new Date()
  const f = isSameDay(at, now) ? 'HH:mm' : isSameYear(at, now) ? 'd MMM' : 'd MMM yy'
  return (
    <time dateTime={new Date(at).toISOString()} title={format(at, 'EEEE d MMMM yyyy, HH:mm')} className={cx('font-mono text-[12px] tabular-nums text-faint', className)}>
      {format(at, f).toUpperCase()}
    </time>
  )
}

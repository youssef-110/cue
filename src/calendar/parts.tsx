import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { dayDiff, toWall, type Occ } from '../lib/calendar'
import type { User } from '../lib/types'

/** Height of one hour on the time grid, in px. */
export const HOUR = 48

/** What the views need from the page: who is who, and what a click or a drag does. */
export interface CalApi {
  colors: Record<string, string>
  users: Record<string, User>
  meId: string
  canCreate: boolean
  selected?: string // occurrence id with its details open
  busy: boolean // a popover or dialog is open: a click on the grid only closes it
  create(start: string, end: string, allDay?: boolean): void
  open(o: Occ, el: HTMLElement): void
  move(o: Occ, start: string, end: string): void
  goDay(day: string): void
}

export const occId = (o: Occ) => `${o.ev.id}:${o.key}`
export const mine = (o: Occ, api: CalApi) => api.canCreate && o.ev.ownerId === api.meId
export const fmtTime = (wall: string) => wall.slice(11, 16)
export const fmtDay = (date: string, pattern = 'EEE d MMM') => format(parseISO(date.slice(0, 10)), pattern)

/** "Fri 27 Nov · 14:00 – 22:30", "Fri 27 Nov 22:00 – Sat 28 Nov 02:00", "Fri 27 – Sun 29 Nov · All day" */
export function whenText(o: Pick<Occ, 'start' | 'end'>, allDay?: boolean) {
  const sameDay = !dayDiff(o.end, o.start)
  if (allDay) return sameDay ? `${fmtDay(o.start)} · All day` : `${fmtDay(o.start)} – ${fmtDay(o.end)} · All day`
  return sameDay ? `${fmtDay(o.start)} · ${fmtTime(o.start)} – ${fmtTime(o.end)}` : `${fmtDay(o.start)} ${fmtTime(o.start)} – ${fmtDay(o.end)} ${fmtTime(o.end)}`
}

/** A person's colour as a quiet fill on the current surface; `strong` while dragged. Strength per theme lives in index.css. */
export const tint = (c: string, strong = false) => `color-mix(in srgb, ${c} var(--cal-tint${strong ? '-strong' : ''}), var(--panel))`

/** The wall clock in `tz`, ticking every 30 seconds. */
export function useNow(tz: string) {
  const [now, setNow] = useState(() => toWall(Date.now(), tz))
  useEffect(() => {
    const t = setInterval(() => setNow(toWall(Date.now(), tz)), 30_000)
    return () => clearInterval(t)
  }, [tz])
  return now
}

export function useMedia(query: string) {
  const [on, setOn] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const fn = () => setOn(m.matches)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [query])
  return on
}

/**
 * Follows a pointer after pointerdown. `moved` turns true past 4px. Touch only taps (a swipe scrolls,
 * which cancels the pointer and so the gesture).
 */
export function track(e: React.PointerEvent, onMove: (ev: PointerEvent) => void, onEnd: (ev: PointerEvent, moved: boolean) => void) {
  const x0 = e.clientX
  const y0 = e.clientY
  const touch = e.pointerType === 'touch'
  let moved = false
  const move = (ev: PointerEvent) => {
    if (touch || (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4)) return
    moved = true
    onMove(ev)
  }
  const stop = () => {
    removeEventListener('pointermove', move)
    removeEventListener('pointerup', up)
    removeEventListener('pointercancel', stop)
  }
  const up = (ev: PointerEvent) => (stop(), onEnd(ev, moved))
  addEventListener('pointermove', move)
  addEventListener('pointerup', up)
  addEventListener('pointercancel', stop)
}

/** The day cell (or time-grid column, with `attr` = data-col) under the pointer. */
export function cellAt(ev: PointerEvent, attr: 'day' | 'col') {
  const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>(`[data-${attr}]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { day: el.dataset[attr]!, min: Math.min(1440, Math.max(0, ((ev.clientY - r.top) / HOUR) * 60)) }
}

/** Keyboard: Enter or Space opens what a click opens. */
export const pressable = (fn: (el: HTMLElement) => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    fn(e.currentTarget)
  },
})

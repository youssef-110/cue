// Team calendar model: wall-time maths, weekly recurrence, overlap layout. Pure (no store, no DOM, no local time zone),
// so tests run it directly in any time zone.
import type { CalEvent } from './types'

/** 'yyyy-MM-ddTHH:mm' read as if it were UTC: a plain number to do wall-clock arithmetic on. */
const asUtc = (wall: string) => Date.UTC(+wall.slice(0, 4), +wall.slice(5, 7) - 1, +wall.slice(8, 10), +wall.slice(11, 13) || 0, +wall.slice(14, 16) || 0)
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 16)
const DAY = 86_400_000

export const addDays = (date: string, n: number) => fromUtc(asUtc(date) + n * DAY).slice(0, 10)
export const dayDiff = (a: string, b: string) => Math.round((asUtc(a.slice(0, 10)) - asUtc(b.slice(0, 10))) / DAY)
/** 0 = Sunday … 6 = Saturday, like Date#getDay. */
export const weekday = (date: string) => new Date(asUtc(date.slice(0, 10))).getUTCDay()
/** Monday of the week the date is in. */
export const weekStart = (date: string) => addDays(date, -((weekday(date) + 6) % 7))
export const minutesOf = (wall: string) => +wall.slice(11, 13) * 60 + +wall.slice(14, 16)
export const atMinutes = (date: string, min: number) => fromUtc(asUtc(date.slice(0, 10)) + min * 60_000)
/** Shift a wall time by whole minutes on the wall clock (no time zone involved). */
export const shiftWall = (wall: string, min: number) => fromUtc(asUtc(wall) + min * 60_000)
export const wallDiff = (a: string, b: string) => Math.round((asUtc(a) - asUtc(b)) / 60_000)
export const snap = (min: number, step = 15) => Math.round(min / step) * step

// ---------- time zones ----------
const fmts = new Map<string, Intl.DateTimeFormat>()
/** The wall clock in `tz` at instant `ms`. */
export function toWall(ms: number, tz: string) {
  let f = fmts.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    fmts.set(tz, f)
  }
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
/** The instant a wall clock in `tz` shows `wall`. A time skipped by a DST jump moves forward by the jump; a repeated one takes the later instant. */
export function toMs(wall: string, tz: string) {
  const guess = asUtc(wall)
  const off = (ms: number) => asUtc(toWall(ms, tz)) - ms
  const first = guess - off(guess)
  const second = off(first)
  return second === off(guess) ? first : guess - second
}
export const convert = (wall: string, from: string, to: string) => (from === to ? wall : toWall(toMs(wall, from), to))
export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

// ---------- occurrences ----------
/** One showing of an event. `start`/`end` are wall times in the viewer's zone; `key` is the occurrence's date in the event's own zone. */
export interface Occ {
  ev: CalEvent
  key: string
  start: string
  end: string
}

/** Dates (event zone) the event happens on, between `from` and `to` inclusive. */
function datesOf(ev: CalEvent, from: string, to: string) {
  const first = ev.start.slice(0, 10)
  const days = ev.repeat?.days ?? []
  if (!days.length) return first >= from && first <= to ? [first] : []
  const skip = new Set(ev.exceptions ?? [])
  const last = ev.repeat?.until && ev.repeat.until < to ? ev.repeat.until : to
  const out: string[] = []
  for (let d = first > from ? first : from; d <= last; d = addDays(d, 1)) if (days.includes(weekday(d)) && !skip.has(d)) out.push(d)
  return out
}

/** Every occurrence that touches the days `from`..`to` (inclusive, viewer's zone), in start order. All-day events float: same dates everywhere. */
export function occurrences(events: CalEvent[], from: string, to: string, viewTz: string): Occ[] {
  const out: Occ[] = []
  const endBound = addDays(to, 1) + 'T00:00'
  const startBound = from + 'T00:00'
  for (const ev of events) {
    try {
      expand(ev)
    } catch {
      // a malformed event (unknown zone, bad dates) is skipped rather than breaking the whole calendar
    }
  }
  function expand(ev: CalEvent) {
    const span = Math.min(62, Math.max(0, dayDiff(ev.end, ev.start)))
    if (ev.allDay) {
      for (const d of datesOf(ev, addDays(from, -span), to)) out.push({ ev, key: d, start: d + 'T00:00', end: addDays(d, span) + 'T23:59' })
      return
    }
    const sMin = minutesOf(ev.start)
    const length = wallDiff(ev.end, ev.start)
    // a day of slack either side covers zones up to ±24h away from the event's own
    for (const d of datesOf(ev, addDays(from, -span - 1), addDays(to, 1))) {
      const wallStart = atMinutes(d, sMin)
      const startMs = toMs(wallStart, ev.tz)
      const endMs = toMs(shiftWall(wallStart, length), ev.tz)
      const start = toWall(startMs, viewTz)
      const end = toWall(endMs, viewTz)
      if (start < endBound && (end > startBound || (end === start && start >= startBound))) out.push({ ev, key: d, start, end })
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.ev.title.localeCompare(b.ev.title)))
}

/** The part of a timed occurrence that falls on `day`, in minutes from midnight (end exclusive, up to 1440). */
export function segment(o: Pick<Occ, 'start' | 'end'>, day: string) {
  const next = addDays(day, 1) + 'T00:00'
  if (o.start >= next || (o.end <= day + 'T00:00' && o.end !== o.start)) return null
  const top = o.start.slice(0, 10) === day ? minutesOf(o.start) : 0
  const bottom = o.end >= next ? 1440 : o.end.slice(0, 10) === day ? minutesOf(o.end) : 1440
  return { top, bottom }
}

/**
 * Side-by-side layout for one day: events that overlap (directly or through a chain) share a cluster
 * and split its width; each takes the first column free at its start.
 */
export function layoutDay<T extends { top: number; bottom: number }>(segs: T[], minHeight = 15): (T & { col: number; cols: number })[] {
  const sorted = [...segs].sort((a, b) => a.top - b.top || b.bottom - a.bottom)
  const out: (T & { col: number; cols: number })[] = []
  let cluster: (T & { col: number; cols: number })[] = []
  let ends: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    for (const c of cluster) c.cols = ends.length
    out.push(...cluster)
    cluster = []
    ends = []
  }
  for (const s of sorted) {
    if (s.top >= clusterEnd) flush()
    let col = ends.findIndex((e) => e <= s.top)
    if (col < 0) col = ends.push(0) - 1
    ends[col] = Math.max(s.bottom, s.top + minHeight)
    clusterEnd = Math.max(clusterEnd, ends[col])
    cluster.push({ ...s, col, cols: 0 })
  }
  flush()
  return out
}

/** Rows for bars spanning day columns (all-day events in a week, everything in a month row): each bar takes the first row free. */
export function lanes<T extends { first: number; last: number }>(bars: T[]): (T & { lane: number })[] {
  const rows: number[] = [] // last column used per row
  return [...bars]
    .sort((a, b) => a.first - b.first || b.last - b.first - (a.last - a.first))
    .map((b) => {
      let lane = rows.findIndex((last) => last < b.first)
      if (lane < 0) lane = rows.push(0) - 1
      rows[lane] = b.last
      return { ...b, lane }
    })
}

/** 42 days (6 weeks, Monday first) covering the month `date` is in. */
export function monthGrid(date: string) {
  const start = weekStart(date.slice(0, 8) + '01')
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// ---------- recurring edits ----------
/** Drop one date from a series ("this event" delete). */
export const skip = (ev: CalEvent, key: string): CalEvent => ({ ...ev, exceptions: [...new Set([...(ev.exceptions ?? []), key])] })

/**
 * Move a whole series by the change made to one occurrence (`was` -> `now`, viewer's wall times):
 * the times shift on the wall clock, and the weekdays shift with the date.
 */
export function shiftSeries(ev: CalEvent, was: { start: string; end: string }, now: { start: string; end: string }): CalEvent {
  const ds = wallDiff(now.start, was.start)
  const de = wallDiff(now.end, was.end)
  const moved = dayDiff(now.start, was.start)
  const start = shiftWall(ev.start, ds)
  let end = shiftWall(ev.end, de)
  if (end < start) end = start
  const repeat = ev.repeat && moved ? { ...ev.repeat, days: [...new Set(ev.repeat.days.map((d) => (((d + moved) % 7) + 7) % 7))].sort() } : ev.repeat
  return { ...ev, start, end, repeat }
}

/** "Weekly on Mon, Wed, Fri until 19 Dec" */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function repeatText(r?: CalEvent['repeat']) {
  if (!r?.days.length) return ''
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.days.includes(d))
  const text = days.length === 7 ? 'Every day' : days.join() === '1,2,3,4,5' ? 'Every weekday' : `Weekly on ${days.map((d) => DAY_NAMES[d]).join(', ')}`
  return r.until ? `${text}, until ${r.until}` : text
}

// ---------- people ----------
/** Colours for people's calendars: the label palette minus red (it means trouble), the greys and ink. */
export const CAL_COLORS = ['#1d4fb8', '#0f7c8c', '#d9661a', '#5b3fa8', '#1f7a4d', '#b8326b', '#2b7bd0', '#6e8f1e', '#3d3d39', '#f6d11f']
/** One distinct colour per person, the same for every viewer: their own colour when it is free and allowed, else the next free one. */
export function personColors(people: { id: string; name: string; color?: string }[]) {
  const out: Record<string, string> = {}
  const used = new Set<string>()
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  for (const p of sorted) {
    const own = p.color?.toLowerCase()
    const c = own && CAL_COLORS.includes(own) && !used.has(own) ? own : (CAL_COLORS.find((x) => !used.has(x)) ?? CAL_COLORS[used.size % CAL_COLORS.length])
    used.add(c)
    out[p.id] = c
  }
  return out
}

// Run: node --test tests/calendar.test.mjs  (Node 23.6+ strips the .ts types itself)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, convert, layoutDay, lanes, monthGrid, occurrences, personColors, repeatText, segment, shiftSeries, skip, toMs, toWall, weekStart, weekday } from '../src/lib/calendar.ts'

const LUX = 'Europe/Luxembourg'
const ev = (extra = {}) => ({ id: 'e', ownerId: 'u', title: 'Classes', start: '2026-11-23T08:00', end: '2026-11-23T16:30', tz: LUX, createdAt: 0, updatedAt: 0, ...extra })
const classes = ev({ repeat: { days: [1, 3, 5] } })

test('date helpers work on plain strings', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(weekday('2026-11-26'), 4) // a Thursday
  assert.equal(weekStart('2026-11-29'), '2026-11-23') // Sunday belongs to the week starting Monday
  assert.equal(monthGrid('2026-11-26')[0], '2026-10-26')
  assert.equal(monthGrid('2026-11-26').length, 42)
})

test('wall time converts across zones and DST', () => {
  // Luxembourg is UTC+1 in winter, UTC+2 in summer
  assert.equal(new Date(toMs('2026-01-15T08:00', LUX)).toISOString(), '2026-01-15T07:00:00.000Z')
  assert.equal(new Date(toMs('2026-07-15T08:00', LUX)).toISOString(), '2026-07-15T06:00:00.000Z')
  assert.equal(toWall(Date.UTC(2026, 6, 15, 6), LUX), '2026-07-15T08:00')
  assert.equal(convert('2026-11-27T14:00', LUX, 'America/New_York'), '2026-11-27T08:00')
  // 02:30 does not exist on 29 March 2026 (clocks jump 02:00 -> 03:00): it moves forward to 03:30
  assert.equal(toWall(toMs('2026-03-29T02:30', LUX), LUX), '2026-03-29T03:30')
  // 02:30 happens twice on 25 October 2026: the later one
  assert.equal(new Date(toMs('2026-10-25T02:30', LUX)).toISOString(), '2026-10-25T01:30:00.000Z')
})

test('weekly series repeat on the chosen weekdays and keep their wall time across DST', () => {
  const week = occurrences([classes], '2026-11-23', '2026-11-29', LUX)
  assert.deepEqual(week.map((o) => o.start), ['2026-11-23T08:00', '2026-11-25T08:00', '2026-11-27T08:00'])
  assert.deepEqual(week.map((o) => o.end), ['2026-11-23T16:30', '2026-11-25T16:30', '2026-11-27T16:30'])
  // a series started in winter is still 08:00 local after the March switch, so an hour earlier in UTC
  const spring = occurrences([ev({ start: '2026-03-23T08:00', end: '2026-03-23T09:00', repeat: { days: [1] } })], '2026-03-23', '2026-03-30', LUX)
  assert.deepEqual(spring.map((o) => o.start), ['2026-03-23T08:00', '2026-03-30T08:00'])
  assert.deepEqual(
    spring.map((o) => new Date(toMs(o.start, LUX)).getUTCHours()),
    [7, 6],
  )
  // seen from UTC the same series moves with the switch
  assert.deepEqual(
    occurrences([ev({ start: '2026-10-19T08:00', end: '2026-10-19T09:00', repeat: { days: [1] } })], '2026-10-19', '2026-10-26', 'UTC').map((o) => o.start),
    ['2026-10-19T06:00', '2026-10-26T07:00'],
  )
  // nothing before the series starts, nothing after `until`
  assert.equal(occurrences([classes], '2026-11-16', '2026-11-22', LUX).length, 0)
  const ended = ev({ repeat: { days: [1, 3, 5], until: '2026-11-25' } })
  assert.deepEqual(occurrences([ended], '2026-11-23', '2026-12-06', LUX).map((o) => o.key), ['2026-11-23', '2026-11-25'])
})

test('exceptions drop single dates; a split-off date shows as its own event', () => {
  const s = skip(classes, '2026-11-25')
  assert.deepEqual(occurrences([s], '2026-11-23', '2026-11-29', LUX).map((o) => o.key), ['2026-11-23', '2026-11-27'])
  assert.deepEqual(skip(s, '2026-11-25').exceptions, ['2026-11-25']) // no duplicates
  const moved = ev({ id: 'x', start: '2026-11-25T10:00', end: '2026-11-25T12:00', seriesId: 'e' })
  assert.deepEqual(occurrences([s, moved], '2026-11-23', '2026-11-29', LUX).map((o) => o.start), ['2026-11-23T08:00', '2026-11-25T10:00', '2026-11-27T08:00'])
})

test('moving one occurrence of a series moves the whole series, weekdays included', () => {
  const was = { start: '2026-11-25T08:00', end: '2026-11-25T16:30' }
  const later = shiftSeries(classes, was, { start: '2026-11-25T09:00', end: '2026-11-25T17:00' })
  assert.equal(later.start, '2026-11-23T09:00')
  assert.equal(later.end, '2026-11-23T17:00')
  assert.deepEqual(later.repeat.days, [1, 3, 5])
  const nextDay = shiftSeries(classes, was, { start: '2026-11-26T08:00', end: '2026-11-26T16:30' })
  assert.deepEqual(nextDay.repeat.days, [2, 4, 6])
  const back = shiftSeries(ev({ repeat: { days: [0, 1] } }), was, { start: '2026-11-24T08:00', end: '2026-11-24T16:30' })
  assert.deepEqual(back.repeat.days, [0, 6])
})

test('all-day events float and span days; timed events crossing midnight split into segments', () => {
  const trip = ev({ allDay: true, start: '2026-11-26T00:00', end: '2026-11-28T23:59' })
  const occ = occurrences([trip], '2026-11-27', '2026-11-27', 'America/New_York')
  assert.equal(occ.length, 1)
  assert.equal(occ[0].start, '2026-11-26T00:00')
  const late = occurrences([ev({ start: '2026-11-27T22:00', end: '2026-11-28T02:00' })], '2026-11-28', '2026-11-28', LUX)
  assert.equal(late.length, 1)
  assert.deepEqual(segment(late[0], '2026-11-27'), { top: 1320, bottom: 1440 })
  assert.deepEqual(segment(late[0], '2026-11-28'), { top: 0, bottom: 120 })
  assert.equal(segment(late[0], '2026-11-29'), null)
  // ending exactly at midnight does not spill into the next day
  const toMidnight = occurrences([ev({ start: '2026-11-27T22:00', end: '2026-11-28T00:00' })], '2026-11-28', '2026-11-28', LUX)
  assert.equal(toMidnight.length, 0)
})

test('a malformed event is skipped, not fatal for the whole calendar', () => {
  const broken = ev({ id: 'bad', tz: 'Not/AZone' })
  assert.deepEqual(occurrences([broken, classes], '2026-11-23', '2026-11-23', LUX).map((o) => o.ev.id), ['e'])
})

test('overlapping events sit side by side; chained overlaps share a cluster', () => {
  const placed = (segs) => layoutDay(segs).map((s) => `${s.id}:${s.col}/${s.cols}`).sort()
  // the Friday: Classes 08:00-16:30 and the Hackathon from 14:00
  assert.deepEqual(placed([{ id: 'classes', top: 480, bottom: 990 }, { id: 'hack', top: 840, bottom: 1350 }]), ['classes:0/2', 'hack:1/2'])
  // A overlaps B and C, which do not overlap each other: two columns, C reuses B's
  assert.deepEqual(placed([{ id: 'a', top: 0, bottom: 300 }, { id: 'b', top: 60, bottom: 120 }, { id: 'c', top: 180, bottom: 240 }]), ['a:0/2', 'b:1/2', 'c:1/2'])
  // touching is not overlapping
  assert.deepEqual(placed([{ id: 'a', top: 60, bottom: 120 }, { id: 'b', top: 120, bottom: 180 }]), ['a:0/1', 'b:0/1'])
  // a later, separate cluster starts again at full width
  assert.deepEqual(placed([{ id: 'a', top: 0, bottom: 60 }, { id: 'b', top: 30, bottom: 90 }, { id: 'c', top: 600, bottom: 660 }]), ['a:0/2', 'b:1/2', 'c:0/1'])
})

test('spanning bars take the first free row', () => {
  const rows = lanes([{ id: 'a', first: 0, last: 2 }, { id: 'b', first: 1, last: 1 }, { id: 'c', first: 3, last: 4 }])
  assert.deepEqual(rows.map((r) => `${r.id}:${r.lane}`).sort(), ['a:0', 'b:1', 'c:0'])
})

test('people get distinct calendar colours, never red, the same for every viewer', () => {
  const indigo = '#1d4fb8'
  const people = [{ id: 'y', name: 'Youssef', color: indigo }, { id: 'm', name: 'Mark', color: indigo }, { id: 'e', name: 'Ekaterina', color: '#d3242b' }]
  const c = personColors(people)
  assert.equal(new Set(Object.values(c)).size, 3)
  assert.ok(!Object.values(c).includes('#d3242b'))
  assert.deepEqual(personColors([...people].reverse()), c)
})

test('repeat rules read like a sentence', () => {
  assert.equal(repeatText({ days: [5, 1, 3] }), 'Weekly on Mon, Wed, Fri')
  assert.equal(repeatText({ days: [1, 2, 3, 4, 5] }), 'Every weekday')
  assert.equal(repeatText({ days: [1], until: '2026-12-18' }), 'Weekly on Mon, until 2026-12-18')
  assert.equal(repeatText(undefined), '')
})

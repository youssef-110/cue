// Run: node --test tests/schedule.test.mjs  (Node 23.6+ strips the .ts types itself)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scheduledItemId, slotsToCreate, weekdaysToCreate } from '../src/lib/schedule.ts'

test('a weekday rule fills the rest of this week, or next week at the weekend', () => {
  assert.deepEqual(weekdaysToCreate(new Date(2026, 10, 25, 9)), { period: 'wd:2026-11-23', days: ['2026-11-25', '2026-11-26', '2026-11-27'] })
  assert.deepEqual(weekdaysToCreate(new Date(2026, 10, 21, 0, 45)).period, 'wd:2026-11-23')
})

test('the item for a slot always gets the same id', () => {
  assert.equal(scheduledItemId('au_x', '2026-11-20'), scheduledItemId('au_x', '2026-11-20'))
  assert.notEqual(scheduledItemId('au_x', '2026-11-20'), scheduledItemId('au_y', '2026-11-20'))
})

test('a second client (or a second run) creates nothing for slots that already have their item', () => {
  const items = new Set()
  const run = () => {
    const todo = slotsToCreate('au_x', ['2026-11-23', '2026-11-24'], (id) => items.has(id))
    todo.forEach((s) => items.add(scheduledItemId('au_x', s)))
    return todo
  }
  assert.deepEqual(run(), ['2026-11-23', '2026-11-24'])
  assert.deepEqual(run(), []) // e.g. another person's tab after lastPeriod was overwritten
  assert.equal(items.size, 2)
})

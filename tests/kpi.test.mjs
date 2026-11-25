// Run: node --test tests/kpi.test.mjs  (Node 23.6+ strips the .ts types itself)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compact, exampleKpi, ladder, lastWeeks, milestoneRows, money, moneyStatus, nearestBehind, newKpi, nextTeamChange, opportunities, parseAmount, readiness, roundStatus, weekly } from '../src/lib/kpi.ts'

const TODAY = '2026-11-25' // a Wednesday

test('amounts parse the way people type them', () => {
  assert.equal(parseAmount('500k'), 500_000)
  assert.equal(parseAmount('€1.2M'), 1_200_000)
  assert.equal(parseAmount('2,600'), 2600)
  assert.equal(parseAmount(' 35 % '), 35)
  assert.equal(parseAmount(''), undefined)
  assert.equal(parseAmount('soon'), undefined)
})

test('figures print compact, full digits under 10,000', () => {
  assert.deepEqual([2600, 31_200, 700_000, 1_200_000, 1_000_000, 0].map(compact), ['2,600', '31.2k', '700k', '1.2M', '1M', '0'])
  assert.equal(money(-4200, '€'), '−€4,200')
  assert.equal(money(undefined, '€'), '—')
})

test('round: government money plus firm investor money, soft commits apart', () => {
  const k = newKpi('me', 'Test', ['me'])
  const [, , , , soft, writing, money] = k.investorStages
  k.round = { target: 1_200_000, government: 700_000 }
  k.investors = [
    { id: '1', name: 'A', stage: soft.id, amount: 100_000 },
    { id: '2', name: 'B', stage: writing.id, amount: 50_000 },
    { id: '3', name: 'C', stage: money.id, amount: 25_000 },
    { id: '4', name: 'D', stage: 'passed', amount: 999_000 },
  ]
  const r = roundStatus(k)
  assert.equal(r.committed, 75_000)
  assert.equal(r.soft, 100_000)
  assert.equal(r.total, 775_000)
  assert.equal(r.open, 425_000)
  assert.equal(r.progress.toFixed(3), '0.646')
})

test('ladders run furthest stage first and highlight the furthest reached', () => {
  const k = newKpi('me', 'Test', ['me'])
  const s = k.accountStages
  const l = ladder(s, [{ name: 'X', stage: s[1].id }, { name: 'Y', stage: s[1].id }, { name: 'Z', stage: s[3].id }, { name: 'Gone', stage: 'nope' }])
  assert.equal(l.rows[0].stage.name, 'Paying')
  assert.equal(l.focus, s[3].id)
  assert.equal(l.max, 2)
  assert.equal(l.total, 3)
  assert.equal(ladder(s, [], s[2].id).focus, s[2].id) // a chosen focus wins
})

test('milestones: counted sources, met, and the nearest one behind', () => {
  const k = exampleKpi('me', TODAY)
  const rows = milestoneRows(k, TODAY)
  const byName = Object.fromEntries(rows.map((r) => [r.m.name, r]))
  assert.equal(byName['Signed LOIs'].actual, 5) // accounts at LOI signed or later
  assert.equal(byName['Paying customers'].actual, 1)
  assert.equal(byName['Investor money committed'].actual, 50_000)
  assert.equal(byName['Whole round with grants'].actual, 650_000)
  assert.equal(byName['Website relaunch'].met, true)
  assert.equal(byName['Signed LOIs'].met, true)
  const next = nearestBehind(rows)
  assert.equal(next.m.name, 'First written investor commitment')
  assert.equal(next.days, 6)
})

test('money: latest month, profit, burn and runway', () => {
  const k = newKpi('me', 'Test', ['me'])
  k.months = [
    { id: 'a', month: '2026-08', revenue: 1000, cost: 11000, cash: 120000 },
    { id: 'b', month: '2026-10', revenue: 3000, cost: 13000, cash: 100000 },
    { id: 'c', month: '2026-09', revenue: 2000, cost: 12000 },
  ]
  const m = moneyStatus(k)
  assert.equal(m.latest.month, '2026-10')
  assert.equal(m.prev.month, '2026-09')
  assert.equal(m.profit, -10000)
  assert.equal(m.burn, 10000)
  assert.equal(m.runway, 10)
  assert.equal(m.revenueToDate, 6000)
  assert.equal(moneyStatus(newKpi('me', 'x', ['me'])).runway, undefined)
})

test('weekly activity covers the last 8 Mondays, this week last', () => {
  const weeks = lastWeeks(TODAY)
  assert.equal(weeks.length, 8)
  assert.equal(weeks.at(-1), '2026-11-23')
  assert.equal(weeks[0], '2026-10-05')
  const k = newKpi('me', 'Test', ['me'])
  k.weeks = [{ id: 'w', week: '2026-11-23', customer: 3 }, { id: 'old', week: '2026-01-05', customer: 50 }]
  const w = weekly(k, TODAY)
  assert.equal(w.series[0].total, 3)
  assert.equal(w.series[1].entered, false)
})

test('readiness, opportunities and the next team change', () => {
  const k = exampleKpi('me', TODAY)
  const r = readiness(k)
  assert.equal(r.scored, 5)
  assert.equal(r.average, 3.2)
  assert.equal(k.areas.find((a) => a.id === r.weakest).name, 'Fundraise')
  const o = opportunities(k)
  assert.equal(o.plotted.length, 8)
  assert.equal(k.accounts.find((a) => a.id === o.largest).name, 'Atlas Media')
  assert.deepEqual(o.missing, ['Orchard EdTech', 'Granite Sports'])
  assert.equal(k.team.find((p) => p.id === nextTeamChange(k, TODAY)).name, 'Rae Collins')
})

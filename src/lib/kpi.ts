// KPI board model: defaults and every derived number. Pure (no store, no DOM), so tests run it directly.
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import type { Board, Item, Kpi, KpiLink, KpiMilestone, KpiStage } from './types'

const rid = (p: string) => p + Math.random().toString(36).slice(2, 10)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

// ---------- defaults ----------
export const INVESTOR_STAGES = (): KpiStage[] => [
  { id: rid('s_'), name: 'Intro' },
  { id: rid('s_'), name: 'Meeting booked' },
  { id: rid('s_'), name: 'First meeting' },
  { id: rid('s_'), name: 'Second meeting' },
  { id: rid('s_'), name: 'Soft commit', money: 'soft' },
  { id: rid('s_'), name: 'In writing', money: 'committed' },
  { id: rid('s_'), name: 'Money in', money: 'committed' },
]
export const ACCOUNT_STAGES = (): KpiStage[] =>
  ['Early talks', 'LOI drafting', 'LOI sent', 'LOI signed', 'Test or POC', 'Pilot', 'Paying'].map((name) => ({ id: rid('s_'), name }))
export const AREAS = ['Product', 'Sales', 'Fundraise', 'Team', 'Operations']
export const WEEK_METRICS = [
  { key: 'customer', label: 'Customer meetings' },
  { key: 'investor', label: 'Investor meetings' },
  { key: 'outreach', label: 'Outreach emails' },
  { key: 'lois', label: 'LOIs sent' },
] as const
export type WeekKey = (typeof WEEK_METRICS)[number]['key']

export function newKpi(meId: string, name: string, readers: string[]): Kpi {
  const now = Date.now()
  return {
    id: rid('k_'),
    name,
    currency: '€',
    round: {},
    investorStages: INVESTOR_STAGES(),
    investors: [],
    accountStages: ACCOUNT_STAGES(),
    accounts: [],
    milestones: [],
    months: [],
    weeks: [],
    areas: AREAS.map((n) => ({ id: rid('a_'), name: n })),
    team: [],
    roles: [],
    createdBy: meId,
    createdAt: now,
    updatedAt: now,
    updatedBy: meId,
    order: now,
    readers,
  }
}

// ---------- numbers in and out ----------
/** "€1.2M", "500k", "2,600", "12.5%" -> number; blank or junk -> undefined. */
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim().toLowerCase().replace(/[€$£¥%\s]/g, '').replace(/,/g, '')
  const m = /^(-?\d*\.?\d+)([km]?)$/.exec(s)
  if (!m) return undefined
  return Math.round(Number(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1) * 100) / 100
}
const trim = (n: number, d: number) => n.toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
/** Compact count: 980, 2,600, 31.2k, 1.2M. Full digits under 10,000. */
export function compact(n: number) {
  const a = Math.abs(n)
  if (a < 10_000) return Math.round(n).toLocaleString('en')
  if (a < 1e6) return trim(n / 1e3, a < 100_000 ? 1 : 0) + 'k'
  return trim(n / 1e6, a < 1e7 ? 2 : 1) + 'M'
}
export const money = (n: number | undefined, cur: string) => (n == null || Number.isNaN(n) ? '—' : (n < 0 ? '−' : '') + cur + compact(Math.abs(n)))
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0)

// ---------- fundraise ----------
export function investorMoney(k: Kpi) {
  const kindOf = new Map(k.investorStages.map((s) => [s.id, s.money]))
  let committed = 0
  let soft = 0
  for (const i of k.investors) {
    const m = kindOf.get(i.stage)
    if (m === 'committed') committed += i.amount ?? 0
    if (m === 'soft') soft += i.amount ?? 0
  }
  return { committed, soft }
}

export function roundStatus(k: Kpi) {
  const { committed, soft } = investorMoney(k)
  const government = k.round.government ?? 0
  const total = government + committed
  const target = k.round.target ?? 0
  return {
    target,
    investorTarget: k.round.investorTarget ?? 0,
    government,
    committed,
    soft,
    total,
    open: Math.max(0, target - total),
    progress: share(total, target),
  }
}

// ---------- ladders (investor funnel, sales pipeline) ----------
/** Furthest stage first. Each row: stage, how many are at it, and their names. */
export function ladder(stages: KpiStage[], entries: { name: string; stage: string }[], focus?: string) {
  const rows = [...stages].reverse().map((stage) => {
    const at = entries.filter((e) => e.stage === stage.id)
    return { stage, count: at.length, names: at.map((e) => e.name) }
  })
  const max = Math.max(1, ...rows.map((r) => r.count))
  const known = new Set(stages.map((s) => s.id))
  return {
    rows,
    max,
    // the highlighted stage: the one the team chose, else the furthest anyone has reached
    focus: focus && known.has(focus) ? focus : rows.find((r) => r.count > 0)?.stage.id,
    total: entries.filter((e) => known.has(e.stage)).length,
  }
}
export const passedInvestors = (k: Kpi) => k.investors.filter((i) => i.stage === 'passed')

/** Accounts at a stage or any later one. */
export function atOrPast(k: Kpi, stageId?: string) {
  const at = k.accountStages.findIndex((s) => s.id === stageId)
  if (at < 0) return 0
  const later = new Set(k.accountStages.slice(at).map((s) => s.id))
  return k.accounts.filter((a) => later.has(a.stage)).length
}

// ---------- milestones ----------
export function milestoneActual(k: Kpi, m: KpiMilestone) {
  if (m.source === 'investors') return investorMoney(k).committed
  if (m.source === 'round') return roundStatus(k).total
  if (m.source === 'stage') return atOrPast(k, m.stage)
  return m.actual ?? 0
}
export const isMoneyMilestone = (m: KpiMilestone) => m.source === 'investors' || m.source === 'round' || (!!m.money && (m.source ?? 'manual') === 'manual')

export type MilestoneRow = { m: KpiMilestone; actual: number; progress: number; met: boolean; days?: number }
/** `days`: until the due date (negative = late). */
export function milestoneRows(k: Kpi, today: string): MilestoneRow[] {
  return k.milestones.map((m) => {
    const actual = milestoneActual(k, m)
    const met = m.target > 0 ? actual >= m.target : false
    return { m, actual, progress: Math.min(1, share(actual, m.target)), met, days: m.due ? differenceInCalendarDays(parseISO(m.due), parseISO(today)) : undefined }
  })
}
/** The open milestone whose deadline comes first: what the team should push on next. */
export const nearestBehind = (rows: MilestoneRow[]) =>
  rows.filter((r) => !r.met && r.days != null).sort((a, b) => a.days! - b.days!)[0] as MilestoneRow | undefined

// ---------- money ----------
export function moneyStatus(k: Kpi) {
  const months = [...k.months].filter((m) => /^\d{4}-\d{2}$/.test(m.month)).sort((a, b) => a.month.localeCompare(b.month))
  const withRevenue = months.filter((m) => m.revenue != null)
  const latest = withRevenue.at(-1)
  const prev = withRevenue.at(-2)
  const cashMonths = months.filter((m) => m.cash != null)
  const cash = cashMonths.at(-1)
  // net burn: average of (cost - revenue) over the last three months that have a cost
  const costed = months.filter((m) => m.cost != null).slice(-3)
  const burn = costed.length ? sum(costed.map((m) => (m.cost ?? 0) - (m.revenue ?? 0))) / costed.length : undefined
  return {
    months,
    latest,
    prev,
    profit: latest && latest.cost != null ? (latest.revenue ?? 0) - latest.cost : undefined,
    revenueToDate: sum(months.map((m) => m.revenue ?? 0)),
    costToDate: months.some((m) => m.cost != null) ? sum(months.map((m) => m.cost ?? 0)) : undefined,
    cash,
    burn,
    // months the bank balance lasts at that burn; undefined when there is no cash figure or no burn
    runway: cash?.cash != null && burn != null && burn > 0 ? cash.cash / burn : undefined,
  }
}
export const monthLabel = (m: string, long = false) => format(parseISO(m + '-01'), long ? 'MMM yyyy' : 'MMM')
export const nextMonth = (months: { month: string }[], today: string) => {
  const last = [...months].map((m) => m.month).sort().at(-1)
  return last ? format(addMonths(parseISO(last + '-01'), 1), 'yyyy-MM') : today.slice(0, 7)
}

// ---------- weekly activity ----------
export const mondayOf = (day: string) => iso(startOfWeek(parseISO(day), { weekStartsOn: 1 }))
/** The last `n` Mondays, oldest first, ending with this week's. */
export const lastWeeks = (today: string, n = 8) => Array.from({ length: n }, (_, i) => iso(addDays(parseISO(mondayOf(today)), (i - n + 1) * 7)))
export function weekly(k: Kpi, today: string, n = 8) {
  const weeks = lastWeeks(today, n)
  const byWeek = new Map(k.weeks.map((w) => [w.week, w]))
  const series = WEEK_METRICS.map(({ key, label }) => {
    const values = weeks.map((w) => byWeek.get(w)?.[key])
    return { key, label, values, total: sum(values.map((v) => v ?? 0)), entered: values.some((v) => v != null) }
  })
  return { weeks, series }
}

// ---------- readiness ----------
export function readiness(k: Kpi) {
  const scored = k.areas.filter((a) => a.score != null && a.score > 0)
  const weakest = [...scored].sort((a, b) => a.score! - b.score!)[0]
  return { scored: scored.length, total: k.areas.length, average: scored.length ? sum(scored.map((a) => a.score!)) / scored.length : undefined, weakest: weakest?.id }
}

// ---------- pipeline value ----------
export function opportunities(k: Kpi) {
  const plotted = k.accounts.filter((a) => a.value != null && a.value > 0 && a.chance != null).map((a) => ({ ...a, weighted: (a.value! * Math.min(100, Math.max(0, a.chance!))) / 100 }))
  const largest = [...plotted].sort((a, b) => b.weighted - a.weighted)[0]
  return { plotted, weighted: sum(plotted.map((a) => a.weighted)), largest: largest?.id, missing: k.accounts.filter((a) => !plotted.some((p) => p.id === a.id)).map((a) => a.name) }
}

// ---------- team ----------
/** The joining or leaving date that comes first (upcoming before past). */
export function nextTeamChange(k: Kpi, today: string) {
  const dated = k.team.filter((p) => p.status !== 'active' && p.date)
  const upcoming = dated.filter((p) => p.date! >= today).sort((a, b) => a.date!.localeCompare(b.date!))
  return (upcoming[0] ?? dated.sort((a, b) => b.date!.localeCompare(a.date!))[0])?.id
}

// ---------- ladders fed by a board ----------
const norm = (s: string) => s.trim().toLowerCase()
/** First guess at label -> stage: same name, or one name inside the other; investor labels like "Passed" or "Declined" -> passed. */
export function autoMap(labels: { id: string; name: string }[], stages: KpiStage[], passed: boolean) {
  const map: Record<string, string> = {}
  for (const l of labels) {
    const n = norm(l.name)
    const hit = stages.find((s) => norm(s.name) === n) ?? stages.find((s) => n && (norm(s.name).includes(n) || n.includes(norm(s.name))))
    if (hit) map[l.id] = hit.id
    else if (passed && /pass|declin|lost|rejected|not interested/.test(n)) map[l.id] = 'passed'
  }
  return map
}
/** Entries of a linked board: `items` are its live top-level items. Labels with no stage are left out. */
export function linkedEntries(link: KpiLink, board: Board, items: Item[]) {
  const col = board.columns.find((c) => c.id === link.columnId)
  const num = (colId: string | undefined, i: Item) => {
    const v = colId ? Number(i.values[colId]) : NaN
    return colId && i.values[colId] != null && i.values[colId] !== '' && Number.isFinite(v) ? v : undefined
  }
  const entries: { id: string; name: string; stage: string; amount?: number; chance?: number }[] = []
  const skipped = new Map<string, number>() // label name (or "No status") -> items left out
  for (const i of items) {
    if (i.boardId !== board.id || i.parentId) continue
    const labelId = i.values[link.columnId] as string | undefined
    const stage = labelId ? link.map[labelId] : undefined
    if (!stage) {
      const name = col?.labels?.find((l) => l.id === labelId)?.name ?? 'No status'
      skipped.set(name, (skipped.get(name) ?? 0) + 1)
      continue
    }
    const amount = num(link.amountColumnId, i)
    entries.push({ id: i.id, name: i.name, stage, amount: amount != null && link.monthly ? amount * 12 : amount, chance: num(link.chanceColumnId, i) })
  }
  return { entries, skipped: [...skipped].map(([name, count]) => ({ name, count })) }
}
/** A linked board this person can open and that is not archived or in the trash. */
export const linkedBoard = (link: KpiLink | undefined, boards: Record<string, Board>) => {
  const b = link && boards[link.boardId]
  return b && !b.archived && !b.deletedAt ? b : undefined
}
/** The board as the panels see it: linked ladders replaced by their board's items (none if the board is gone or hidden). */
export function withLinks(k: Kpi, boards: Record<string, Board>, items: Item[]): Kpi {
  let out = k
  if (k.investorLink) {
    const b = linkedBoard(k.investorLink, boards)
    out = { ...out, investors: b ? linkedEntries(k.investorLink, b, items).entries.map(({ id, name, stage, amount }) => ({ id, name, stage, amount })) : [] }
  }
  if (k.accountLink) {
    const b = linkedBoard(k.accountLink, boards)
    out = { ...out, accounts: b ? linkedEntries(k.accountLink, b, items).entries.map(({ id, name, stage, amount, chance }) => ({ id, name, stage, value: amount, chance })) : [] }
  }
  return out
}

// ---------- the example board (local mode only; every name is invented) ----------
export function exampleKpi(meId: string, today: string): Kpi {
  const k = newKpi(meId, 'Northwind', [meId])
  k.company = 'Northwind Labs (example)'
  const [, , , i3, i4, i5] = k.investorStages
  const [a0, a1, a2, a3, a4, a5, a6] = k.accountStages
  const thisMonth = parseISO(today.slice(0, 7) + '-01')
  const mon = (n: number) => format(addMonths(thisMonth, n), 'yyyy-MM')
  const day = (n: number) => iso(addDays(parseISO(today), n))
  k.round = { target: 1_200_000, investorTarget: 500_000, government: 600_000, close: day(75) }
  k.investors = [
    { id: rid('v_'), name: 'Harbour Ventures', stage: i4.id, amount: 150_000 },
    { id: rid('v_'), name: 'Juniper Angels', stage: i5.id, amount: 50_000 },
    { id: rid('v_'), name: 'Lakeside Capital', stage: i3.id },
    { id: rid('v_'), name: 'Oakline Partners', stage: i3.id },
    { id: rid('v_'), name: 'Fjord Seed', stage: k.investorStages[2].id },
    { id: rid('v_'), name: 'Copper Hill', stage: k.investorStages[2].id },
    { id: rid('v_'), name: 'Meridian Fund', stage: k.investorStages[1].id },
    { id: rid('v_'), name: 'Northstar Syndicate', stage: k.investorStages[0].id },
    { id: rid('v_'), name: 'Granite Ventures', stage: 'passed', note: 'later stage only' },
  ]
  k.accounts = [
    { id: rid('c_'), name: 'Atlas Media', stage: a6.id, value: 26_000, chance: 100 },
    { id: rid('c_'), name: 'Riverside Radio', stage: a5.id, value: 18_000, chance: 60 },
    { id: rid('c_'), name: 'Polar Broadcasting', stage: a4.id, value: 40_000, chance: 35 },
    { id: rid('c_'), name: 'Summit Learning', stage: a4.id, value: 12_000, chance: 40 },
    { id: rid('c_'), name: 'Kestrel Studios', stage: a3.id, value: 9_000, chance: 50 },
    { id: rid('c_'), name: 'Bluebell News', stage: a2.id, value: 22_000, chance: 25 },
    { id: rid('c_'), name: 'Orchard EdTech', stage: a2.id },
    { id: rid('c_'), name: 'Tidewater FM', stage: a1.id, value: 8_000, chance: 15 },
    { id: rid('c_'), name: 'Granite Sports', stage: a0.id },
    { id: rid('c_'), name: 'Lumen Podcasts', stage: a0.id, value: 6_000, chance: 10 },
  ]
  k.accountFocus = a2.id
  k.milestones = [
    { id: rid('m_'), name: 'First written investor commitment', target: 1, actual: 0, due: day(6) },
    { id: rid('m_'), name: 'Signed LOIs', target: 4, due: day(36), source: 'stage', stage: a3.id },
    { id: rid('m_'), name: 'Paying customers', target: 5, due: day(160), source: 'stage', stage: a6.id },
    { id: rid('m_'), name: 'Investor money committed', target: 500_000, due: day(75), source: 'investors' },
    { id: rid('m_'), name: 'Whole round with grants', target: 1_200_000, due: day(75), source: 'round' },
    { id: rid('m_'), name: 'Website relaunch', target: 1, actual: 1, due: day(-12) },
  ]
  k.months = [-5, -4, -3, -2, -1, 0].map((n, i) => ({
    id: rid('mo_'),
    month: mon(n),
    revenue: [0, 0, 1_200, 2_600, 2_600, 3_400][i],
    cost: [9_800, 10_400, 11_000, 11_600, 12_100, 12_400][i],
    cash: [182_000, 171_600, 161_800, 152_800, 143_300, 134_300][i],
  }))
  k.weeks = lastWeeks(today).map((week, i) => ({
    id: rid('w_'),
    week,
    customer: [2, 3, 1, 4, 3, 5, 4, 2][i],
    investor: [1, 2, 3, 2, 4, 3, 2, 1][i],
    outreach: [14, 20, 9, 25, 18, 22, 16, 8][i],
    lois: [0, 1, 0, 0, 1, 1, 0, 0][i],
  }))
  k.areas = k.areas.map((a, i) => ({ ...a, score: [4, 3, 2, 3, 4][i] }))
  k.team = [
    { id: rid('p_'), name: 'Alex Rivera', role: 'CEO', fte: 1, status: 'active' },
    { id: rid('p_'), name: 'Sam Okafor', role: 'CTO', fte: 1, status: 'active' },
    { id: rid('p_'), name: 'Jo Lindqvist', role: 'Sales', fte: 0.8, status: 'active' },
    { id: rid('p_'), name: 'Mika Tanaka', role: 'Engineering', fte: 1, status: 'leaving', date: day(40) },
    { id: rid('p_'), name: 'Rae Collins', role: 'Operations intern', fte: 0.5, status: 'joining', date: day(12) },
  ]
  k.roles = [
    { id: rid('r_'), role: 'Founding engineer', candidates: 6, interviews: 2 },
    { id: rid('r_'), role: 'Fractional CFO', candidates: 2, interviews: 1, offer: true },
  ]
  return k
}

// The panels of a KPI board. Each reads one slice of the document and edits it in place.
import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceDot, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { saveKpi } from '../lib/store'
import {
  WEEK_METRICS, compact, isMoneyMilestone, ladder, lastWeeks, milestoneRows, money, monthLabel, moneyStatus, nearestBehind, nextMonth, nextTeamChange,
  opportunities, passedInvestors, pct, readiness, roundStatus, share, weekly, type MilestoneRow, type WeekKey,
} from '../lib/kpi'
import type { Kpi, KpiAccount, KpiArea, KpiInvestor, KpiMilestone, KpiMonth, KpiPerson, KpiRole, KpiStage, KpiWeek } from '../lib/types'
import { DueTime } from '../components/departure'
import { cx } from '../components/ui'
import { ChartTip, Empty, Field, FieldInput, Fig, Headline, Ladder, Meter, MiniColumns, Panel, PctBox, Pips, RowsEditor, Segmented, type Col } from './parts'

export type PanelProps = { k: Kpi; editable: boolean; today: string }
const rid = (p: string) => p + Math.random().toString(36).slice(2, 10)

// ---------- list edits that always apply to the latest copy ----------
type Lists = { investors: KpiInvestor; accounts: KpiAccount; milestones: KpiMilestone; months: KpiMonth; weeks: KpiWeek; areas: KpiArea; team: KpiPerson; roles: KpiRole; investorStages: KpiStage; accountStages: KpiStage }
const nameOf = (r: object) => {
  const x = r as { name?: string; role?: string; month?: string }
  const n = (x.name ?? x.role ?? x.month ?? '').trim()
  return n ? `“${n}”` : 'an empty row'
}
function ops<L extends keyof Lists>(id: string, list: L) {
  type R = Lists[L]
  const rows = (k: Kpi) => k[list] as unknown as R[]
  const set = (k: Kpi, next: R[]) => ({ ...k, [list]: next })
  return {
    patch: (rowId: string, key: string, value: unknown) => saveKpi(id, (k) => set(k, rows(k).map((r) => (r.id === rowId ? { ...r, [key]: value } : r)))),
    add: (row: R) => saveKpi(id, (k) => set(k, [...rows(k), row])),
    remove: (rowId: string, before: Kpi) => {
      const at = rows(before).findIndex((r) => r.id === rowId)
      const row = rows(before)[at]
      if (!row) return
      saveKpi(id, (k) => set(k, rows(k).filter((r) => r.id !== rowId)))
      toast(`Removed ${nameOf(row)}`, {
        action: { label: 'Undo', onClick: () => saveKpi(id, (k) => (rows(k).some((r) => r.id === rowId) ? k : set(k, [...rows(k).slice(0, at), row, ...rows(k).slice(at)]))) },
      })
    },
  }
}

const axisTick = { fill: 'var(--faint)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }
/** Round ticks from zero (steps of 1, 2, 2.5 or 5 times a power of ten), all labelled in one style. */
function moneyAxis(max: number, cur: string) {
  const raw = Math.max(max, 1) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)!
  const ticks = Array.from({ length: Math.ceil(Math.max(max, 1) / step) + 1 }, (_, i) => i * step)
  const top = ticks.at(-1)!
  const tickFormatter = (v: number) => cur + (top >= 10_000 && v ? `${Number((v / 1000).toFixed(1))}k` : v.toLocaleString('en'))
  return { ticks, domain: [0, top] as [number, number], tickFormatter }
}
const Legend = ({ items }: { items: [string, string][] }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1">
    {items.map(([name, cls]) => (
      <li key={name} className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <span className={cx('size-2.5 rounded-[2px]', cls)} /> {name}
      </li>
    ))}
  </ul>
)
const days = (n: number) => (n === 0 ? 'due today' : n > 0 ? `${n} day${n === 1 ? '' : 's'} left` : `${-n} day${n === -1 ? '' : 's'} late`)
const fmtFor = (k: Kpi, m: KpiMilestone) => (v: number) => (isMoneyMilestone(m) ? money(v, k.currency) : compact(v))

// ---------- the line above everything: what is behind and due first ----------
export function Notice({ k, today }: { k: Kpi; today: string }) {
  const next = nearestBehind(milestoneRows(k, today))
  if (!next) return null
  const f = fmtFor(k, next.m)
  const late = next.days! < 0
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-ink px-5 py-3.5 text-on-ink dark:border dark:border-line-strong">
      <span className={cx('caps shrink-0 rounded-sm px-2 py-1 text-[12px] font-bold leading-none tracking-[0.14em]', late ? 'bg-alert text-white' : 'bg-signal text-on-signal')}>
        {late ? 'Late' : 'Next deadline'}
      </span>
      <p className="min-w-0 flex-1 text-[14.5px] leading-snug">
        <b className="font-semibold">{next.m.name}</b> <span className="text-on-ink-muted">is at</span> <b className="font-mono font-semibold">{f(next.actual)}</b>{' '}
        <span className="text-on-ink-muted">of</span> <b className="font-mono font-semibold">{f(next.m.target)}</b>
        <span className="text-on-ink-muted">, due </span>
        <span className="font-mono">{format(parseISO(next.m.due!), 'EEE d MMM').toUpperCase()}</span>
        <span className={cx('ml-2 font-mono text-[13px]', late ? 'text-[#ff8a8e]' : 'text-on-ink-muted')}>({days(next.days!)})</span>
      </p>
    </div>
  )
}

// ---------- headline strip ----------
export function Tiles({ k, today }: { k: Kpi; today: string }) {
  const $ = (n?: number) => money(n, k.currency)
  const r = roundStatus(k)
  const m = moneyStatus(k)
  const o = opportunities(k)
  const rows = milestoneRows(k, today)
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: 'Round', value: r.target ? pct(r.progress) : '—', sub: r.target ? `${$(r.total)} of ${$(r.target)}` : 'No round target yet' },
    { label: 'Investors, firm', value: $(r.committed), sub: r.soft ? `+ ${$(r.soft)} soft` : r.investorTarget ? `of ${$(r.investorTarget)}` : 'In writing or paid in' },
    { label: m.latest ? `Revenue, ${monthLabel(m.latest.month)}` : 'Revenue', value: m.latest ? $(m.latest.revenue) : '—', sub: m.prev?.revenue != null && m.latest?.revenue != null ? delta(m.latest.revenue - m.prev.revenue, k.currency, monthLabel(m.prev.month)) : 'Latest month' },
    { label: 'Runway', value: m.runway != null ? m.runway.toFixed(m.runway < 10 ? 1 : 0) : m.burn != null && m.burn <= 0 ? '∞' : '—', sub: m.runway != null ? `months at ${$(m.burn)} net burn` : m.burn != null && m.burn <= 0 ? 'Revenue covers cost' : 'Needs cash and cost' },
    { label: 'Pipeline value', value: $(o.weighted), sub: `value × chance, ${o.plotted.length} account${o.plotted.length === 1 ? '' : 's'}` },
    { label: 'Targets met', value: `${rows.filter((x) => x.met).length}/${rows.length}`, sub: rows.length ? `${rows.filter((x) => !x.met && (x.days ?? 1) < 0).length} late` : 'No milestones yet' },
  ]
  return (
    <section aria-label="Headline numbers" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="min-w-0 bg-panel px-4 pb-4 pt-3.5">
          <div className="caps truncate text-[12px] font-semibold tracking-[0.12em] text-muted">{t.label}</div>
          <div key={t.value} className="flap mt-2 truncate font-mono text-[28px] font-semibold leading-none tracking-[-0.03em]">{t.value}</div>
          <div className="mt-2 truncate text-[12.5px] text-faint">{t.sub}</div>
        </div>
      ))}
    </section>
  )
}
const delta = (d: number, cur: string, vs: string) => (d === 0 ? `flat on ${vs}` : `${d > 0 ? '+' : '−'}${money(Math.abs(d), cur)} on ${vs}`)

// ---------- milestones ----------
export function Milestones({ k, editable, today }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const rows = milestoneRows(k, today)
  const next = nearestBehind(rows)
  const o = ops(k.id, 'milestones')
  const stageOpts = k.accountStages.map((s) => ({ value: s.id, label: s.name }))
  const cols: Col<KpiMilestone>[] = [
    { key: 'name', label: 'Milestone', type: 'text', width: '30%', placeholder: 'e.g. Signed LOIs' },
    {
      key: 'source', label: 'Counted from', type: 'select', width: '20%',
      options: [{ value: '', label: 'Typed in' }, { value: 'investors', label: 'Firm investor money' }, { value: 'round', label: 'Whole round' }, { value: 'stage', label: 'Accounts at stage' }],
    },
    { key: 'stage', label: 'Stage, or later', type: 'select', width: '16%', options: [{ value: '', label: '—' }, ...stageOpts], disabled: (r) => r.source !== 'stage' },
    { key: 'actual', label: 'Actual', type: 'number', width: '11%', disabled: (r) => !!r.source && r.source !== 'manual', hint: (r) => fmtFor(k, r)(milestoneRows({ ...k, milestones: [r] }, today)[0].actual) },
    { key: 'target', label: 'Target', type: 'number', width: '11%' },
    { key: 'money', label: k.currency, type: 'check', width: '7%', disabled: (r) => !!r.source && r.source !== 'manual' },
    { key: 'due', label: 'Due', type: 'date', width: '15%' },
  ]
  return (
    <Panel title="Milestones, actual vs target" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className={editing ? 'lg:col-span-12' : 'lg:col-span-7'}>
      <Headline value={`${rows.filter((r) => r.met).length} of ${rows.length}`} note="Each bar measures actual against its own target. Ink marks the nearest deadline still open.">
        targets met
      </Headline>
      {rows.length ? (
        <ul className="-mt-1 flex flex-col">
          {[...rows].sort(byDue).map((r) => <MilestoneLine key={r.m.id} r={r} k={k} hi={r.m.id === next?.m.id} />)}
        </ul>
      ) : (
        !editing && <Empty>{editable ? 'Add the targets that matter this quarter: signed LOIs, paying customers, money committed. Use Edit.' : 'No milestones yet.'}</Empty>
      )}
      {editing && (
        <RowsEditor
          rows={k.milestones}
          cols={cols}
          readOnly={!editable}
          rowLabel={(r) => r.name}
          onPatch={(id, key, v) => (key === 'target' ? o.patch(id, key, v ?? 0) : o.patch(id, key, v))}
          onRemove={(id) => o.remove(id, k)}
          onAdd={() => o.add({ id: rid('m_'), name: '', target: 1, actual: 0 })}
          addLabel="Add milestone"
        />
      )}
    </Panel>
  )
}
const byDue = (a: MilestoneRow, b: MilestoneRow) => (a.m.due ?? '9999').localeCompare(b.m.due ?? '9999')
function MilestoneLine({ r, k, hi }: { r: MilestoneRow; k: Kpi; hi: boolean }) {
  const f = fmtFor(k, r.m)
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className={cx('truncate text-[14px]', hi ? 'font-semibold text-fg' : 'text-fg')}>{r.m.name || 'Untitled'}</span>
          {r.met && <span className="caps shrink-0 rounded-sm border border-line-strong px-1.5 pb-px pt-[2px] text-[10.5px] font-semibold leading-none tracking-[0.12em] text-muted">Met</span>}
        </div>
        <Meter className="mt-2" value={r.progress} hi={hi} label={`${r.m.name}: ${f(r.actual)} of ${f(r.m.target)}`} />
        <div className="mt-1.5 flex items-center justify-between gap-3 font-mono text-[12px] tabular-nums text-faint">
          <span>
            {f(r.actual)} of {f(r.m.target)}
          </span>
          {r.m.due ? <DueTime date={r.m.due} done={r.met} className="[&>span:nth-child(2)]:text-[13px]" /> : <span>no deadline</span>}
        </div>
      </div>
      <PctBox value={pct(r.progress)} hi={hi} />
    </li>
  )
}

// ---------- the round ----------
export function Round({ k, editable, today }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const r = roundStatus(k)
  const closeIn = k.round.close ? differenceInCalendarDays(parseISO(k.round.close), parseISO(today)) : undefined
  const $ = (n?: number) => money(n, k.currency)
  const setRound = (key: keyof Kpi['round'], v: unknown) => saveKpi(k.id, (x) => ({ ...x, round: { ...x.round, [key]: v } }))
  return (
    <Panel title="The round" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className="lg:col-span-5">
      <Headline value={r.target ? $(r.open) : '—'} note="Government money and firm investor money count as raised. Soft commits are shown, not counted.">
        {r.target ? <>still to raise of <Fig>{$(r.target)}</Fig></> : 'Set the round target with Edit'}
      </Headline>
      {r.target > 0 && (
        <>
          <div className="space-y-4">
            <MeterLine label="Whole round" figures={`${$(r.total)} of ${$(r.target)}`} value={r.progress} hi />
            <MeterLine
              label="Private investors"
              figures={`${$(r.committed)}${r.investorTarget ? ` of ${$(r.investorTarget)}` : ''}${r.soft ? ` · ${$(r.soft)} soft` : ''}`}
              value={share(r.committed, r.investorTarget)}
              soft={share(r.soft, r.investorTarget)}
              noTarget={!r.investorTarget}
            />
          </div>
          <Segmented
            label="Round composition"
            parts={[
              { name: 'Government, committed', value: r.government, tone: 'hi', display: $(r.government) },
              { name: 'Investors, committed', value: r.committed, tone: 'lo', display: $(r.committed) },
              { name: 'Still open', value: r.open, tone: 'track', display: $(r.open) },
            ]}
          />
        </>
      )}
      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-[13px] text-muted">
        <span className="caps text-[12px] font-semibold tracking-[0.12em]">Close date</span>
        {k.round.close ? (
          <span className="flex items-center gap-3">
            {closeIn != null && closeIn > 0 && <span className="font-mono text-[12px] text-faint">in {closeIn} days</span>}
            <DueTime date={k.round.close} done={r.target > 0 && r.open === 0} />
          </span>
        ) : (
          <span className="font-mono text-faint">—</span>
        )}
      </div>
      {editing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Round target"><FieldInput label="Round target" number value={k.round.target} disabled={!editable} onCommit={(v) => setRound('target', v)} placeholder="1.2M" /></Field>
          <Field label="From private investors"><FieldInput label="From private investors" number value={k.round.investorTarget} disabled={!editable} onCommit={(v) => setRound('investorTarget', v)} placeholder="500k" /></Field>
          <Field label="Government, committed" hint="Grants and public funding that are confirmed"><FieldInput label="Government, committed" number value={k.round.government} disabled={!editable} onCommit={(v) => setRound('government', v)} placeholder="700k" /></Field>
          <Field label="Close date"><FieldInput label="Close date" type="date" value={k.round.close} disabled={!editable} onCommit={(v) => setRound('close', v)} /></Field>
          <Field label="Currency" hint="Shown before every amount on this board"><FieldInput label="Currency" value={k.currency} disabled={!editable} onCommit={(v) => typeof v === 'string' && saveKpi(k.id, (x) => ({ ...x, currency: v.slice(0, 4) }))} /></Field>
          <p className="self-end pb-1 text-[12.5px] leading-snug text-faint">
            Investor money is counted from the investor funnel: amounts at stages marked firm count as committed. Today: <Fig>{$(r.committed)}</Fig>.
          </p>
        </div>
      )}
    </Panel>
  )
}
function MeterLine({ label, figures, value, soft, hi, noTarget }: { label: string; figures: string; value: number; soft?: number; hi?: boolean; noTarget?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cx('text-[14px]', hi && 'font-semibold')}>{label}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{noTarget ? '' : pct(value)}</span>
      </div>
      {!noTarget && <Meter className="mt-2" value={value} soft={soft} hi={hi} label={`${label}: ${figures}`} />}
      <div className="mt-1.5 font-mono text-[12px] tabular-nums text-faint">{figures}</div>
    </div>
  )
}

// ---------- money ----------
export function Money({ k, editable, today }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const m = moneyStatus(k)
  const $ = (n?: number) => money(n, k.currency)
  const o = ops(k.id, 'months')
  const cash = m.months.filter((x) => x.cash != null)
  const last = cash.at(-1)
  const cols: Col<KpiMonth>[] = [
    { key: 'month', label: 'Month', type: 'month', width: '28%' },
    { key: 'revenue', label: 'Revenue', type: 'number', width: '24%' },
    { key: 'cost', label: 'Cost', type: 'number', width: '24%' },
    { key: 'cash', label: 'Cash at month end', type: 'number', width: '24%' },
  ]
  return (
    <Panel title="Money" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className="lg:col-span-12">
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <Headline
            value={m.latest ? $(m.latest.revenue) : '—'}
            note={m.months.length ? `Revenue and cost per month, ${monthLabel(m.months[0].month, true)} to ${monthLabel(m.months.at(-1)!.month, true)}. Revenue to date ${$(m.revenueToDate)}${m.costToDate != null ? `, cost to date ${$(m.costToDate)}` : ''}.` : undefined}
          >
            {m.latest ? <>revenue in {monthLabel(m.latest.month, true)}, profit <Fig>{m.profit != null ? $(m.profit) : '—'}</Fig></> : 'No months entered yet'}
          </Headline>
          {m.months.length ? (
            <>
              <Legend items={[['Revenue', 'bg-chart-hi'], ['Cost', 'bg-chart-lo']]} />
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.months} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="month" tickFormatter={(v) => monthLabel(v)} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tick={axisTick} />
                    <YAxis width={54} tickLine={false} axisLine={false} tick={axisTick} {...moneyAxis(Math.max(...m.months.map((x) => Math.max(x.revenue ?? 0, x.cost ?? 0))), k.currency)} />
                    <Tooltip cursor={{ fill: 'var(--hover)' }} content={<ChartTip title={(l) => monthLabel(l, true)} fmt={(v) => $(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill="var(--chart-hi)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                    <Bar dataKey="cost" name="Cost" fill="var(--chart-lo)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            !editing && <Empty>{editable ? 'Add a row per month with revenue, cost and the bank balance at month end. Use Edit.' : 'No months entered yet.'}</Empty>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Headline
            value={last ? $(last.cash) : '—'}
            note={m.burn != null ? `Net burn is the average of cost minus revenue over the last ${Math.min(3, m.months.filter((x) => x.cost != null).length)} months with a cost.` : 'Runway needs a bank balance and at least one month with a cost.'}
          >
            {last ? (
              <>
                in the bank, end of {monthLabel(last.month, true)}
                {m.runway != null && (
                  <>
                    , <Fig>{m.runway.toFixed(1)}</Fig> months of runway at <Fig>{$(m.burn)}</Fig> a month
                  </>
                )}
                {m.burn != null && m.burn <= 0 && ', revenue covers cost'}
              </>
            ) : (
              'No bank balance entered yet'
            )}
          </Headline>
          {cash.length > 0 && (
            <div className="h-[244px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.months} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="month" tickFormatter={(v) => monthLabel(v)} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tick={axisTick} />
                  <YAxis width={54} tickLine={false} axisLine={false} tick={axisTick} {...moneyAxis(Math.max(...cash.map((x) => x.cash ?? 0)), k.currency)} />
                  <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={<ChartTip title={(l) => monthLabel(l, true)} fmt={(v) => $(v)} />} />
                  <Area type="linear" dataKey="cash" name="Cash in bank" stroke="var(--chart-hi)" strokeWidth={2} fill="var(--chart-hi)" fillOpacity={0.08} connectNulls isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: 'var(--panel)', strokeWidth: 2, fill: 'var(--chart-hi)' }} />
                  {last && <ReferenceDot x={last.month} y={last.cash} r={4} fill="var(--chart-hi)" stroke="var(--panel)" strokeWidth={2} />}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <RowsEditor
          rows={[...k.months].sort((a, b) => b.month.localeCompare(a.month))}
          cols={cols}
          readOnly={!editable}
          rowLabel={(r) => r.month}
          onPatch={(id, key, v) => (key === 'month' && !v ? undefined : o.patch(id, key, v))}
          onRemove={(id) => o.remove(id, k)}
          onAdd={() => o.add({ id: rid('mo_'), month: nextMonth(k.months, today) })}
          addLabel="Add month"
          caption="Newest first. Amounts accept 2,600, 12k or 1.2M."
        />
      )}
    </Panel>
  )
}

// ---------- the two ladders ----------
function StagesEditor({ k, list, money: withMoney, readOnly }: { k: Kpi; list: 'investorStages' | 'accountStages'; money?: boolean; readOnly: boolean }) {
  const o = ops(k.id, list)
  const users = list === 'investorStages' ? k.investors : k.accounts
  const cols: Col<KpiStage>[] = [{ key: 'name', label: 'Stage, earliest first', type: 'text', width: withMoney ? '62%' : '100%' }]
  if (withMoney) cols.push({ key: 'money', label: 'Money here counts as', type: 'select', width: '38%', options: [{ value: '', label: 'Not yet' }, { value: 'soft', label: 'Soft commit' }, { value: 'committed', label: 'Firm' }] })
  return (
    <details className="group rounded-md border border-line px-3 py-2 [&[open]]:pb-3">
      <summary className="caps cursor-pointer text-[12px] font-semibold tracking-[0.12em] text-muted marker:text-faint">Stages</summary>
      <div className="mt-2">
        <RowsEditor
          rows={k[list]}
          cols={cols}
          readOnly={readOnly}
          rowLabel={(r) => r.name}
          onPatch={(id, key, v) => (key === 'name' && !v ? undefined : o.patch(id, key, v))}
          onRemove={(id) => {
            const n = users.filter((u) => u.stage === id).length
            const used = k.milestones.some((m) => m.source === 'stage' && m.stage === id)
            if (n) return void toast.error(`Move the ${n} at this stage to another stage first`)
            if (used) return void toast.error('A milestone counts this stage. Change that milestone first')
            o.remove(id, k)
          }}
          onAdd={() => o.add({ id: rid('s_'), name: 'New stage' })}
          addLabel="Add stage (furthest)"
        />
      </div>
    </details>
  )
}
const FocusPick = ({ list, value, onChange, disabled }: { list: KpiStage[]; value?: string; onChange: (v?: string) => void; disabled: boolean }) => (
  <label className="flex items-center gap-2 text-[13px] text-muted">
    Highlight
    <select value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || undefined)} className="h-8 rounded-md border border-line-strong bg-panel px-2 text-[13px] text-fg outline-none focus:border-accent">
      <option value="">Furthest reached</option>
      {[...list].reverse().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  </label>
)

export function Investors({ k, editable }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const l = ladder(k.investorStages, k.investors, k.investorFocus)
  const passed = passedInvestors(k)
  const r = roundStatus(k)
  const $ = (n?: number) => money(n, k.currency)
  const o = ops(k.id, 'investors')
  const stageOpts = [...k.investorStages.map((s) => ({ value: s.id, label: s.name })), { value: 'passed', label: 'Passed' }]
  const cols: Col<KpiInvestor>[] = [
    { key: 'name', label: 'Investor', type: 'text', width: '30%', placeholder: 'Fund or angel' },
    { key: 'stage', label: 'Stage', type: 'select', width: '24%', options: stageOpts },
    { key: 'amount', label: 'Ticket', type: 'number', width: '16%' },
    { key: 'note', label: 'Note', type: 'text', width: '30%', placeholder: 'Next step, reason passed…' },
  ]
  return (
    <Panel title="Investor funnel" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className={editing ? 'lg:col-span-12' : 'lg:col-span-6'}>
      <Headline value={String(l.total)} note={`Where each investor stands today, furthest stage on top. Ink: ${k.investorFocus ? 'the stage the team is pushing' : 'the furthest stage reached'}.`}>
        investors in talks{r.committed || r.soft ? <>, <Fig>{$(r.committed)}</Fig> firm, <Fig>{$(r.soft)}</Fig> soft</> : null}
      </Headline>
      {k.investors.length ? <Ladder rows={l.rows} max={l.max} focus={l.focus} /> : !editing && <Empty>{editable ? 'List the investors you talk to and the stage each one is at. Use Edit.' : 'No investors yet.'}</Empty>}
      {passed.length > 0 && (
        <p className="border-t border-line pt-3 text-[12.5px] text-faint">
          <span className="caps mr-1.5 text-[11.5px] font-semibold tracking-[0.12em] text-muted">Passed</span>
          {passed.map((p) => p.name + (p.note ? ` (${p.note})` : '')).join(', ')}
        </p>
      )}
      {editing && (
        <>
          <FocusPick list={k.investorStages} value={k.investorFocus} disabled={!editable} onChange={(v) => saveKpi(k.id, (x) => ({ ...x, investorFocus: v }))} />
          <RowsEditor
            rows={k.investors}
            cols={cols}
            readOnly={!editable}
            rowLabel={(x) => x.name}
            onPatch={(id, key, v) => (key === 'stage' && !v ? undefined : o.patch(id, key, v))}
            onRemove={(id) => o.remove(id, k)}
            onAdd={() => o.add({ id: rid('v_'), name: '', stage: k.investorStages[0]?.id ?? 'passed' })}
            addLabel="Add investor"
          />
          <StagesEditor k={k} list="investorStages" money readOnly={!editable} />
        </>
      )}
    </Panel>
  )
}

export function Pipeline({ k, editable }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const l = ladder(k.accountStages, k.accounts, k.accountFocus)
  const lastStage = k.accountStages.at(-1)
  const atLast = lastStage ? k.accounts.filter((a) => a.stage === lastStage.id).length : 0
  const o = ops(k.id, 'accounts')
  const cols: Col<KpiAccount>[] = [
    { key: 'name', label: 'Account', type: 'text', width: '27%', placeholder: 'Company' },
    { key: 'stage', label: 'Furthest step', type: 'select', width: '20%', options: k.accountStages.map((s) => ({ value: s.id, label: s.name })) },
    { key: 'value', label: 'Value / year', type: 'number', width: '15%' },
    { key: 'chance', label: 'Chance %', type: 'number', width: '12%' },
    { key: 'note', label: 'Note', type: 'text', width: '26%', placeholder: 'Contact, next step…' },
  ]
  return (
    <Panel title="Sales pipeline" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className={editing ? 'lg:col-span-12' : 'lg:col-span-6'}>
      <Headline value={String(l.total)} note={`Accounts by the furthest step they reached. Ink: ${k.accountFocus ? 'the step the team is pushing' : 'the furthest step reached'}.`}>
        accounts{lastStage ? <>, <Fig>{atLast}</Fig> {lastStage.name.toLowerCase()}</> : null}
      </Headline>
      {k.accounts.length ? <Ladder rows={l.rows} max={l.max} focus={l.focus} /> : !editing && <Empty>{editable ? 'Add the companies you sell to, the furthest step each reached, and what they are worth a year. Use Edit.' : 'No accounts yet.'}</Empty>}
      {editing && (
        <>
          <FocusPick list={k.accountStages} value={k.accountFocus} disabled={!editable} onChange={(v) => saveKpi(k.id, (x) => ({ ...x, accountFocus: v }))} />
          <RowsEditor
            rows={k.accounts}
            cols={cols}
            readOnly={!editable}
            rowLabel={(x) => x.name}
            onPatch={(id, key, v) => (key === 'stage' && !v ? undefined : o.patch(id, key, key === 'chance' && typeof v === 'number' ? Math.max(0, Math.min(100, v)) : v))}
            onRemove={(id) => o.remove(id, k)}
            onAdd={() => o.add({ id: rid('c_'), name: '', stage: k.accountStages[0]?.id ?? '' })}
            addLabel="Add account"
          />
          <StagesEditor k={k} list="accountStages" readOnly={!editable} />
        </>
      )}
    </Panel>
  )
}

// ---------- opportunities ----------
export function Opportunities({ k, editable }: PanelProps) {
  const o = opportunities(k)
  const $ = (n?: number) => money(n, k.currency)
  const largest = o.plotted.find((p) => p.id === o.largest)
  return (
    <Panel title="Opportunities by chance and value" editable={editable} className="lg:col-span-7">
      <Headline value={$(o.weighted)} note="Across: chance of closing. Up: value per year. Size: value times chance. Ink: the largest. Values and chances are edited in Sales pipeline.">
        value times chance, <Fig>{o.plotted.length}</Fig> of <Fig>{k.accounts.length}</Fig> accounts valued
      </Headline>
      {o.plotted.length ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 16, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--line)" />
              <XAxis type="number" dataKey="chance" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tick={axisTick} />
              <YAxis type="number" dataKey="value" width={54} tickLine={false} axisLine={false} tick={axisTick} {...moneyAxis(Math.max(...o.plotted.map((p) => p.value!)), k.currency)} />
              <ZAxis type="number" dataKey="weighted" range={[140, 1100]} />
              <Tooltip cursor={false} content={<OppTip cur={k.currency} />} />
              <Scatter data={o.plotted} isAnimationActive={false} stroke="var(--panel)" strokeWidth={2}>
                {o.plotted.map((p) => <Cell key={p.id} fill={p.id === o.largest ? 'var(--chart-hi)' : 'var(--chart-lo)'} />)}
                <LabelList
                  dataKey="name"
                  content={(p) => {
                    const pt = o.plotted[p.index as number]
                    if (!largest || pt?.id !== largest.id) return null
                    const x = Number(p.x) + Number(p.width ?? 0) / 2
                    const y = Number(p.y) + Number(p.height ?? 0) / 2
                    const right = pt.chance! > 60
                    const r = Number(p.width ?? 16) / 2
                    return <text x={right ? x - r - 8 : x + r + 8} y={y} dy="0.35em" textAnchor={right ? 'end' : 'start'} fill="var(--fg)" fontSize={12.5} fontWeight={600}>{pt.name}</text>
                  }}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>Give accounts in Sales pipeline a value per year and a chance of closing to plot them here.</Empty>
      )}
      {o.missing.length > 0 && <p className="text-[12.5px] leading-snug text-faint">Not plotted, value or chance missing: {o.missing.join(', ')}</p>}
    </Panel>
  )
}
function OppTip({ active, payload, cur }: { active?: boolean; payload?: { payload: KpiAccount & { weighted: number } }[]; cur: string }) {
  const a = active ? payload?.[0]?.payload : undefined
  if (!a) return null
  return (
    <div className="rounded-md border border-line-strong bg-panel px-3 py-2 shadow-pop">
      <div className="text-[13px] font-semibold">{a.name}</div>
      <div className="mt-1 grid grid-cols-[auto_auto] gap-x-3 font-mono text-[12.5px] tabular-nums">
        <b className="font-semibold">{money(a.weighted, cur)}</b><span className="font-sans text-muted">value × chance</span>
        <span>{money(a.value, cur)}</span><span className="font-sans text-muted">per year</span>
        <span>{a.chance}%</span><span className="font-sans text-muted">chance</span>
      </div>
    </div>
  )
}

// ---------- readiness ----------
export function Readiness({ k, editable }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const r = readiness(k)
  const o = ops(k.id, 'areas')
  return (
    <Panel title="Company readiness" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className="lg:col-span-5">
      <Headline value={r.average != null ? r.average.toFixed(1) : '—'} note={`Your own score from 1 to 5.${editable ? ' Click a lamp to set it.' : ''} Ink: the weakest area.`}>
        average out of 5, <Fig>{r.scored}</Fig> of <Fig>{r.total}</Fig> areas scored
      </Headline>
      <ul className="flex flex-col">
        {k.areas.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
            <span className={cx('min-w-0 truncate text-[14px]', a.id === r.weakest && 'font-semibold')}>{a.name}</span>
            <span className="flex items-center gap-3">
              <Pips name={a.name} score={a.score} hi={a.id === r.weakest} onSet={editable ? (n) => o.patch(a.id, 'score', n) : undefined} />
              <span className={cx('w-5 text-right font-mono text-[13px] font-semibold tabular-nums', !a.score && 'text-faint')}>{a.score ?? '—'}</span>
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <RowsEditor
          rows={k.areas}
          cols={[{ key: 'name', label: 'Area', type: 'text', width: '75%' }, { key: 'score', label: 'Score', type: 'number', width: '25%' }]}
          readOnly={!editable}
          rowLabel={(x) => x.name}
          onPatch={(id, key, v) => o.patch(id, key, key === 'score' && typeof v === 'number' ? Math.max(1, Math.min(5, Math.round(v))) : v)}
          onRemove={(id) => o.remove(id, k)}
          onAdd={() => o.add({ id: rid('a_'), name: 'New area' })}
          addLabel="Add area"
        />
      )}
    </Panel>
  )
}

// ---------- weekly activity ----------
export function Activity({ k, editable, today }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const w = weekly(k, today)
  const labels = w.weeks.map((d) => 'Week of ' + format(parseISO(d), 'd MMM'))
  const lead = w.series[0]
  // the editor always shows the last 8 weeks; a week gets its row the first time a number goes in
  const rows: KpiWeek[] = [...lastWeeks(today)].reverse().map((week) => k.weeks.find((x) => x.week === week) ?? { id: 'new:' + week, week })
  const patch = (id: string, key: string, v: unknown) =>
    saveKpi(k.id, (x) => {
      const week = id.startsWith('new:') ? id.slice(4) : x.weeks.find((r) => r.id === id)?.week
      if (!week) return x
      const has = x.weeks.some((r) => r.week === week)
      return { ...x, weeks: has ? x.weeks.map((r) => (r.week === week ? { ...r, [key]: v } : r)) : [...x.weeks, { id: rid('w_'), week, [key]: v }] }
    })
  return (
    <Panel title="Weekly activity" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className="lg:col-span-12">
      <Headline value={lead.entered ? String(lead.total) : '—'} note="Weeks start on Monday. One small chart per measure on its own scale; ink is this week.">
        customer meetings in the last <Fig>8</Fig> weeks
      </Headline>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {w.series.map((s) => {
          const max = Math.max(1, ...s.values.map((v) => v ?? 0))
          return (
            <figure key={s.key} className="min-w-0">
              <figcaption className="flex items-baseline justify-between gap-3">
                <span className="caps truncate text-[12px] font-semibold tracking-[0.12em] text-muted">{s.label}</span>
                <span className="font-mono text-[12px] text-faint">
                  this week <b className="text-[14px] font-semibold text-fg">{s.values.at(-1) ?? '—'}</b>
                </span>
              </figcaption>
              <div className="mt-1 font-mono text-[22px] font-semibold leading-none tracking-[-0.02em]">{s.entered ? s.total : '—'}</div>
              <div className="mt-3">
                <MiniColumns values={s.values} labels={labels} max={max} />
                <div className="mt-1 flex justify-between font-mono text-[11px] uppercase text-faint">
                  <span>{format(parseISO(w.weeks[0]), 'd MMM')}</span>
                  <span>{format(parseISO(w.weeks.at(-1)!), 'd MMM')}</span>
                </div>
              </div>
            </figure>
          )
        })}
      </div>
      {editing && (
        <RowsEditor
          rows={rows}
          cols={[
            { key: 'week', label: 'Week of', type: 'text', width: '24%', disabled: () => true, hint: (r) => format(parseISO(r.week), 'EEE d MMM').toUpperCase() },
            ...WEEK_METRICS.map((m) => ({ key: m.key as WeekKey, label: m.label, type: 'number' as const, width: '19%' })),
          ]}
          readOnly={!editable}
          rowLabel={(r) => 'week of ' + r.week}
          onPatch={patch}
          caption="This week on top. Older weeks stay saved."
        />
      )}
    </Panel>
  )
}

// ---------- team and hiring ----------
export function Team({ k, editable, today }: PanelProps) {
  const [editing, setEditing] = useState(false)
  const team = ops(k.id, 'team')
  const roles = ops(k.id, 'roles')
  const next = nextTeamChange(k, today)
  // everyone not gone yet: joiners count, and leavers until their last day
  const here = k.team.filter((p) => p.status !== 'leaving' || (p.date ?? '9999') > today)
  const fte = here.reduce((s, p) => s + (p.fte ?? 0), 0)
  const th = 'caps h-8 px-2 text-left text-[11.5px] font-semibold tracking-[0.12em] text-muted'
  return (
    <Panel title="Team and hiring" editable={editable} editing={editing} onToggle={() => setEditing(!editing)} className="lg:col-span-12" aside={<span className="mr-1 hidden text-[12px] text-faint sm:inline">Not on the TV board</span>}>
      <Headline value={String(here.length)} note="Joiners count, and leavers until their date. Ink: the change that affects the team soonest.">
        people{fte ? <>, <Fig>{fte.toLocaleString('en', { maximumFractionDigits: 1 })}</Fig> FTE</> : null}, <Fig>{k.roles.length}</Fig> open role{k.roles.length === 1 ? '' : 's'}
      </Headline>
      {editing ? (
        <div className="grid gap-6">
          <RowsEditor
            caption="Team"
            rows={k.team}
            readOnly={!editable}
            rowLabel={(r) => r.name}
            cols={[
              { key: 'name', label: 'Name', type: 'text', width: '24%' },
              { key: 'role', label: 'Role', type: 'text', width: '30%' },
              { key: 'fte', label: 'FTE', type: 'number', width: '10%' },
              { key: 'status', label: 'Status', type: 'select', width: '16%', options: [{ value: 'active', label: 'Active' }, { value: 'joining', label: 'Joining' }, { value: 'leaving', label: 'Leaving' }] },
              { key: 'date', label: 'Date', type: 'date', width: '20%' },
            ]}
            onPatch={(id, key, v) => team.patch(id, key, key === 'status' ? (v ?? 'active') : v)}
            onRemove={(id) => team.remove(id, k)}
            onAdd={() => team.add({ id: rid('p_'), name: '', status: 'active' })}
            addLabel="Add person"
          />
          <RowsEditor
            caption="Open roles"
            rows={k.roles}
            readOnly={!editable}
            rowLabel={(r) => r.role}
            cols={[
              { key: 'role', label: 'Role', type: 'text', width: '46%' },
              { key: 'candidates', label: 'Candidates', type: 'number', width: '18%' },
              { key: 'interviews', label: 'Interviews', type: 'number', width: '18%' },
              { key: 'offer', label: 'Offer out', type: 'check', width: '18%' },
            ]}
            onPatch={roles.patch}
            onRemove={(id) => roles.remove(id, k)}
            onAdd={() => roles.add({ id: rid('r_'), role: '' })}
            addLabel="Add open role"
          />
        </div>
      ) : (
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13.5px]">
              <caption className="caps pb-1.5 text-left text-[12px] font-semibold tracking-[0.12em] text-muted">Team</caption>
              <thead>
                <tr className="border-b-2 border-fg">
                  <th className={th}>Name</th><th className={th}>Role</th><th className={cx(th, 'text-right')}>FTE</th><th className={th}>Status</th><th className={th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {k.team.map((p) => (
                  <tr key={p.id} className="h-10 border-b border-line">
                    <td className="truncate px-2 font-medium">{p.name}</td>
                    <td className="truncate px-2 text-muted">{p.role}</td>
                    <td className="px-2 text-right font-mono tabular-nums">{p.fte ?? '—'}</td>
                    <td className="px-2"><StatusTag status={p.status} hi={p.id === next} /></td>
                    <td className="whitespace-nowrap px-2 font-mono text-[12.5px] uppercase tabular-nums">{p.date ? format(parseISO(p.date), 'd MMM yyyy') : <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
                {!k.team.length && <tr><td colSpan={5} className="px-2 py-3 text-faint">No one listed yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[340px] border-collapse text-[13.5px]">
              <caption className="caps pb-1.5 text-left text-[12px] font-semibold tracking-[0.12em] text-muted">Open roles</caption>
              <thead>
                <tr className="border-b-2 border-fg">
                  <th className={th}>Role</th><th className={cx(th, 'text-right')}>Candidates</th><th className={cx(th, 'text-right')}>Interviews</th><th className={th}>Offer</th>
                </tr>
              </thead>
              <tbody>
                {k.roles.map((r) => (
                  <tr key={r.id} className="h-10 border-b border-line">
                    <td className="truncate px-2 font-medium">{r.role}</td>
                    <td className="px-2 text-right font-mono tabular-nums">{r.candidates ?? '—'}</td>
                    <td className="px-2 text-right font-mono tabular-nums">{r.interviews ?? '—'}</td>
                    <td className="px-2">{r.offer ? <span className="caps rounded-sm border border-fg px-1.5 pb-px pt-[2px] text-[11px] font-semibold tracking-[0.1em]">Out</span> : <span className="font-mono text-faint">—</span>}</td>
                  </tr>
                ))}
                {!k.roles.length && <tr><td colSpan={4} className="px-2 py-3 text-faint">No open roles.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  )
}
function StatusTag({ status, hi }: { status: KpiPerson['status']; hi: boolean }) {
  const base = 'caps inline-flex h-[22px] items-center rounded-sm px-2 text-[11.5px] font-semibold leading-none tracking-[0.1em]'
  if (status === 'active') return <span className={cx(base, 'px-0 text-faint')}>Active</span>
  return <span className={cx(base, hi ? 'bg-chart-hi text-on-chart-hi' : 'border border-fg text-fg')}>{status}</span>
}

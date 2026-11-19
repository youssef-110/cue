import type { ReactNode } from 'react'
import cx from 'clsx'

/* Small, real-HTML previews of each view. Decorative: the row next to each one describes it. */

const L = {
  stuck: { c: '#d3242b', t: 'Stuck' },
  work: { c: '#1d4fb8', t: 'Working on it' },
  done: { c: '#f6d11f', t: 'Done', ink: true },
  idle: { c: '#e3e2db', t: 'Not started', ink: true },
}
type Lab = keyof typeof L

function Chip({ l }: { l: Lab }) {
  const x = L[l]
  return (
    <span className="caps inline-block rounded-sm px-1 pt-[2px] pb-px text-[9.5px] leading-none font-semibold tracking-[0.06em]" style={{ background: x.c, color: 'ink' in x ? '#121212' : '#fff' }}>
      {x.t}
    </span>
  )
}

function Who({ i, light }: { i: string; light?: boolean }) {
  return <span className={cx('inline-grid size-[18px] shrink-0 place-items-center rounded-full text-[8px] font-semibold', light ? 'bg-panel text-fg ring-1 ring-line-strong' : 'bg-fg text-bg')}>{i}</span>
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cx('h-[168px] overflow-hidden rounded-lg border border-line bg-panel text-[11px] leading-tight text-fg select-none', className)}>
      {children}
    </div>
  )
}

const hd = 'caps text-[9.5px] font-semibold tracking-[0.12em] text-fg'

export function TableMock() {
  const rows: [string, string, string, Lab, boolean?][] = [
    ['17 NOV', '10:00', 'Book partner call', 'stuck', true],
    ['19 NOV', '17:00', 'Collect invoices', 'work'],
    ['21 NOV', '17:00', 'Investor FAQ', 'idle'],
    ['25 NOV', '09:30', 'Data room', 'done'],
  ]
  return (
    <Frame className="px-3 pt-2.5">
      <div className={cx(hd, 'grid grid-cols-[92px_1fr_auto] border-b-2 border-fg pb-1.5')}>
        <span>Deadline</span>
        <span>Item</span>
        <span>Status</span>
      </div>
      {rows.map(([d, t, name, l, late]) => (
        <div key={name} className="grid h-[31px] grid-cols-[92px_1fr_auto] items-center border-b border-line">
          <span className={cx('flex items-baseline gap-1.5 font-mono', late && 'text-alert')}>
            <span className={cx('text-[9px]', !late && 'text-faint')}>{d}</span>
            <span className="text-[12px] font-medium">{t}</span>
          </span>
          <span className="truncate pr-2 text-[11.5px]">
            {name}
            {late && <span className="ml-1.5 rounded-sm bg-alert px-1 py-px font-mono text-[9px] text-white">+2d</span>}
          </span>
          <Chip l={l} />
        </div>
      ))}
    </Frame>
  )
}

export function KanbanMock() {
  const cols: [Lab, [string, string][]][] = [
    ['idle', [['Investor FAQ', 'YA'], ['Q1 roadmap', 'SK']]],
    ['work', [['Collect invoices', 'SK'], ['Pitch deck v2', 'LM']]],
    ['done', [['Data room', 'RB']]],
  ]
  return (
    <Frame className="grid grid-cols-3 gap-2 bg-panel-2 p-2.5">
      {cols.map(([l, cards]) => (
        <div key={l} className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between">
            <Chip l={l} />
            <span className="font-mono text-[9.5px] text-faint">{cards.length}</span>
          </div>
          {cards.map(([t, w]) => (
            <div key={t} className="mb-1.5 rounded-md border border-line bg-panel p-1.5">
              <div className="truncate text-[11px]">{t}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-[9px] text-faint">CUE-1{t.length}</span>
                <Who i={w} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </Frame>
  )
}

export function TimelineMock() {
  const bars = [
    { name: 'Investor FAQ', from: 0, len: 3, c: '#1d4fb8' },
    { name: 'Pitch deck v2', from: 3, len: 4, c: '#5b3fa8' },
    { name: 'Data room', from: 2, len: 3, c: '#0f7c8c' },
    { name: 'Send deck', from: 7, len: 2, c: '#d9661a' },
  ]
  const day = 100 / 10
  return (
    <Frame className="relative">
      <div className="flex h-[22px] border-b-2 border-fg">
        {['16', '17', '18', '19', '20', '21', '22', '23', '24', '25'].map((d, i) => (
          <span key={d} className={cx('flex-1 border-l border-line pt-1.5 text-center font-mono text-[9px]', i === 3 ? 'font-semibold text-accent' : 'text-faint')}>
            {d}
          </span>
        ))}
      </div>
      <div className="absolute top-[22px] bottom-0 w-px bg-accent" style={{ left: `${3.5 * day}%` }} />
      {bars.map((b, i) => (
        <div key={b.name} className="absolute h-[22px] rounded-sm px-1.5 pt-[5px] text-[10px] font-medium text-white" style={{ top: 32 + i * 33, left: `calc(${b.from * day}% + 2px)`, width: `calc(${b.len * day}% - 4px)`, background: b.c }}>
          <span className="block truncate">{b.name}</span>
        </div>
      ))}
      {/* dependency: Investor FAQ finishes before Pitch deck v2 starts */}
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 168" preserveAspectRatio="none">
        <path d={`M${3 * day} 43 H${3 * day + 1.2} V76 H${3 * day + 0.6}`} fill="none" stroke="var(--fg)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </Frame>
  )
}

export function CalendarMock() {
  const events: Record<number, [string, Lab]> = { 17: ['Partner call', 'stuck'], 19: ['Invoices', 'work'], 21: ['FAQ', 'idle'], 25: ['Data room', 'done'], 27: ['Deck v2', 'work'] }
  return (
    <Frame>
      <div className={cx(hd, 'grid grid-cols-7 border-b-2 border-fg px-1 py-1.5 text-center')}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 28 }, (_, i) => i + 9).map((n) => {
          const e = events[n]
          return (
            <div key={n} className={cx('h-[34px] overflow-hidden border-r border-b border-line px-1 pt-0.5', n === 19 && 'bg-accent-soft')}>
              <span className={cx('font-mono text-[9px]', n === 19 ? 'font-semibold text-accent' : 'text-faint')}>{n > 30 ? n - 30 : n}</span>
              {e && (
                <div className="mt-px truncate rounded-[2px] px-0.5 text-[8.5px] font-medium" style={{ background: L[e[1]].c, color: 'ink' in L[e[1]] ? '#121212' : '#fff' }}>
                  {e[0]}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

export function DashboardMock() {
  const split: [Lab, number][] = [
    ['done', 9],
    ['work', 6],
    ['idle', 4],
    ['stuck', 2],
  ]
  const people: [string, number][] = [
    ['YA', 8],
    ['LM', 6],
    ['SK', 5],
    ['RB', 3],
  ]
  return (
    <Frame className="grid grid-cols-[1.1fr_1fr]">
      <div className="border-r border-line p-2.5">
        <div className={hd}>Status · 3 boards</div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono text-[22px] leading-none font-medium">21</span>
          <span className="text-[10px] text-muted">open items</span>
        </div>
        <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-sm">
          {split.map(([l, n]) => (
            <span key={l} style={{ flex: n, background: L[l].c }} />
          ))}
        </div>
        <div className="mt-2 space-y-[3px]">
          {split.map(([l, n]) => (
            <div key={l} className="flex items-center gap-1.5 text-[10px]">
              <span className="size-2 rounded-[1px]" style={{ background: L[l].c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / .08)' }} />
              <span className="text-muted">{L[l].t}</span>
              <span className="ml-auto font-mono">{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col p-2.5">
        <div className={hd}>Items per person</div>
        <div className="mt-2 flex flex-1 items-end gap-2">
          {people.map(([p, n]) => (
            <div key={p} className="flex flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[9px] text-muted">{n}</span>
              <span className="w-full rounded-t-[2px] bg-fg" style={{ height: n * 11 }} />
              <span className="font-mono text-[9px] text-faint">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  )
}

export function WorkloadMock() {
  const weeks = ['W47', 'W48', 'W49', 'W50']
  const load: [string, number[]][] = [
    ['YA', [4, 7, 3, 2]],
    ['LM', [3, 4, 5, 1]],
    ['SK', [2, 3, 4, 4]],
    ['RB', [5, 2, 1, 3]],
  ]
  const cap = 5
  return (
    <Frame className="px-3 pt-2">
      <div className={cx(hd, 'grid grid-cols-[34px_repeat(4,1fr)] gap-1.5 border-b-2 border-fg pb-1.5')}>
        <span />
        {weeks.map((w) => (
          <span key={w} className="font-mono text-[9px] tracking-normal">
            {w}
          </span>
        ))}
      </div>
      {load.map(([p, ws]) => (
        <div key={p} className="grid h-[31px] grid-cols-[34px_repeat(4,1fr)] items-center gap-1.5 border-b border-line">
          <Who i={p} />
          {ws.map((n, i) => {
            const over = n > cap
            return (
              <div key={i} className="relative h-[14px] rounded-sm bg-panel-2">
                <span className={cx('absolute inset-y-0 left-0 rounded-sm', over ? 'bg-alert' : 'bg-fg/75')} style={{ width: `${Math.min(n / cap, 1) * 100}%` }} />
                {over && <span className="absolute -top-px right-0.5 font-mono text-[9px] font-semibold text-white">+{n - cap}</span>}
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-1.5 font-mono text-[9px] text-faint">Capacity 5 items per week</div>
    </Frame>
  )
}

export function DocsMock() {
  return (
    <Frame className="px-4 pt-3">
      <div className="caps text-[17px] leading-none font-bold tracking-[0.04em]">Q1 plan</div>
      <div className="mt-1 font-mono text-[9px] text-faint">Edited by YA · 18 NOV</div>
      <p className="mt-2.5 text-[11px] leading-snug text-muted">
        Three goals for the quarter. Partner demos are tracked on the <span className="text-accent underline decoration-accent/30">Sales pipeline</span> board.
      </p>
      <ul className="mt-2 space-y-1 text-[11px]">
        {[
          ['Close two pilot agreements', true],
          ['Ship the benchmark report', true],
          ['Prepare the seed round data room', false],
        ].map(([t, done]) => (
          <li key={String(t)} className="flex items-center gap-1.5">
            <span className={cx('grid size-3 place-items-center rounded-[2px] border', done ? 'border-fg bg-fg' : 'border-line-strong')}>
              {done && (
                <svg viewBox="0 0 10 10" className="size-2" fill="none" stroke="var(--bg)" strokeWidth="1.8">
                  <path d="M2 5.2l2 2L8 3" />
                </svg>
              )}
            </span>
            <span className={cx(done && 'text-muted line-through decoration-faint')}>{t}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

// The office-TV view of a KPI board: a lit departure board, full screen, readable from across the room.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { Flap, useClock } from '../landing/shared'
import { compact, isMoneyMilestone, ladder, milestoneRows, money, monthLabel, moneyStatus, nearestBehind, opportunities, pct, roundStatus } from '../lib/kpi'
import type { Kpi } from '../lib/types'
import { Logo, cx } from '../components/ui'

/** Asks for full screen first (it needs the click that opened the board), then shows the board. */
export const enterFullscreen = () => document.documentElement.requestFullscreen?.().catch(() => undefined)

export function TvBoard({ k, today, onClose }: { k: Kpi; today: string; onClose: () => void }) {
  const clock = useClock()
  const [idle, setIdle] = useState(false)

  // leave with Esc; leaving full screen (Esc in most browsers) closes the board too
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onFs = () => !document.fullscreenElement && onClose()
    addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [onClose])

  // keep the screen on while the board hangs on the wall; hide the pointer when nobody moves it
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    let t = window.setTimeout(() => setIdle(true), 3000)
    const wake = () => (setIdle(false), clearTimeout(t), (t = window.setTimeout(() => setIdle(true), 3000)))
    addEventListener('pointermove', wake)
    return () => (void lock?.release().catch(() => undefined), clearTimeout(t), removeEventListener('pointermove', wake))
  }, [])

  const $ = (n?: number) => money(n, k.currency).toUpperCase()
  const r = roundStatus(k)
  const m = moneyStatus(k)
  const o = opportunities(k)
  const rows = milestoneRows(k, today)
  const next = nearestBehind(rows)
  // open milestones first, by deadline; the wall has room for six
  const shown = [...rows].sort((a, b) => Number(a.met) - Number(b.met) || (a.m.due ?? '9999').localeCompare(b.m.due ?? '9999'))
  const MAX = 6
  const inv = ladder(k.investorStages, k.investors, k.investorFocus)
  const acc = ladder(k.accountStages, k.accounts, k.accountFocus)
  const updated = format(k.updatedAt, 'EEE d MMM HH:mm').toUpperCase()

  const tiles = [
    { label: 'Investors, firm', value: $(r.committed), sub: r.investorTarget ? `of ${$(r.investorTarget)}${r.soft ? ` · ${$(r.soft)} soft` : ''}` : r.soft ? `${$(r.soft)} soft` : '' },
    { label: m.latest ? `Revenue ${monthLabel(m.latest.month).toUpperCase()}` : 'Revenue', value: m.latest ? $(m.latest.revenue) : '—', sub: m.profit != null ? `profit ${$(m.profit)}` : '' },
    { label: 'Runway', value: m.runway != null ? m.runway.toFixed(1) : '—', sub: m.runway != null ? `months at ${$(m.burn)}/mo` : 'needs cash and cost' },
    { label: 'Pipeline value', value: $(o.weighted), sub: `${o.plotted.length} accounts valued` },
  ]

  return createPortal(
    <div role="dialog" aria-modal aria-label={`${k.name} KPIs, TV board`} className={cx('tv dark fixed inset-0 z-[100] flex flex-col gap-[1.3em] overflow-hidden p-[2.4em]', idle && 'cursor-none')}>
      {/* station sign */}
      <header className="flex items-end gap-[1.5em] border-b-2 border-[var(--board-text)] pb-[0.9em]">
        <Logo size={44} className="mb-[0.3em] size-[2.6em] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="caps truncate text-[0.85em] font-semibold tracking-[0.18em] text-[var(--board-mute)]">{k.company || 'Company KPIs'}</p>
          <h1 className="caps truncate text-[3.4em] font-bold leading-[0.92] tracking-[0.01em] text-signal">
            {k.name} <span className="text-[var(--board-text)]">KPIs</span>
          </h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[0.4em] font-mono">
          <span className="text-[1.05em] tracking-[0.08em] text-[var(--board-mute)]">{clock.day}</span>
          <Flap text={clock.time} tiles className="text-[1.9em]" tileClassName="flap-tile--signal" />
        </div>
      </header>

      {/* service notice */}
      {next && (
        <div className="flex items-center gap-[1em] rounded-[4px] bg-[var(--board-tile)] px-[1em] py-[0.7em] text-[1.35em]">
          <span className={cx('caps shrink-0 rounded-[3px] px-[0.5em] py-[0.25em] text-[0.8em] font-bold tracking-[0.14em]', next.days! < 0 ? 'bg-[#d3242b] text-white' : 'bg-signal text-on-signal')}>
            {next.days! < 0 ? `Late +${-next.days!}d` : 'Next deadline'}
          </span>
          <span className="min-w-0 truncate">
            <b className="font-semibold">{next.m.name}</b>
            <span className="text-[var(--board-mute)]"> at </span>
            <b className="font-mono font-semibold">{(isMoneyMilestone(next.m) ? $ : compact)(next.actual)}</b>
            <span className="text-[var(--board-mute)]"> of </span>
            <b className="font-mono font-semibold">{(isMoneyMilestone(next.m) ? $ : compact)(next.m.target)}</b>
            <span className="text-[var(--board-mute)]"> · due </span>
            <span className="font-mono">{format(parseISO(next.m.due!), 'EEE d MMM').toUpperCase()}</span>
            <span className="font-mono text-[var(--board-mute)]">{next.days! >= 0 ? ` · ${next.days} days left` : ''}</span>
          </span>
        </div>
      )}

      {/* the round and four numbers */}
      <section className="grid grid-cols-[1.5fr_repeat(4,minmax(0,1fr))] gap-px overflow-hidden rounded-[4px] bg-[var(--board-rule)]">
        <div className="flex flex-col gap-[0.6em] bg-[var(--board-bg)] p-[1.1em]">
          <span className="caps text-[0.95em] font-semibold tracking-[0.14em] text-[var(--board-mute)]">Whole round</span>
          <div className="flex items-end gap-[0.8em]">
            <Flap text={r.target ? pct(r.progress) : '—'} tiles className="text-[3.1em]" tileClassName="flap-tile--signal" />
            <span className="pb-[0.3em] font-mono text-[1.15em] text-[var(--board-mute)]">{r.target ? `${$(r.total)} OF ${$(r.target)}` : 'NO TARGET'}</span>
          </div>
          <TvMeter value={r.progress} hi />
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="flex min-w-0 flex-col bg-[var(--board-bg)] p-[1.1em]">
            <span className="caps truncate text-[0.95em] font-semibold tracking-[0.14em] text-[var(--board-mute)]">{t.label}</span>
            <span key={t.value} className="flap mt-auto truncate pt-[0.4em] font-mono text-[2.7em] font-semibold leading-none tracking-[-0.03em]">{t.value}</span>
            <span className="mt-[0.5em] truncate font-mono text-[0.95em] uppercase text-[var(--board-mute)]">{t.sub || ' '}</span>
          </div>
        ))}
      </section>

      {/* platforms: milestones and the two ladders */}
      <section className="grid min-h-0 flex-1 grid-cols-[1.25fr_1fr_1fr] gap-[2em]">
        <TvColumn title="Milestones" right={`${rows.filter((x) => x.met).length}/${rows.length} met`}>
          {shown.slice(0, MAX).map((x) => {
              const f = isMoneyMilestone(x.m) ? $ : compact
              const hi = x.m.id === next?.m.id
              const late = !x.met && x.days != null && x.days < 0
              return (
                <li key={x.m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[1em] py-[0.5em]">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-[0.8em]">
                      <span className={cx('truncate text-[1.1em]', hi && 'font-semibold text-signal')}>{x.m.name}</span>
                      <span className={cx('shrink-0 font-mono text-[0.9em]', late ? 'text-[#ff8a8e]' : 'text-[var(--board-mute)]')}>
                        {f(x.actual)}/{f(x.m.target)}
                        {x.met ? ' · MET' : x.m.due ? ' · ' + format(parseISO(x.m.due), 'd MMM').toUpperCase() + (late ? ` +${-x.days!}D` : '') : ''}
                      </span>
                    </div>
                    <TvMeter value={x.progress} hi={hi} className="mt-[0.4em]" />
                  </div>
                  <span className={cx('grid h-[1.9em] min-w-[3.6em] place-items-center rounded-[3px] font-mono text-[1.1em] font-semibold', hi ? 'bg-signal text-on-signal' : 'bg-[var(--board-tile)]')}>{pct(x.progress)}</span>
                </li>
              )
            })}
          {shown.length > MAX && <li className="py-[0.5em] font-mono text-[0.9em] text-[var(--board-mute)]">+ {shown.length - MAX} MORE ON THE BOARD</li>}
        </TvColumn>
        <TvColumn title="Investor funnel" right={`${inv.total} in talks`}>
          <TvLadder l={inv} />
        </TvColumn>
        <TvColumn title="Sales pipeline" right={`${acc.total} accounts`}>
          <TvLadder l={acc} />
        </TvColumn>
      </section>

      <footer className="flex items-center justify-between font-mono text-[0.85em] tracking-[0.06em] text-[var(--board-mute)]">
        <span>DATA AS OF {updated}</span>
        <span className={cx('transition-opacity duration-300', idle && 'opacity-0')}>ESC TO LEAVE · CUE</span>
      </footer>
    </div>,
    document.body,
  )
}

function TvColumn({ title, right, children }: { title: string; right: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-[var(--board-text)] pb-[0.35em]">
        <h2 className="caps text-[1.25em] font-bold tracking-[0.12em]">{title}</h2>
        <span className="font-mono text-[0.95em] uppercase text-[var(--board-mute)]">{right}</span>
      </div>
      <ol className="mt-[0.3em] flex min-h-0 flex-col divide-y divide-[var(--board-rule)] overflow-hidden">{children}</ol>
    </div>
  )
}

function TvLadder({ l }: { l: ReturnType<typeof ladder> }) {
  return l.rows.map((r) => {
    const on = r.stage.id === l.focus
    return (
      <li key={r.stage.id} className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)_2.2em] items-center gap-x-[0.8em] py-[0.55em]">
        <span className={cx('truncate text-[1.05em]', on ? 'font-semibold text-signal' : r.count ? '' : 'text-[var(--board-mute)]')}>{r.stage.name}</span>
        <span className="h-[0.8em]">{r.count > 0 && <span className={cx('block h-full rounded-r-[2px]', on ? 'bg-signal' : 'bg-[#6b6a64]')} style={{ width: `${(r.count / l.max) * 100}%` }} />}</span>
        <span className={cx('text-right font-mono text-[1.15em] font-semibold', !r.count && 'text-[var(--board-mute)]')}>{r.count}</span>
      </li>
    )
  })
}

function TvMeter({ value, hi, className }: { value: number; hi?: boolean; className?: string }) {
  return (
    <div className={cx('h-[0.45em] overflow-hidden rounded-[2px] bg-[var(--board-tile)]', className)}>
      {value > 0 && <div className={cx('h-full rounded-[2px]', hi ? 'bg-signal' : 'bg-[#6b6a64]')} style={{ width: `${Math.min(1, value) * 100}%` }} />}
    </div>
  )
}

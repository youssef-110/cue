import { useMemo, useRef, useState } from 'react'
import { Eye, Lock, MonitorPlay, MoreHorizontal, Plus, Target, Trash2, Users } from 'lucide-react'
import { format } from 'date-fns'
import { createKpi, deleteKpi, navigate, saveKpi, useCanEdit, useStore } from '../lib/store'
import { auth } from '../lib/sync'
import { milestoneRows } from '../lib/kpi'
import { today as todayIso } from '../lib/seed'
import type { Kpi } from '../lib/types'
import { askText } from '../components/askText'
import { BoardAccess } from '../components/BoardAccess'
import { Button, EditableText, MenuItem, Popover, cx } from '../components/ui'
import { Activity, Investors, Milestones, Money, Notice, Opportunities, Pipeline, Readiness, Round, Team, Tiles } from '../kpi/panels'
import { TvBoard, enterFullscreen } from '../kpi/TvBoard'

const TAB = 'caps relative flex h-10 shrink-0 items-center gap-1.5 rounded-t-md px-4 text-[15px] font-semibold tracking-[0.1em] transition-colors'
const TAB_ON = 'bg-bg text-fg'
const TAB_OFF = 'text-on-signal/80 hover:bg-on-signal/10 hover:text-on-signal'
const BAND_BTN = 'flex h-8 items-center gap-1.5 rounded-md border border-on-signal/35 px-3 text-[13.5px] font-medium transition-colors hover:bg-on-signal/10 [&>svg]:size-4'

const isPrivateKpi = (k: Kpi) => !k.readers?.includes('*')

async function newBoard() {
  const name = await askText('New KPI board', '', 'Create')
  if (name) createKpi(name)
}

export function Kpis({ id }: { id?: string }) {
  const all = useStore((s) => s.kpi)
  const editable = useCanEdit()
  const list = useMemo(() => Object.values(all).sort((a, b) => a.order - b.order), [all])
  const k = (id && all[id]) || list[0]
  const today = todayIso()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Band k={k} list={list} editable={editable} today={today} />
      {k ? (
        <Body key={k.id} k={k} editable={editable} today={today} />
      ) : (
        <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-8">
          <div className="max-w-[640px] rounded-lg border border-line bg-panel p-6 sm:p-8">
            <Target className="mb-4 size-7 text-faint" />
            <h2 className="caps text-[26px] font-bold leading-none">No KPI boards yet</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              A KPI board keeps the numbers the company is steered by on one page: the round, milestones against their targets, revenue, cost and cash, the investor
              funnel, the sales pipeline, weekly activity, readiness and the team. It opens full screen as a departure board for the office TV.
            </p>
            <p className="mt-2 text-[14px] text-faint">New boards are private to you (admins can always open them) until you share them.</p>
            {editable ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="primary" onClick={newBoard}>
                  <Plus /> New KPI board
                </Button>
                {!auth && (
                  <Button variant="outline" onClick={() => createKpi('Northwind', true)}>
                    Open an example
                  </Button>
                )}
              </div>
            ) : (
              <p className="mt-6 text-[14px] text-muted">Ask an editor to create one and share it with you.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** The station sign: which KPI board, how it stands, and the tabs to the others. */
function Band({ k, list, editable, today }: { k?: Kpi; list: Kpi[]; editable: boolean; today: string }) {
  const rows = k ? milestoneRows(k, today) : []
  const met = rows.filter((r) => r.met).length
  const late = rows.filter((r) => !r.met && r.days != null && r.days < 0).length
  const users = useStore((s) => s.user)
  return (
    <header className="band min-w-0 shrink-0 border-b-2 border-ink bg-signal px-4 pt-4 text-on-signal sm:px-8 dark:border-line-strong">
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="caps flex min-w-0 flex-1 items-center gap-2 text-[12.5px] font-semibold tracking-[0.12em]">
          <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-on-signal text-signal">
            <Target className="size-4" />
          </span>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2">
            <span className="hidden text-on-signal/80 sm:inline">KPIs</span>
            {k && (
              <>
                <span aria-hidden className="hidden text-on-signal/60 sm:inline">/</span>
                {editable ? (
                  <EditableText value={k.company ?? ''} placeholder="Add company name" onCommit={(company) => saveKpi(k.id, (x) => ({ ...x, company }))} className="truncate hover:ring-on-signal/40" />
                ) : (
                  <span className="truncate">{k.company}</span>
                )}
              </>
            )}
          </nav>
          {k && isPrivateKpi(k) && (
            <span title="Private: only the people it is shared with, and admins, can see it" className="flex shrink-0 items-center gap-1 rounded-sm border border-on-signal/60 px-1.5 py-0.5 text-[11px] tracking-[0.12em]">
              <Lock className="size-3" /> Private
            </span>
          )}
          {!editable && (
            <span className="ml-1 flex shrink-0 items-center gap-1 rounded-sm border border-on-signal/40 px-1.5 py-0.5 text-[11.5px]">
              <Eye className="size-3.5" /> View only
            </span>
          )}
        </div>
        {k && <BandActions k={k} today={today} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="min-w-0">
          {k && editable ? (
            <EditableText value={k.name} onCommit={(name) => saveKpi(k.id, (x) => ({ ...x, name }))} className="caps block text-[30px] font-bold leading-[1.02] tracking-[0.015em] hover:ring-on-signal/40 sm:text-[44px]" />
          ) : (
            <span className="caps block truncate text-[30px] font-bold leading-[1.02] tracking-[0.015em] sm:text-[44px]">{k?.name ?? 'KPIs'}</span>
          )}
        </h1>
        {k && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] font-medium uppercase [&>*]:whitespace-nowrap">
            <span>
              <b className="font-semibold">{met}</b> of <b className="font-semibold">{rows.length}</b> targets met
            </span>
            <span className={cx(late ? 'rounded-sm bg-alert px-1.5 py-0.5 text-white' : 'opacity-80')}>
              <b className="font-semibold">{late}</b> late
            </span>
            <span className="opacity-80" title={k.updatedBy && users[k.updatedBy] ? `Last change by ${users[k.updatedBy].name}` : undefined}>
              Updated {format(k.updatedAt, 'EEE d MMM HH:mm')}
            </span>
          </p>
        )}
      </div>

      <nav aria-label="KPI boards" className="-mx-4 -mb-[2px] mt-4 flex items-end gap-0.5 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {list.map((x) => (
          <button key={x.id} onClick={() => navigate({ page: 'kpis', id: x.id })} aria-current={x.id === k?.id ? 'page' : undefined} className={cx(TAB, x.id === k?.id ? TAB_ON : TAB_OFF)}>
            {isPrivateKpi(x) && <Lock className="size-3" />}
            {x.name}
          </button>
        ))}
        {!list.length && <span className={cx(TAB, TAB_ON)}>Start</span>}
        {editable && (
          <button onClick={newBoard} aria-label="New KPI board" title="New KPI board" className={cx(TAB, TAB_OFF, 'px-3')}>
            <Plus className="size-4" />
          </button>
        )}
      </nav>
    </header>
  )
}

function BandActions({ k, today }: { k: Kpi; today: string }) {
  const [tv, setTv] = useState(false)
  const [access, setAccess] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const editable = useCanEdit()
  const manage = useStore((s) => s.isAdmin || k.createdBy === s.meId)
  const priv = isPrivateKpi(k)
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button onClick={() => setAccess(true)} className={BAND_BTN} title="Who can see this KPI board">
        {priv ? <Lock /> : <Users />}
        <span className="hidden sm:inline">{priv ? 'Share' : 'Whole team'}</span>
      </button>
      <button
        onClick={() => {
          void enterFullscreen()
          setTv(true)
        }}
        className={cx(BAND_BTN, 'border-on-signal bg-on-signal text-signal hover:bg-on-signal/85')}
        title="Show this board full screen on a TV"
      >
        <MonitorPlay /> <span className="hidden sm:inline">TV board</span>
      </button>
      {editable && manage && (
        <>
          <button ref={menuRef} onClick={() => setMenu(true)} aria-label="KPI board options" className="grid size-8 place-items-center rounded-md transition-colors hover:bg-on-signal/10">
            <MoreHorizontal className="size-4" />
          </button>
          <Popover anchor={menuRef.current} open={menu} onClose={() => setMenu(false)} width={220} align="end">
            <MenuItem
              icon={<Trash2 />}
              danger
              onClick={() => {
                setMenu(false)
                if (window.confirm(`Delete the KPI board “${k.name}” and every number on it? This cannot be undone.`)) deleteKpi(k.id)
              }}
            >
              Delete KPI board
            </MenuItem>
          </Popover>
        </>
      )}
      <BoardAccess
        board={k}
        open={access}
        onClose={() => setAccess(false)}
        title="KPI board access"
        noun="KPI board"
        privateHint="Only the people you pick can see this KPI board and its numbers. Admins can always open it."
        onSave={(readers) => saveKpi(k.id, (x) => ({ ...x, readers }))}
      />
      {tv && <TvBoard k={k} today={today} onClose={() => setTv(false)} />}
    </div>
  )
}

function Body({ k, editable, today }: { k: Kpi; editable: boolean; today: string }) {
  const p = { k, editable, today }
  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-4 px-4 pb-16 pt-5 sm:px-8 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-12">
        <Notice k={k} today={today} />
        <Tiles k={k} today={today} />
      </div>
      <Milestones {...p} />
      <Round {...p} />
      <Money {...p} />
      <Investors {...p} />
      <Pipeline {...p} />
      <Opportunities {...p} />
      <Readiness {...p} />
      <Activity {...p} />
      <Team {...p} />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import cx from 'clsx'
import { Flap, useClock, useReducedMotion } from './shared'

type Status = 'ON TIME' | 'BOARDING' | 'DEPARTED' | '+2d DELAYED'
interface Row {
  dep: string
  task: string
  board: string
  who: string
  status: Status
}

const STATUS_WIDTH = 11
const NEXT: Partial<Record<Status, Status>> = { 'ON TIME': 'BOARDING', BOARDING: 'DEPARTED' }

const START: Row[] = [
  { dep: '09:30', task: 'Organise the data room', board: 'Investor prep', who: 'RB', status: 'BOARDING' },
  { dep: '10:00', task: 'Book requirements call with new partner', board: 'Sales pipeline', who: 'YA', status: '+2d DELAYED' },
  { dep: '11:15', task: 'Follow-up emails to EU media leads', board: 'Sales pipeline', who: 'LM', status: 'ON TIME' },
  { dep: '12:00', task: 'Collect outstanding invoices', board: 'Team tasks', who: 'SK', status: 'ON TIME' },
  { dep: '14:30', task: 'Prepare investor FAQ', board: 'Investor prep', who: 'YA', status: 'ON TIME' },
  { dep: '16:00', task: 'Pitch deck v2', board: 'Investor prep', who: 'LM', status: 'ON TIME' },
]

const POOL: Pick<Row, 'task' | 'board' | 'who'>[] = [
  { task: 'Weekly check-in', board: 'Team tasks', who: 'SK' },
  { task: 'Benchmark report: Welsh ASR', board: 'Research', who: 'RB' },
  { task: 'Update next steps for open leads', board: 'Sales pipeline', who: 'YA' },
  { task: 'Review the contract draft', board: 'Partners', who: 'LM' },
  { task: 'Send the November press note', board: 'Content', who: 'RB' },
  { task: 'Plan the Q1 roadmap', board: 'Product roadmap', who: 'SK' },
  { task: 'Check the shared drive backup', board: 'Team tasks', who: 'YA' },
  { task: 'Demo for a broadcast partner', board: 'Sales pipeline', who: 'LM' },
]

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * The hero departure board. Every few seconds the next departure boards, leaves,
 * and the rows below roll up, each changed character flipping like a split-flap board.
 * The delayed task stays on the board in red. Static under reduced motion or offscreen.
 */
export function HeroBoard() {
  const reduced = useReducedMotion()
  const clock = useClock()
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<Row[]>(START)
  const pool = useRef(0)

  useEffect(() => {
    if (reduced || !ref.current) return
    let visible = false
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(ref.current)
    const tick = () => {
      if (!visible || document.hidden) return
      setRows((rs) => {
        const i = rs.findIndex((r) => r.status !== '+2d DELAYED')
        if (i < 0) return rs
        if (rs[i].status !== 'DEPARTED') return rs.map((r, j) => (j === i ? { ...r, status: NEXT[r.status] ?? r.status } : r))
        const n = pool.current++
        const added: Row = { ...POOL[n % POOL.length], dep: toTime(toMin(rs[rs.length - 1].dep) + 30 + (n % 3) * 15), status: 'ON TIME' }
        return [...rs.slice(0, i), ...rs.slice(i + 1), added]
      })
    }
    const t = setInterval(tick, 2600)
    return () => {
      clearInterval(t)
      io.disconnect()
    }
  }, [reduced])

  return (
    <div ref={ref} className="board">
      <p className="sr-only">An example departure board of team tasks, with departure times, the board each task is on, its owner and its status.</p>
      <div aria-hidden="true">
        <div className="board-head">
          <span className="caps text-[22px] leading-none font-bold tracking-[0.06em] text-signal sm:text-[26px]">Departures</span>
          <span className="board-sub caps">Deep Echo · team workspace</span>
          <span className="ml-auto font-mono text-[13px] text-[var(--board-mute)]">
            {clock.day} <span className="text-[var(--board-text)]">{clock.time}</span>
          </span>
        </div>
        <div className="board-row board-cols caps">
          <span>Dep</span>
          <span>Task</span>
          <span className="board-plat">Platform</span>
          <span className="board-who">Owner</span>
          <span className="board-status">Status</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="board-row">
            <Flap text={r.dep} tiles className="board-dep" />
            <Flap text={r.task.toUpperCase()} className="board-task" />
            <Flap text={r.board.toUpperCase()} className="board-plat" />
            <Flap text={r.who} className="board-who" />
            <Flap
              text={r.status.padEnd(STATUS_WIDTH)}
              tiles
              className="board-status"
              tileClassName={cx(r.status === '+2d DELAYED' && 'flap-tile--alert', r.status === 'BOARDING' && 'flap-tile--signal', r.status === 'DEPARTED' && 'flap-tile--gone')}
            />
          </div>
        ))}
      </div>
      <p className="board-legend">
        Platforms are boards. <b>Boarding</b> means in progress, <b>departed</b> means done, <span className="text-[var(--board-alert)]">delayed</span> means past its deadline.
      </p>
    </div>
  )
}

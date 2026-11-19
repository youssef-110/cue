import { addDays, format } from 'date-fns'
import type { Board, Column, Group, Item, Label, User, View } from './types'

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Cue palette — named so labels stay readable in both themes. */
/** Cue palette: timetable inks. Yellow is the signal (done), red only marks trouble. */
export const COLORS = {
  green: '#1f7a4d',
  teal: '#0f7c8c',
  sky: '#2b7bd0',
  indigo: '#1d4fb8',
  violet: '#5b3fa8',
  pink: '#b8326b',
  red: '#d3242b',
  orange: '#d9661a',
  amber: '#f6d11f',
  lime: '#6e8f1e',
  slate: '#8a8a84',
  graphite: '#3d3d39',
  stone: '#c9c8bf',
  ink: '#121212',
} as const
export const COLOR_LIST: string[] = Object.values(COLORS)

export const today = () => format(new Date(), 'yyyy-MM-dd')
export const dayOffset = (n: number) => format(addDays(new Date(), n), 'yyyy-MM-dd')

const L = (name: string, color: string, done = false): Label => ({ id: uid('l_'), name, color, done })
const col = (type: Column['type'], title: string, extra: Partial<Column> = {}): Column => ({
  id: uid('c_'),
  type,
  title,
  ...extra,
})
const grp = (title: string, color: string): Group => ({ id: uid('g_'), title, color })
const views = (statusColId?: string, dateColId?: string, timelineColId?: string): View[] => [
  { id: uid('v_'), type: 'table', name: 'Main table' },
  { id: uid('v_'), type: 'kanban', name: 'Kanban', columnId: statusColId },
  ...(timelineColId || dateColId ? [{ id: uid('v_'), type: 'timeline' as const, name: 'Timeline', columnId: timelineColId ?? dateColId }] : []),
  ...(dateColId ? [{ id: uid('v_'), type: 'calendar' as const, name: 'Calendar', columnId: dateColId }] : []),
  { id: uid('v_'), type: 'chart', name: 'Dashboard', columnId: statusColId },
]

export const statusLabels = () => [
  L('Not started', COLORS.slate),
  L('Working on it', COLORS.indigo),
  L('Stuck', COLORS.red),
  L('Done', COLORS.amber, true),
]
export const priorityLabels = () => [
  L('Critical', COLORS.ink),
  L('High', COLORS.graphite),
  L('Medium', COLORS.slate),
  L('Low', COLORS.stone),
]

export interface Template {
  id: string
  name: string
  icon: string
  description: string
  build: (workspaceId: string, users: User[]) => { board: Board; items: Item[] }
}

type Row = [string, Record<string, unknown>]

function assemble(
  workspaceId: string,
  name: string,
  icon: string,
  description: string,
  columns: Column[],
  groups: Group[],
  rows: Row[][], // rows per group
  viewCols: [string?, string?, string?],
  userId: string,
): { board: Board; items: Item[] } {
  const board: Board = {
    id: uid('b_'),
    workspaceId,
    name,
    icon,
    description,
    columns,
    groups,
    views: views(...viewCols),
    automations: [],
    createdAt: Date.now(),
    order: Date.now(),
  }
  const items: Item[] = []
  rows.forEach((groupRows, gi) =>
    groupRows.forEach(([itemName, values], i) =>
      items.push({
        id: uid('i_'),
        boardId: board.id,
        groupId: groups[gi].id,
        name: itemName,
        values,
        order: i + 1,
        createdAt: Date.now(),
        createdBy: userId,
      }),
    ),
  )
  return { board, items }
}

const pick = (users: User[], i: number) => (users.length ? [users[i % users.length].id] : [])

export const TEMPLATES: Template[] = [
  {
    id: 'team-tasks',
    name: 'Team tasks',
    icon: '✅',
    description: 'Daily tasks with owners, priority, status and deadlines.',
    build(ws, users) {
      const status = col('status', 'Status', { labels: [L('Not started', COLORS.slate), L('In progress', COLORS.indigo), L('Blocked', COLORS.red), L('Completed', COLORS.amber, true)] })
      const prio = col('priority', 'Priority', { labels: [L('P0', COLORS.ink), L('P1', COLORS.graphite), L('P2', COLORS.slate), L('P3', COLORS.stone)] })
      const owner = col('people', 'Owner')
      const collab = col('people', 'Collaborator')
      const deadline = col('date', 'Deadline')
      const notes = col('text', 'Notes', { width: 220 })
      const doc = col('link', 'Doc link')
      const s = status.labels!
      const p = prio.labels!
      const groups = [grp('This week', COLORS.sky), grp('Next up', COLORS.teal), grp('Done', COLORS.green)]
      const rows: Row[][] = [
        [
          ['Prepare investor FAQ', { [status.id]: s[1].id, [prio.id]: p[1].id, [owner.id]: pick(users, 0), [deadline.id]: dayOffset(2) }],
          ['Collect outstanding invoices', { [status.id]: s[0].id, [prio.id]: p[1].id, [owner.id]: pick(users, 1), [deadline.id]: dayOffset(4) }],
          ['Book requirements call with new partner', { [status.id]: s[2].id, [prio.id]: p[0].id, [owner.id]: pick(users, 0), [collab.id]: pick(users, 1), [deadline.id]: dayOffset(-2), [notes.id]: 'Waiting on their availability' }],
        ],
        [
          ['Follow-up emails to EU media leads', { [status.id]: s[0].id, [prio.id]: p[2].id, [owner.id]: pick(users, 1), [deadline.id]: dayOffset(9) }],
          ['Organise the data room', { [status.id]: s[0].id, [prio.id]: p[3].id, [owner.id]: pick(users, 2), [deadline.id]: dayOffset(14) }],
        ],
        [['Investor pitch deck v2', { [status.id]: s[3].id, [prio.id]: p[0].id, [owner.id]: pick(users, 1), [deadline.id]: dayOffset(-3), [doc.id]: 'https://example.com/deck' }]],
      ]
      return assemble(ws, 'Team tasks', '✅', this.description, [deadline, owner, collab, status, prio, notes, doc], groups, rows, [status.id, deadline.id], users[0]?.id ?? '')
    },
  },
  {
    id: 'sales-pipeline',
    name: 'Sales pipeline',
    icon: '💼',
    description: 'Track every deal from discovery call to paying customer.',
    build(ws, users) {
      const stage = col('status', 'Stage', { labels: [L('Discovery call', COLORS.sky), L('LOI to sign', COLORS.teal), L('Negotiation', COLORS.orange), L('Paying', COLORS.amber, true), L('On hold', COLORS.slate)] })
      const owner = col('people', 'Owner')
      const segment = col('tags', 'Segment', { labels: [L('Broadcaster', COLORS.green), L('Streaming', COLORS.pink), L('Localisation', COLORS.teal), L('Software', COLORS.amber), L('Integrator', COLORS.lime)] })
      const problem = col('text', 'Their problem', { width: 220 })
      const value = col('number', 'Monthly value', { unit: '€' })
      const next = col('text', 'Next step', { width: 200 })
      const close = col('date', 'Expected close')
      const s = stage.labels!
      const g = segment.labels!
      const groups = [grp('Active deals', COLORS.sky), grp('Won', COLORS.green), grp('Parked', COLORS.slate)]
      const rows: Row[][] = [
        [
          ['Northwind Media', { [stage.id]: s[1].id, [segment.id]: [g[1].id], [owner.id]: pick(users, 0), [value.id]: 1800, [close.id]: dayOffset(12), [problem.id]: 'Dialect transcription at scale' }],
          ['Contoso Studios', { [stage.id]: s[0].id, [segment.id]: [g[3].id], [owner.id]: pick(users, 1), [value.id]: 900, [close.id]: dayOffset(30), [next.id]: 'Scope the integration' }],
          ['Fabrikam Broadcast', { [stage.id]: s[2].id, [segment.id]: [g[0].id], [owner.id]: pick(users, 0), [value.id]: 3200, [close.id]: dayOffset(-3), [next.id]: 'Chase signed terms' }],
        ],
        [['Litware Radio', { [stage.id]: s[3].id, [segment.id]: [g[0].id], [owner.id]: pick(users, 1), [value.id]: 2600, [close.id]: dayOffset(-20) }]],
        [['Adatum Events', { [stage.id]: s[4].id, [segment.id]: [g[4].id], [owner.id]: pick(users, 2), [value.id]: 500, [next.id]: 'Revisit next quarter' }]],
      ]
      return assemble(ws, 'Sales pipeline', '💼', this.description, [close, owner, stage, segment, value, problem, next], groups, rows, [stage.id, close.id], users[0]?.id ?? '')
    },
  },
  {
    id: 'roadmap',
    name: 'Product roadmap',
    icon: '🚀',
    description: 'Plan releases on a timeline with progress and priority.',
    build(ws, users) {
      const status = col('status', 'Status', { labels: statusLabels() })
      const prio = col('priority', 'Priority', { labels: priorityLabels() })
      const owner = col('people', 'Owner')
      const tl = col('timeline', 'Timeline', { width: 190 })
      const prog = col('progress', 'Progress')
      const effort = col('number', 'Effort', { unit: 'pts' })
      const s = status.labels!
      const p = prio.labels!
      const groups = [grp('Q1 — Foundations', COLORS.sky), grp('Q2 — Scale', COLORS.pink)]
      const rows: Row[][] = [
        [
          ['Realtime transcription API', { [status.id]: s[1].id, [prio.id]: p[0].id, [owner.id]: pick(users, 0), [tl.id]: { start: dayOffset(-10), end: dayOffset(12) }, [prog.id]: 55, [effort.id]: 13 }],
          ['Speaker diarisation', { [status.id]: s[0].id, [prio.id]: p[1].id, [owner.id]: pick(users, 1), [tl.id]: { start: dayOffset(5), end: dayOffset(26) }, [prog.id]: 10, [effort.id]: 8 }],
          ['Benchmark dashboard', { [status.id]: s[3].id, [prio.id]: p[2].id, [owner.id]: pick(users, 2), [tl.id]: { start: dayOffset(-25), end: dayOffset(-8) }, [prog.id]: 100, [effort.id]: 5 }],
        ],
        [
          ['Live translation for events', { [status.id]: s[0].id, [prio.id]: p[1].id, [owner.id]: pick(users, 0), [tl.id]: { start: dayOffset(20), end: dayOffset(55) }, [prog.id]: 0, [effort.id]: 21 }],
          ['Editor plugin (MCP)', { [status.id]: s[2].id, [prio.id]: p[2].id, [owner.id]: pick(users, 1), [tl.id]: { start: dayOffset(14), end: dayOffset(40) }, [prog.id]: 20, [effort.id]: 8 }],
        ],
      ]
      return assemble(ws, 'Product roadmap', '🚀', this.description, [tl, owner, status, prio, prog, effort], groups, rows, [status.id, undefined, tl.id], users[0]?.id ?? '')
    },
  },
  {
    id: 'content',
    name: 'Content calendar',
    icon: '📣',
    description: 'Plan posts across channels and ship on schedule.',
    build(ws, users) {
      const status = col('status', 'Status', { labels: [L('Idea', COLORS.slate), L('Drafting', COLORS.orange), L('In review', COLORS.teal), L('Published', COLORS.amber, true)] })
      const channel = col('tags', 'Channel', { labels: [L('LinkedIn', COLORS.sky), L('Blog', COLORS.green), L('Newsletter', COLORS.pink), L('Video', COLORS.orange)] })
      const owner = col('people', 'Owner')
      const date = col('date', 'Publish date')
      const rating = col('rating', 'Impact')
      const s = status.labels!
      const c = channel.labels!
      const groups = [grp('This month', COLORS.pink), grp('Backlog', COLORS.slate)]
      const rows: Row[][] = [
        [
          ['Launch announcement', { [status.id]: s[2].id, [channel.id]: [c[0].id, c[1].id], [owner.id]: pick(users, 1), [date.id]: dayOffset(3), [rating.id]: 5 }],
          ['Customer story: regional newsroom', { [status.id]: s[1].id, [channel.id]: [c[1].id], [owner.id]: pick(users, 0), [date.id]: dayOffset(10), [rating.id]: 4 }],
          ['Monthly product digest', { [status.id]: s[0].id, [channel.id]: [c[2].id], [owner.id]: pick(users, 2), [date.id]: dayOffset(18), [rating.id]: 3 }],
        ],
        [['Behind the model: benchmark deep dive', { [status.id]: s[0].id, [channel.id]: [c[3].id], [rating.id]: 4 }]],
      ]
      return assemble(ws, 'Content calendar', '📣', this.description, [date, owner, status, channel, rating], groups, rows, [status.id, date.id], users[0]?.id ?? '')
    },
  },
  {
    id: 'blank',
    name: 'Blank board',
    icon: '✨',
    description: 'Start from scratch with the essentials.',
    build(ws, users) {
      const status = col('status', 'Status', { labels: statusLabels() })
      const owner = col('people', 'Owner')
      const date = col('date', 'Due date')
      const groups = [grp('Group title', COLORS.sky)]
      return assemble(ws, 'New board', '✨', '', [date, owner, status], groups, [[['New item', {}]]], [status.id, date.id], users[0]?.id ?? '')
    },
  },
]

export const DEMO_USERS: Omit<User, 'id'>[] = [
  { name: 'Ava Chen', color: COLORS.indigo, title: 'Co-founder' },
  { name: 'Leo Martins', color: COLORS.pink, title: 'Co-founder' },
  { name: 'Mia Okafor', color: COLORS.teal, title: 'Engineer' },
]

/** Text colour with the higher contrast on a label fill (crossover at luminance ~0.19). */
export function inkOn(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.19 ? '#121212' : '#ffffff'
}

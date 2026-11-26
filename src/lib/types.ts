// Core domain model. Every entity is stored as an independent document so it
// can sync row-by-row (browser storage or one Firestore collection per kind).

export type ColumnType =
  | 'status'
  | 'priority'
  | 'people'
  | 'date'
  | 'timeline'
  | 'text'
  | 'longtext'
  | 'number'
  | 'tags'
  | 'checkbox'
  | 'link'
  | 'rating'
  | 'progress'
  | 'formula'
  | 'time'
  | 'dependency'
  | 'connect'
  | 'mirror'
  | 'files'
  | 'email'
  | 'phone'
  | 'vote'
  | 'created'
  | 'updated'
  | 'itemId'
  | 'location'
  | 'hour'
  | 'week'
  | 'country'
  | 'worldclock'
  | 'color'
  | 'button'

export interface Label {
  id: string
  name: string
  color: string
  done?: boolean // counts as "complete" for progress / battery
}

export interface Column {
  id: string
  type: ColumnType
  title: string
  width?: number
  labels?: Label[] // status / priority / tags
  unit?: string // number prefix/suffix e.g. "€"
  formula?: string // formula: e.g. `{Hours} * {Rate}`
  boardId?: string // connect: target board
  connectColumnId?: string // mirror: connect column on this board
  mirrorColumnId?: string // mirror: column on the connected board to show
}

export interface Group {
  id: string
  title: string
  color: string
  collapsed?: boolean
  archived?: boolean
  archivedAt?: number
  deletedAt?: number // soft delete: in Trash, restorable for 30 days
}

export type ViewType = 'table' | 'kanban' | 'timeline' | 'calendar' | 'chart' | 'workload' | 'cards' | 'form' | 'files'

export type FilterOp = 'is' | 'is_not' | 'contains' | 'empty' | 'not_empty' | 'before' | 'after' | 'gt' | 'lt'
export interface FilterRule {
  id: string
  columnId: string // 'name' = item name
  op: FilterOp
  value?: string
}
export interface ViewFilter {
  mode: 'and' | 'or'
  rules: FilterRule[]
}

export interface View {
  id: string
  type: ViewType
  name: string
  columnId?: string // kanban grouping / chart dimension / calendar date column / workload people column
  groupBy?: string // table: column id to group by (undefined = board groups)
  filter?: ViewFilter
  valueColumnId?: string // workload: number column to sum (undefined = item count)
  dateColumnId?: string // workload: date / timeline column
  capacity?: number // workload: load per person per week
}

export type AutomationTrigger =
  | { kind: 'status_changes'; columnId: string; labelId: string }
  | { kind: 'item_created' }
  | { kind: 'date_arrives'; columnId: string }
  | { kind: 'column_changes'; columnId: string } // '' = any column
  | { kind: 'person_assigned'; columnId: string }
  | { kind: 'before_date'; columnId: string; days: number }
  | { kind: 'recurring'; every: 'day' | 'monday' | 'weekdays'; groupId: string; name: string; link?: string } // creates an item (weekdays: the week's Mon-Fri, dated), then runs the action on it

export type AutomationAction =
  | { kind: 'move_to_group'; groupId: string }
  | { kind: 'notify'; userId: string } // userId '' = assignees
  | { kind: 'set_status'; columnId: string; labelId: string }
  | { kind: 'assign'; columnId: string; userId: string }
  | { kind: 'set_date_today'; columnId: string }
  | { kind: 'create_in_board'; boardId: string; groupId: string }
  | { kind: 'archive' }
  | { kind: 'duplicate' }
  | { kind: 'clear_column'; columnId: string }
  | { kind: 'none' } // recurring rules that only create the item

export interface Automation {
  id: string
  enabled: boolean
  trigger: AutomationTrigger
  action: AutomationAction
  lastPeriod?: string // recurring: last period that already created its item
}

/** Who can read a board and everything on it: ['*'] = the whole team, otherwise these user ids (admins always can). */
export type Readers = string[]

export interface Board {
  id: string
  workspaceId: string
  name: string
  description?: string
  icon?: string // emoji
  columns: Column[]
  groups: Group[]
  views: View[]
  automations: Automation[]
  createdAt: number
  createdBy?: string
  order: number
  archived?: boolean
  archivedAt?: number
  deletedAt?: number // soft delete: in Trash, restorable for 30 days
  readers?: Readers
}

// Cell values by column type:
// status/priority: labelId | null, people: userId[], date: ISO 'yyyy-MM-dd',
// timeline: { start, end } ISO dates, text/longtext/link: string,
// number: number, tags: labelId[], checkbox: boolean, rating: 0-5,
// progress: 0-100, time: { total: ms, runningSince?: epoch ms },
// dependency/connect: itemId[], files: { name, url }[], email/phone/location: string,
// vote: userId[]. formula/mirror/created/updated/itemId are computed (no stored value).
export type CellValue = unknown

export interface Item {
  id: string
  boardId: string
  groupId: string
  parentId?: string // subitem
  readers?: Readers
  name: string
  values: Record<string, CellValue>
  order: number
  createdAt: number
  createdBy: string
  updatedAt?: number
  updatedBy?: string
  subscribers?: string[] // notified on updates and status changes; missing = creator + assignees
  archived?: boolean
  archivedAt?: number
  deletedAt?: number // soft delete: in Trash, restorable for 30 days
}

export interface Update {
  id: string
  itemId: string
  boardId: string
  authorId: string
  body: string
  createdAt: number
  likes: string[]
  parentId?: string // a reply to another update
  readers?: Readers
}

export interface Activity {
  id: string
  boardId: string
  itemId?: string
  actorId: string
  text: string
  at: number
  readers?: Readers
}

export interface Notification {
  id: string
  userId: string
  actorId: string
  text: string
  boardId?: string
  itemId?: string
  read: boolean
  at: number
  emailedAt?: number // set by the team server once the email went out
}

export interface User {
  id: string
  name: string
  email?: string
  username?: string
  color: string
  title?: string
  removedAt?: unknown // set by the team server when an admin removes the login
  emailNotify?: boolean // email me my notifications (to `email`)
}

export interface Workspace {
  id: string
  name: string
  color: string
  order: number
}

export type WidgetType = 'number' | 'battery' | 'chart' | 'workload' | 'overdue'
export interface Widget {
  id: string
  type: WidgetType
  title?: string
  agg?: 'count' | 'sum' // number
  columnTitle?: string // number: number column to sum, matched by title across boards
  labelName?: string // number: only items whose status label has this name
  chart?: 'bar' | 'pie' // chart
  by?: 'status' | 'person' // chart
}

/** Multi-board dashboard. Columns differ per board, so widgets match columns by title / label name. */
export interface Dashboard {
  id: string
  name: string
  boardIds: string[]
  widgets: Widget[]
  createdBy: string
  order: number
}

/** Markdown page, workspace-level or attached to a board. */
export interface Doc {
  id: string
  workspaceId: string
  boardId?: string
  title: string
  body: string
  createdBy: string
  updatedAt: number
  readers?: Readers
}

/** A step on a KPI ladder (investor funnel, sales pipeline), stored earliest first. */
export interface KpiStage {
  id: string
  name: string
  money?: 'soft' | 'committed' // investor stages: does money at this stage count as a soft or a firm commitment?
}
export interface KpiInvestor { id: string; name: string; stage: string; amount?: number; note?: string } // stage: a stage id, or 'passed'
export interface KpiAccount { id: string; name: string; stage: string; value?: number; chance?: number; note?: string } // value per year; chance 0-100
export type KpiSource = 'manual' | 'investors' | 'round' | 'stage'
export interface KpiMilestone {
  id: string
  name: string
  target: number
  actual?: number // manual milestones only; the others are counted from the board
  due?: string // yyyy-MM-dd
  money?: boolean // manual: target and actual are amounts of money
  source?: KpiSource // investors = firm investor money, round = whole round, stage = accounts at or past `stage`
  stage?: string
}
export interface KpiMonth { id: string; month: string; revenue?: number; cost?: number; cash?: number } // month yyyy-MM; cash = bank balance at month end
export interface KpiWeek { id: string; week: string; customer?: number; investor?: number; outreach?: number; lois?: number } // week = its Monday, yyyy-MM-dd
export interface KpiArea { id: string; name: string; score?: number } // 1-5
export interface KpiPerson { id: string; name: string; role?: string; fte?: number; status: 'active' | 'joining' | 'leaving'; date?: string }
export interface KpiRole { id: string; role: string; candidates?: number; interviews?: number; offer?: boolean }
/** A ladder fed by a Cue board: each live item is an entry, its status label picks the stage. */
export interface KpiLink {
  boardId: string
  columnId: string // status column on that board
  map: Record<string, string> // label id -> stage id, or 'passed'; unmapped labels are not counted
  amountColumnId?: string // number column: ticket (investors) or value (accounts)
  monthly?: boolean // the amount column is per month; the KPI board counts per year
  chanceColumnId?: string // number or progress column, 0-100 (accounts)
}

/** A company KPI board: fundraise, milestones, money, pipeline, activity, readiness and team, in one document. */
export interface Kpi {
  id: string
  name: string
  company?: string
  currency: string
  round: { target?: number; investorTarget?: number; government?: number; close?: string }
  investorStages: KpiStage[]
  investors: KpiInvestor[]
  investorFocus?: string
  investorLink?: KpiLink // when set, investors come from that board instead of `investors`
  accountStages: KpiStage[]
  accounts: KpiAccount[]
  accountFocus?: string
  accountLink?: KpiLink // when set, accounts come from that board instead of `accounts`
  milestones: KpiMilestone[]
  months: KpiMonth[]
  weeks: KpiWeek[]
  areas: KpiArea[]
  team: KpiPerson[]
  roles: KpiRole[]
  createdBy: string
  createdAt: number
  updatedAt: number
  updatedBy?: string
  order: number
  readers: Readers // private by default: [creator]; ['*'] = the whole team. Admins always see it.
}

/** A calendar event. Times are wall-clock times in `tz`; the whole team sees everyone's, only the owner changes them. */
export interface CalEvent {
  id: string
  ownerId: string
  title: string
  start: string // 'yyyy-MM-ddTHH:mm' in `tz`; all-day: the first day at 00:00
  end: string // same; all-day: the last day at 23:59
  allDay?: boolean
  tz: string // IANA zone of the browser it was saved from
  repeat?: { days: number[]; until?: string } // weekly on these weekdays (0 = Sunday), until this date (inclusive)
  exceptions?: string[] // dates (yyyy-MM-dd, event zone) dropped from the series
  seriesId?: string // one date split off a series by a "this event" edit; deleted with the series
  notes?: string
  location?: string
  createdAt: number
  updatedAt: number
}

export interface Docs {
  workspace: Workspace
  board: Board
  item: Item
  update: Update
  activity: Activity
  notification: Notification
  user: User
  dashboard: Dashboard
  doc: Doc
  kpi: Kpi
  event: CalEvent
}
export type Kind = keyof Docs
export const KINDS: Kind[] = ['workspace', 'board', 'item', 'update', 'activity', 'notification', 'user', 'dashboard', 'doc', 'kpi', 'event']

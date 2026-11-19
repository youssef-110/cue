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

export type ViewType = 'table' | 'kanban' | 'timeline' | 'calendar' | 'chart' | 'workload'

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
  | { kind: 'recurring'; every: 'day' | 'monday'; groupId: string; name: string } // creates an item, then runs the action on it

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
  order: number
  archived?: boolean
  archivedAt?: number
  deletedAt?: number // soft delete: in Trash, restorable for 30 days
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
}

export interface Activity {
  id: string
  boardId: string
  itemId?: string
  actorId: string
  text: string
  at: number
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
}

export interface User {
  id: string
  name: string
  email?: string
  username?: string
  color: string
  title?: string
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
}
export type Kind = keyof Docs
export const KINDS: Kind[] = ['workspace', 'board', 'item', 'update', 'activity', 'notification', 'user', 'dashboard', 'doc']

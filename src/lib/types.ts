// Core domain model. Every entity is stored as an independent document so it
// can sync row-by-row (local storage or the Supabase `docs` table).

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
}

export interface Group {
  id: string
  title: string
  color: string
  collapsed?: boolean
}

export type ViewType = 'table' | 'kanban' | 'timeline' | 'calendar' | 'chart'

export interface View {
  id: string
  type: ViewType
  name: string
  columnId?: string // kanban grouping / chart dimension / calendar date column
}

export type AutomationTrigger =
  | { kind: 'status_changes'; columnId: string; labelId: string }
  | { kind: 'item_created' }
  | { kind: 'date_arrives'; columnId: string }

export type AutomationAction =
  | { kind: 'move_to_group'; groupId: string }
  | { kind: 'notify'; userId: string } // userId '' = assignees
  | { kind: 'set_status'; columnId: string; labelId: string }
  | { kind: 'assign'; columnId: string; userId: string }
  | { kind: 'set_date_today'; columnId: string }

export interface Automation {
  id: string
  enabled: boolean
  trigger: AutomationTrigger
  action: AutomationAction
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
}

// Cell values by column type:
// status/priority: labelId | null, people: userId[], date: ISO 'yyyy-MM-dd',
// timeline: { start, end } ISO dates, text/longtext/link: string,
// number: number, tags: labelId[], checkbox: boolean, rating: 0-5,
// progress: 0-100
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
  color: string
  title?: string
}

export interface Workspace {
  id: string
  name: string
  color: string
  order: number
}

export interface Docs {
  workspace: Workspace
  board: Board
  item: Item
  update: Update
  activity: Activity
  notification: Notification
  user: User
}
export type Kind = keyof Docs
export const KINDS: Kind[] = ['workspace', 'board', 'item', 'update', 'activity', 'notification', 'user']

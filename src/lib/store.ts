import { create } from 'zustand'
import { toast } from 'sonner'
import { auth, emptySnapshot, type Adapter, type Snapshot } from './sync'
import { format, startOfWeek } from 'date-fns'
import type { Activity, Automation, AutomationAction, Board, CellValue, Column, Doc, Docs, Group, Item, Kind, Label, User, View, Workspace } from './types'
import { COLORS, COLOR_LIST, DEMO_USERS, TEMPLATES, dayOffset, priorityLabels, statusLabels, today, uid } from './seed'

export type Route =
  | { page: 'home' }
  | { page: 'my-work' }
  | { page: 'inbox' }
  | { page: 'board'; boardId: string; viewId?: string } // viewId 'doc' = the board's doc tab
  | { page: 'dashboards'; id?: string }
  | { page: 'archive' }
  | { page: 'doc'; id: string }
  | { page: 'help' }

interface State extends Snapshot {
  ready: boolean
  adapter: Adapter | null
  meId: string
  route: Route
  openItemId: string | null
  paletteOpen: boolean
  theme: 'light' | 'dark'
  isAdmin: boolean
  role: 'admin' | 'member' | 'viewer'
}

export const useStore = create<State>(() => ({
  ...emptySnapshot(),
  ready: false,
  adapter: null,
  meId: '',
  route: parseHash(),
  openItemId: null,
  paletteOpen: false,
  isAdmin: false,
  role: 'admin',
  theme: (localStorage.getItem('tideline:theme') as 'light' | 'dark') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
}))
const get = useStore.getState
const set = useStore.setState

// ---------- routing (hash based, works on any static host) ----------
function parseHash(): Route {
  const [, page, id, viewId] = location.hash.replace(/^#\/?/, '/').split('/')
  if (page === 'board' && id) return { page: 'board', boardId: id, viewId }
  if (page === 'dashboards') return { page: 'dashboards', id: id || undefined }
  if (page === 'doc' && id) return { page: 'doc', id }
  if (page === 'archive') return { page: 'archive' }
  if (page === 'my-work') return { page: 'my-work' }
  if (page === 'inbox') return { page: 'inbox' }
  if (page === 'help') return { page: 'help' }
  return { page: 'home' }
}
export function navigate(route: Route) {
  const hash =
    route.page === 'board'
      ? `#/board/${route.boardId}${route.viewId ? '/' + route.viewId : ''}`
      : route.page === 'dashboards' && route.id
        ? `#/dashboards/${route.id}`
        : route.page === 'doc'
          ? `#/doc/${route.id}`
          : `#/${route.page}`
  if (location.hash !== hash) history.pushState(null, '', hash)
  set({ route })
}
window.addEventListener('popstate', () => set({ route: parseHash() }))

export const openItem = (id: string | null) => set({ openItemId: id })
export const setPalette = (open: boolean) => set({ paletteOpen: open })
export function setTheme(theme: 'light' | 'dark') {
  localStorage.setItem('tideline:theme', theme)
  set({ theme })
}

// ---------- persistence primitives ----------
// Viewers may still comment (updates, activity, notifications, their profile); the
// server rules enforce the same, this just keeps the local state from drifting.
const VIEWER_KINDS: Kind[] = ['update', 'activity', 'notification', 'user']
const blocked = (kind: Kind) => get().role === 'viewer' && !VIEWER_KINDS.includes(kind) && (toast.error('You have view-only access', { id: 'view-only' }), true)
export const canEdit = () => get().role !== 'viewer'
export const useCanEdit = () => useStore((s) => s.role !== 'viewer')

// Everything on a board carries the board's readers, so the database can keep private boards private.
export const PUBLIC: string[] = ['*']
const STAMPED: Kind[] = ['item', 'update', 'activity', 'doc']
export const boardReaders = (boardId?: string) => (boardId && get().board[boardId]?.readers) || PUBLIC
export const isPrivate = (b?: Board) => !!b?.readers && !b.readers.includes('*')
export const canSeeBoard = (boardId: string | undefined, userId: string) => {
  const r = boardReaders(boardId)
  return r.includes('*') || r.includes(userId)
}
function stamp<K extends Kind>(kind: K, doc: Docs[K]): Docs[K] {
  if (kind === 'board') return (doc as Board).readers ? doc : { ...doc, readers: PUBLIC }
  if (STAMPED.includes(kind)) return { ...doc, readers: boardReaders((doc as { boardId?: string }).boardId) }
  return doc
}

export function put<K extends Kind>(kind: K, raw: Docs[K]) {
  if (blocked(kind)) return
  const doc = stamp(kind, raw)
  set((s) => ({ [kind]: { ...s[kind], [doc.id]: doc } }) as Partial<State>)
  get().adapter?.put(kind, doc)
}
export function remove(kind: Kind, id: string) {
  if (blocked(kind)) return
  set((s) => {
    const next = { ...s[kind] }
    delete next[id]
    return { [kind]: next } as Partial<State>
  })
  get().adapter?.remove(kind, id)
}

export async function init(adapter: Adapter, meId: string) {
  const snap = await adapter.load()
  set({ ...snap, adapter, meId, ready: true })
  adapter.subscribe(({ kind, id, doc }) =>
    set((s) => {
      const next = { ...s[kind] } as Record<string, unknown>
      if (doc) next[id] = doc
      else delete next[id]
      return { [kind]: next } as Partial<State>
    }),
  )
}

/** First run: create a workspace, a profile and starter boards. */
export function bootstrap(me: User, withDemo: boolean) {
  put('user', me)
  if (Object.keys(get().workspace).length) return
  const ws: Workspace = { id: uid('w_'), name: 'Main workspace', color: COLORS.indigo, order: 0 }
  put('workspace', ws)
  const team = withDemo ? DEMO_USERS.map((u) => ({ ...u, id: uid('u_') })) : []
  team.forEach((u) => put('user', u))
  const people = [me, ...team]
  const ids = withDemo ? ['team-tasks', 'sales-pipeline', 'roadmap', 'content'] : ['team-tasks']
  let first = ''
  ids.forEach((tid, i) => {
    const { board, items } = TEMPLATES.find((t) => t.id === tid)!.build(ws.id, people)
    board.order = i
    board.createdBy = me.id
    put('board', board)
    if (withDemo) items.forEach((it) => put('item', it)) // real teams start with an empty board
    first ||= board.id
  })
  navigate({ page: 'board', boardId: first })
}

// ---------- selectors ----------
export const me = () => get().user[get().meId]
/** Live (not archived / trashed) items of a board. */
export const boardItems = (boardId: string) =>
  Object.values(get().item)
    .filter((i) => i.boardId === boardId && isLive(i))
    .sort((a, b) => a.order - b.order)
type Flags = { archived?: boolean; deletedAt?: number }
export const isLive = (x?: Flags) => !!x && !x.archived && !x.deletedAt
/** An item shows in views when it, its parent, its group and its board are all live. */
export function visibleItem(i: Item, boards: Record<string, Board> = get().board, items: Record<string, Item> = get().item) {
  const b = boards[i.boardId]
  if (!isLive(i) || !isLive(b)) return false
  const g = b.groups.find((x) => x.id === i.groupId)
  return (!g || isLive(g)) && (!i.parentId || isLive(items[i.parentId]))
}
export const liveGroups = (b: Board) => b.groups.filter(isLive)
export const useBoard = (id: string) => useStore((s) => s.board[id])
export const labelOf = (col: Column | undefined, id: unknown): Label | undefined => col?.labels?.find((l) => l.id === id)
export const userName = (id: string) => get().user[id]?.name ?? 'Someone'

function log(boardId: string, text: string, itemId?: string) {
  const a: Activity = { id: uid('a_'), boardId, itemId, actorId: get().meId, text, at: Date.now() }
  put('activity', a)
}
export function notify(userId: string, text: string, boardId?: string, itemId?: string) {
  if (!userId || userId === get().meId) return
  if (!canSeeBoard(boardId, userId)) return // never leak a private board's items
  const id = uid('n_')
  put('notification', { id, userId, actorId: get().meId, text, boardId, itemId, read: false, at: Date.now() })
  emailQueue.push(id)
  clearTimeout(emailTimer)
  emailTimer = setTimeout(() => onNotify?.(emailQueue.splice(0)), 1500)
}
// team mode wires this to the email sender; batched so a burst of changes is one request
const emailQueue: string[] = []
let emailTimer: ReturnType<typeof setTimeout> | undefined
let onNotify: ((ids: string[]) => void) | undefined
export const setNotifyHook = (fn: (ids: string[]) => void) => (onNotify = fn)

// ---------- workspaces & boards ----------
export function createWorkspace(name: string) {
  const ws: Workspace = { id: uid('w_'), name, color: COLOR_LIST[Object.keys(get().workspace).length % COLOR_LIST.length], order: Date.now() }
  put('workspace', ws)
  return ws
}
export function createBoardFromTemplate(templateId: string, workspaceId: string, name?: string) {
  const people = Object.values(get().user)
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[TEMPLATES.length - 1]
  const { board, items } = t.build(workspaceId, people)
  if (name) board.name = name
  board.createdBy = get().meId
  put('board', board)
  if (!auth) items.forEach((it) => put('item', it)) // example items only in local mode; team boards start empty
  log(board.id, `created board “${board.name}”`)
  navigate({ page: 'board', boardId: board.id })
  return board
}
/** Make a board private to some people (always including you), or open it to the whole team. */
export async function setBoardAccess(boardId: string, readers: string[], server?: (boardId: string, readers: string[]) => Promise<unknown>) {
  const b = get().board[boardId]
  if (!b) return
  const next = readers.includes('*') ? PUBLIC : [...new Set([get().meId, ...readers])]
  if (server) return void (await server(boardId, next)) // the snapshot listener brings the restamped docs back
  set((s) => {
    const patch: Partial<State> = { board: { ...s.board, [boardId]: { ...b, readers: next } } }
    for (const k of STAMPED) {
      const all = { ...(s[k] as Record<string, { boardId?: string }>) }
      for (const [id, d] of Object.entries(all)) if (d.boardId === boardId) all[id] = { ...d, readers: next } as never
      ;(patch as Record<string, unknown>)[k] = all
    }
    return patch
  })
  const s = get()
  s.adapter?.put('board', s.board[boardId])
  for (const k of STAMPED) Object.values(s[k] as Record<string, Docs[typeof k] & { boardId?: string }>).filter((d) => d.boardId === boardId).forEach((d) => s.adapter?.put(k, d))
}

export function updateBoard(id: string, patch: Partial<Board>) {
  const b = get().board[id]
  if (b) put('board', { ...b, ...patch })
}
const CLEARED = { archived: undefined, archivedAt: undefined, deletedAt: undefined }
const leaveBoard = (id: string) => {
  const r = get().route
  if (r.page === 'board' && r.boardId === id) navigate({ page: 'home' })
}
export function archiveBoard(id: string) {
  const b = get().board[id]
  if (!b) return
  updateBoard(id, { archived: true, archivedAt: Date.now() })
  leaveBoard(id)
  toast(`Archived “${b.name}”`, { action: { label: 'Undo', onClick: () => restoreBoard(id) } })
}
/** Moves the board to Trash (restorable for 30 days). */
export function deleteBoard(id: string) {
  const b = get().board[id]
  if (!b) return
  updateBoard(id, { deletedAt: Date.now() })
  leaveBoard(id)
  toast(`Moved “${b.name}” to trash`, { action: { label: 'Undo', onClick: () => restoreBoard(id) } })
}
export const restoreBoard = (id: string) => updateBoard(id, CLEARED)
/** Only a board's creator or an admin may delete it for good (enforced by the rules too). */
export const canPurgeBoard = (b?: Board) => !!b && (get().isAdmin || (!!b.createdBy && b.createdBy === get().meId))
export function deleteBoardForever(id: string) {
  const s = get()
  if (!canPurgeBoard(s.board[id])) return void toast.error('Only the person who made this board, or an admin, can delete it for good', { id: 'purge' })
  Object.values(s.item).filter((i) => i.boardId === id).forEach((i) => remove('item', i.id))
  Object.values(s.update).filter((u) => u.boardId === id).forEach((u) => remove('update', u.id))
  Object.values(s.doc).filter((d) => d.boardId === id).forEach((d) => remove('doc', d.id))
  remove('board', id)
}
export function duplicateBoard(id: string) {
  const b = get().board[id]
  if (!b) return
  const groupMap = new Map(b.groups.map((g) => [g.id, uid('g_')]))
  const copy: Board = { ...structuredClone(b), id: uid('b_'), name: b.name + ' (copy)', createdAt: Date.now(), createdBy: get().meId, order: Date.now() }
  copy.groups = copy.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! }))
  copy.views = copy.views.map((v) => ({ ...v, id: uid('v_') }))
  put('board', copy)
  const itemMap = new Map<string, string>()
  boardItems(id).forEach((i) => itemMap.set(i.id, uid('i_')))
  boardItems(id).forEach((i) =>
    put('item', { ...structuredClone(i), id: itemMap.get(i.id)!, boardId: copy.id, groupId: groupMap.get(i.groupId) ?? i.groupId, parentId: i.parentId && itemMap.get(i.parentId) }),
  )
  navigate({ page: 'board', boardId: copy.id })
}

// ---------- columns ----------
const DEFAULT_TITLES: Record<Column['type'], string> = {
  status: 'Status', priority: 'Priority', people: 'Person', date: 'Date', timeline: 'Timeline', text: 'Text', longtext: 'Long text',
  number: 'Numbers', tags: 'Tags', checkbox: 'Check', link: 'Link', rating: 'Rating', progress: 'Progress',
  formula: 'Formula', time: 'Time tracking', dependency: 'Dependent on', connect: 'Connected items', mirror: 'Mirror', files: 'Files',
  email: 'Email', phone: 'Phone', vote: 'Vote', created: 'Created', updated: 'Last updated', itemId: 'Item ID', location: 'Location',
  hour: 'Hour', week: 'Week', country: 'Country', worldclock: 'World clock', color: 'Color', button: 'Button',
}
export function addColumn(boardId: string, type: Column['type']) {
  const b = get().board[boardId]
  const c: Column = { id: uid('c_'), type, title: DEFAULT_TITLES[type] }
  if (type === 'status') c.labels = statusLabels()
  if (type === 'priority') c.labels = priorityLabels()
  if (type === 'tags') c.labels = []
  if (type === 'formula') c.formula = ''
  updateBoard(boardId, { columns: [...b.columns, c] })
  return c
}
export function updateColumn(boardId: string, colId: string, patch: Partial<Column>) {
  const b = get().board[boardId]
  updateBoard(boardId, { columns: b.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) })
}
export function removeColumn(boardId: string, colId: string) {
  const b = get().board[boardId]
  updateBoard(boardId, { columns: b.columns.filter((c) => c.id !== colId) })
}
export function moveColumn(boardId: string, from: number, to: number) {
  const cols = [...get().board[boardId].columns]
  const [c] = cols.splice(from, 1)
  cols.splice(to, 0, c)
  updateBoard(boardId, { columns: cols })
}

// ---------- groups ----------
export function addGroup(boardId: string, title = 'New group') {
  const b = get().board[boardId]
  const g: Group = { id: uid('g_'), title, color: COLOR_LIST[(b.groups.length * 3) % COLOR_LIST.length] }
  updateBoard(boardId, { groups: [g, ...b.groups] })
  return g
}
export function updateGroup(boardId: string, groupId: string, patch: Partial<Group>) {
  const b = get().board[boardId]
  updateBoard(boardId, { groups: b.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) })
}
export function archiveGroup(boardId: string, groupId: string) {
  updateGroup(boardId, groupId, { archived: true, archivedAt: Date.now() })
  toast('Group archived', { action: { label: 'Undo', onClick: () => restoreGroup(boardId, groupId) } })
}
/** Moves the group (and with it its items) to Trash. */
export function removeGroup(boardId: string, groupId: string) {
  updateGroup(boardId, groupId, { deletedAt: Date.now() })
  toast('Group moved to trash', { action: { label: 'Undo', onClick: () => restoreGroup(boardId, groupId) } })
}
export const restoreGroup = (boardId: string, groupId: string) => updateGroup(boardId, groupId, CLEARED)
export function deleteGroupForever(boardId: string, groupId: string) {
  const b = get().board[boardId]
  if (!b) return
  const ids = Object.values(get().item).filter((i) => i.boardId === boardId && i.groupId === groupId).map((i) => i.id)
  hardDeleteItems(ids)
  updateBoard(boardId, { groups: b.groups.filter((g) => g.id !== groupId) })
}
export function setAllGroupsCollapsed(boardId: string, collapsed: boolean) {
  const b = get().board[boardId]
  if (b) updateBoard(boardId, { groups: b.groups.map((g) => ({ ...g, collapsed })) })
}
/** Copies a group with its items and subitems, right below the original. */
export function duplicateGroup(boardId: string, groupId: string) {
  const b = get().board[boardId]
  const g = b?.groups.find((x) => x.id === groupId)
  if (!g) return
  const copy: Group = { ...g, id: uid('g_'), title: g.title + ' (copy)', collapsed: false }
  const at = b.groups.indexOf(g) + 1
  updateBoard(boardId, { groups: [...b.groups.slice(0, at), copy, ...b.groups.slice(at)] })
  const items = boardItems(boardId).filter((i) => i.groupId === groupId)
  const ids = new Map(items.map((i) => [i.id, uid('i_')]))
  items.forEach((i) =>
    put('item', { ...structuredClone(i), id: ids.get(i.id)!, groupId: copy.id, parentId: i.parentId && ids.get(i.parentId), createdAt: Date.now(), createdBy: get().meId }),
  )
  log(boardId, `duplicated group “${g.title}”`)
}
/** Moves a group and its items to another board; values move to columns with the same type and title. */
export function moveGroupToBoard(boardId: string, groupId: string, targetId: string) {
  const from = get().board[boardId]
  const to = get().board[targetId]
  const g = from?.groups.find((x) => x.id === groupId)
  if (!g || !to || boardId === targetId) return
  const colMap = new Map<string, string>()
  for (const c of from.columns) {
    const t = to.columns.find((x) => x.id === c.id) ?? to.columns.find((x) => x.type === c.type && x.title.toLowerCase() === c.title.toLowerCase())
    if (t) colMap.set(c.id, t.id)
  }
  const mapValue = (c: Column, v: CellValue): CellValue => {
    const t = to.columns.find((x) => x.id === colMap.get(c.id))
    if (!t?.labels || !c.labels) return v
    // labels differ per board: match by name
    const byName = (id: unknown) => t.labels!.find((l) => l.name === labelOf(c, id)?.name)?.id
    return Array.isArray(v) ? v.map(byName).filter(Boolean) : (byName(v) ?? null)
  }
  updateBoard(targetId, { groups: [...to.groups, { ...g }] })
  updateBoard(boardId, { groups: from.groups.filter((x) => x.id !== groupId) })
  const items = Object.values(get().item).filter((i) => i.boardId === boardId && i.groupId === groupId)
  const ids = new Set(items.map((i) => i.id))
  for (const i of items) {
    const values: Record<string, CellValue> = {}
    for (const c of from.columns) if (colMap.has(c.id) && i.values[c.id] != null) values[colMap.get(c.id)!] = mapValue(c, i.values[c.id])
    put('item', { ...i, boardId: targetId, values })
  }
  Object.values(get().update).filter((u) => ids.has(u.itemId)).forEach((u) => put('update', { ...u, boardId: targetId }))
  log(targetId, `moved group “${g.title}” here from “${from.name}”`)
  toast(`Moved “${g.title}” to ${to.name}`)
}

// ---------- views ----------
export function addView(boardId: string, type: View['type']) {
  const b = get().board[boardId]
  const status = b.columns.find((c) => c.type === 'status')
  const date = b.columns.find((c) => c.type === 'date')
  const timeline = b.columns.find((c) => c.type === 'timeline')
  const columnId = type === 'calendar' ? date?.id : type === 'timeline' ? (timeline ?? date)?.id : status?.id
  const names: Record<View['type'], string> = { table: 'Table', kanban: 'Kanban', timeline: 'Timeline', calendar: 'Calendar', chart: 'Dashboard', workload: 'Workload', cards: 'Cards', form: 'Form', files: 'Files' }
  const v: View = { id: uid('v_'), type, name: names[type], columnId }
  if (type === 'workload') {
    v.columnId = b.columns.find((c) => c.type === 'people')?.id
    v.dateColumnId = (timeline ?? date)?.id
    v.capacity = 5
  }
  updateBoard(boardId, { views: [...b.views, v] })
  navigate({ page: 'board', boardId, viewId: v.id })
}

// ---------- items ----------
export function addItem(boardId: string, groupId: string, name: string, opts: { parentId?: string; values?: Record<string, CellValue>; top?: boolean } = {}) {
  const siblings = boardItems(boardId).filter((i) => i.groupId === groupId && i.parentId === opts.parentId)
  const order = opts.top ? (siblings[0]?.order ?? 1) - 1 : (siblings.at(-1)?.order ?? 0) + 1
  const item: Item = { id: uid('i_'), boardId, groupId, parentId: opts.parentId, name, values: opts.values ?? {}, order, createdAt: Date.now(), createdBy: get().meId }
  const b = get().board[boardId]
  item.subscribers = b ? [...new Set([item.createdBy, ...assigneesOf(b, item)])] : [item.createdBy]
  put('item', item)
  log(boardId, `created “${name}”`, item.id)
  runAutomations(item, { kind: 'item_created' })
  return item
}
// ---------- undo (Ctrl Z): cell edits and renames made in this tab ----------
type Undo = { itemId: string; colId?: string; prev: CellValue; label: string }
const undoStack: Undo[] = []
let undoing = false
const remember = (u: Undo) => !undoing && (undoStack.push(u), undoStack.length > 50 && undoStack.shift())
export function undo() {
  const u = undoStack.pop()
  if (!u || !get().item[u.itemId]) return toast('Nothing to undo', { id: 'undo' })
  undoing = true
  if (u.colId) setValue(u.itemId, u.colId, u.prev)
  else renameItem(u.itemId, u.prev as string)
  undoing = false
  toast(`Undid ${u.label}`, { id: 'undo' })
}

export function renameItem(id: string, name: string) {
  const i = get().item[id]
  if (!i || i.name === name) return
  remember({ itemId: id, prev: i.name, label: `rename of “${name}”` })
  put('item', { ...i, name })
}
export function setValue(itemId: string, colId: string, value: CellValue) {
  const item = get().item[itemId]
  if (!item) return
  const b = get().board[item.boardId]
  const col = b?.columns.find((c) => c.id === colId)
  const prev = item.values[colId]
  if (canEdit()) remember({ itemId, colId, prev, label: `${col?.title ?? 'edit'} on “${item.name}”` })
  const next: Item = { ...item, values: { ...item.values, [colId]: value }, updatedAt: Date.now(), updatedBy: get().meId }
  put('item', next)
  if (!col) return
  afterValueChange(next, col, prev)
  if (col.type === 'status' || col.type === 'priority') {
    log(b.id, `changed ${col.title} to ${labelOf(col, value)?.name ?? 'empty'} on “${item.name}”`, itemId)
    if (col.type === 'status') runAutomations(next, { kind: 'status_changes', columnId: colId, labelId: value as string })
  }
  if (col.type === 'people') {
    const added = ((value as string[]) ?? []).filter((u) => !((prev as string[]) ?? []).includes(u))
    added.forEach((u) => notify(u, `assigned you to “${item.name}”`, b.id, itemId))
  }
}
export function moveItem(itemId: string, groupId: string, order: number) {
  const i = get().item[itemId]
  if (!i) return
  put('item', { ...i, groupId, order })
  boardItems(i.boardId).filter((s) => s.parentId === itemId && s.groupId !== groupId).forEach((s) => put('item', { ...s, groupId }))
}
const withSubitems = (ids: string[]) => {
  const all = Object.values(get().item)
  return ids.flatMap((id) => [get().item[id], ...all.filter((s) => s.parentId === id)]).filter(Boolean)
}
function flagItems(ids: string[], patch: Partial<Item>, verb: string) {
  const list = withSubitems(ids)
  list.forEach((i) => put('item', { ...i, ...patch }))
  if (get().openItemId && ids.includes(get().openItemId!)) openItem(null)
  if (list.length) toast(`${verb} ${ids.length} item${ids.length > 1 ? 's' : ''}`, { action: { label: 'Undo', onClick: () => restoreItems(ids) } })
}
export const archiveItems = (ids: string[]) => flagItems(ids, { archived: true, archivedAt: Date.now() }, 'Archived')
/** Moves items (and their subitems) to Trash. */
export const deleteItems = (ids: string[]) => flagItems(ids, { deletedAt: Date.now() }, 'Moved to trash:')
export const restoreItems = (ids: string[]) => withSubitems(ids).forEach((i) => put('item', { ...i, ...CLEARED }))
function hardDeleteItems(ids: string[]) {
  const list = withSubitems(ids)
  const gone = new Set(list.map((i) => i.id))
  list.forEach((i) => remove('item', i.id))
  Object.values(get().update).filter((u) => gone.has(u.itemId)).forEach((u) => remove('update', u.id))
}
export const deleteItemsForever = hardDeleteItems

// ---------- archive & trash ----------
const TRASH_DAYS = 30
/** Hard-deletes everything in Trash, or only what is older than 30 days. */
export function emptyTrash(onlyExpired = false) {
  const cutoff = onlyExpired ? Date.now() - TRASH_DAYS * 864e5 : Infinity
  const old = (x: Flags) => !!x.deletedAt && x.deletedAt < cutoff
  const s = get()
  Object.values(s.board).filter((b) => old(b) && canPurgeBoard(b)).forEach((b) => deleteBoardForever(b.id))
  Object.values(get().board).forEach((b) => b.groups.filter(old).forEach((g) => deleteGroupForever(b.id, g.id)))
  hardDeleteItems(Object.values(get().item).filter(old).map((i) => i.id))
}
export function duplicateItem(id: string) {
  const i = get().item[id]
  if (!i) return
  return addItem(i.boardId, i.groupId, i.name + ' (copy)', { parentId: i.parentId, values: structuredClone(i.values) })
}

// ---------- updates (comments) ----------
export function addUpdate(itemId: string, body: string, parentId?: string) {
  const item = get().item[itemId]
  if (!item || !body.trim()) return
  put('update', { id: uid('up_'), itemId, boardId: item.boardId, authorId: get().meId, body, createdAt: Date.now(), likes: [], ...(parentId && { parentId }) })
  log(item.boardId, `${parentId ? 'replied' : 'commented'} on “${item.name}”`, itemId)
  // notify subscribers, everyone assigned and mentioned teammates (@First); notify() skips the author
  const b = get().board[item.boardId]
  const to = new Set([...subscribersOf(b, item), ...assigneesOf(b, item)])
  Object.values(get().user).forEach((u) => body.includes('@' + u.name.split(' ')[0]) && to.add(u.id))
  const parent = parentId && get().update[parentId]
  if (parent) to.add(parent.authorId)
  to.forEach((u) => notify(u, `${parent ? 'replied to an update' : 'wrote an update'} on “${item.name}”`, b.id, itemId))
}

// ---------- subscribers ----------
export const assigneesOf = (b: Board, i: Item) => b.columns.filter((c) => c.type === 'people').flatMap((c) => (i.values[c.id] as string[]) ?? [])
export const subscribersOf = (b: Board | undefined, i: Item) => i.subscribers ?? [i.createdBy, ...(b ? assigneesOf(b, i) : [])]
export function toggleSubscribe(itemId: string, userId = get().meId) {
  const i = get().item[itemId]
  if (!i) return
  const cur = subscribersOf(get().board[i.boardId], i)
  put('item', { ...i, subscribers: cur.includes(userId) ? cur.filter((u) => u !== userId) : [...cur, userId] })
}
/** Side effects of a cell change: subscriber notifications and column/person automations. */
function afterValueChange(item: Item, col: Column, prev: CellValue) {
  const b = get().board[item.boardId]
  const value = item.values[col.id]
  if (col.type === 'status' && value !== prev)
    subscribersOf(b, item).forEach((u) => notify(u, `changed ${col.title} to ${labelOf(col, value)?.name ?? 'empty'} on “${item.name}”`, b.id, item.id))
  if (col.type === 'people') {
    const added = ((value as string[]) ?? []).filter((u) => !((prev as string[]) ?? []).includes(u))
    if (added.length) {
      const cur = get().item[item.id]
      const subs = subscribersOf(b, cur)
      if (added.some((u) => !subs.includes(u))) put('item', { ...cur, subscribers: [...new Set([...subs, ...added])] })
      runAutomations(get().item[item.id], { kind: 'person_assigned', columnId: col.id })
    }
  }
  if (get().item[item.id]) runAutomations(get().item[item.id], { kind: 'column_changes', columnId: col.id })
}
export function toggleLike(updateId: string) {
  const u = get().update[updateId]
  const meId = get().meId
  if (u) put('update', { ...u, likes: u.likes.includes(meId) ? u.likes.filter((x) => x !== meId) : [...u.likes, meId] })
}

// ---------- automations ----------
type Event =
  | { kind: 'item_created' }
  | { kind: 'status_changes'; columnId: string; labelId: string }
  | { kind: 'column_changes'; columnId: string }
  | { kind: 'person_assigned'; columnId: string }
function matches(t: Automation['trigger'], ev: Event) {
  if (t.kind !== ev.kind) return false
  if (t.kind === 'status_changes' && ev.kind === 'status_changes') return t.columnId === ev.columnId && t.labelId === ev.labelId
  if ((t.kind === 'column_changes' || t.kind === 'person_assigned') && 'columnId' in ev) return !t.columnId || t.columnId === ev.columnId
  return t.kind === 'item_created'
}
function runAutomations(item: Item, ev: Event) {
  const b = get().board[item.boardId]
  if (!b) return
  for (const a of b.automations) if (a.enabled && matches(a.trigger, ev)) fire(b, a, item.id)
}
let depth = 0
function fire(b: Board, a: Automation, itemId: string) {
  const cur = get().item[itemId]
  if (!cur || depth > 3) return // guard against automation loops
  depth++
  try {
    applyAction(b, a.action, cur)
    if (a.action.kind !== 'none') log(b.id, `automation ran on “${cur.name}”`, cur.id)
  } finally {
    depth--
  }
}
function applyAction(b: Board, act: AutomationAction, cur: Item) {
  switch (act.kind) {
    case 'move_to_group':
      return moveItem(cur.id, act.groupId, Date.now())
    case 'set_status':
      return setValue(cur.id, act.columnId, act.labelId)
    case 'assign':
      return setValue(cur.id, act.columnId, [...new Set([...((cur.values[act.columnId] as string[]) ?? []), act.userId])])
    case 'set_date_today':
      return setValue(cur.id, act.columnId, today())
    case 'clear_column':
      return setValue(cur.id, act.columnId, null)
    case 'archive':
      return archiveItems([cur.id])
    case 'duplicate':
      return void duplicateItem(cur.id)
    case 'create_in_board': {
      const t = get().board[act.boardId]
      const g = t && (t.groups.find((x) => x.id === act.groupId && isLive(x)) ?? liveGroups(t)[0])
      if (g && isLive(t)) addItem(t.id, g.id, cur.name)
      return
    }
    case 'notify': {
      const targets = act.userId ? [act.userId] : assigneesOf(b, cur)
      return targets.forEach((u) => notify(u, `automation: “${cur.name}” needs your attention`, b.id, cur.id))
    }
  }
}
/** Recurring rule: create one item per day / week. The period is stored on the rule (synced), so it never repeats. */
function runRecurring(b: Board, a: Automation) {
  if (a.trigger.kind !== 'recurring') return
  const tr = a.trigger
  const period = tr.every === 'day' ? today() : format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  if (a.lastPeriod === period) return
  // shortcut: two clients checking in the same instant could both create the item; move to a server job if that ever matters
  updateBoard(b.id, { automations: get().board[b.id].automations.map((x) => (x.id === a.id ? { ...x, lastPeriod: period } : x)) })
  const fresh = get().board[b.id]
  const g = fresh.groups.find((x) => x.id === tr.groupId && isLive(x)) ?? liveGroups(fresh)[0]
  if (!g) return
  const item = addItem(b.id, g.id, (tr.name.trim() || 'New item').replaceAll('{date}', today()))
  fire(fresh, a, item.id)
}
const dateValue = (v: unknown) => (typeof v === 'string' ? v : (v as { start?: string } | null)?.start)
/** Date and recurring automations + trash cleanup (on load + hourly). Date rules fire once per item/day. */
export function checkDateAutomations() {
  if (!canEdit()) return // viewers can't write; an editor's session runs these
  emptyTrash(true)
  const t = today()
  const doneKey = 'tideline:date-auto:' + t
  const done = new Set<string>(JSON.parse(localStorage.getItem(doneKey) ?? '[]'))
  for (const b of Object.values(get().board)) {
    if (!isLive(b)) continue
    for (const a of b.automations) {
      if (!a.enabled) continue
      const tr = a.trigger
      if (tr.kind === 'recurring') runRecurring(b, a)
      if (tr.kind !== 'date_arrives' && tr.kind !== 'before_date') continue
      const target = tr.kind === 'before_date' ? dayOffset(tr.days) : t
      for (const it of boardItems(b.id)) {
        const key = a.id + it.id
        if (dateValue(it.values[tr.columnId]) === target && visibleItem(it) && !done.has(key)) {
          done.add(key)
          fire(b, a, it.id)
        }
      }
    }
  }
  localStorage.setItem(doneKey, JSON.stringify([...done]))
}

// ---------- notifications ----------
export function markRead(ids: string[]) {
  ids.forEach((id) => {
    const n = get().notification[id]
    if (n && !n.read) put('notification', { ...n, read: true })
  })
}

export function updateUser(id: string, patch: Partial<User>) {
  const u = get().user[id]
  if (u) put('user', { ...u, ...patch })
}
export function addTeammate(name: string, email?: string) {
  const u: User = { id: uid('u_'), name, email, color: COLOR_LIST[Object.keys(get().user).length % COLOR_LIST.length] }
  put('user', u)
  return u
}

// ---------- docs ----------
export function createDoc(workspaceId: string, boardId?: string, title = 'Untitled doc') {
  const d: Doc = { id: uid('d_'), workspaceId, boardId, title, body: '', createdBy: get().meId, updatedAt: Date.now() }
  put('doc', d)
  return d
}
export function updateDoc(id: string, patch: Partial<Doc>) {
  const d = get().doc[id]
  if (d) put('doc', { ...d, ...patch, updatedAt: Date.now() })
}
export function deleteDoc(id: string) {
  const d = get().doc[id]
  if (!d) return
  remove('doc', id)
  toast(`Deleted “${d.title}”`, { action: { label: 'Undo', onClick: () => put('doc', d) } })
}

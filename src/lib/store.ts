import { create } from 'zustand'
import { toast } from 'sonner'
import { emptySnapshot, type Adapter, type Snapshot } from './sync'
import type { Activity, Board, CellValue, Column, Docs, Group, Item, Kind, Label, User, View, Workspace } from './types'
import { COLORS, COLOR_LIST, DEMO_USERS, TEMPLATES, priorityLabels, statusLabels, today, uid } from './seed'

export type Route =
  | { page: 'home' }
  | { page: 'my-work' }
  | { page: 'inbox' }
  | { page: 'board'; boardId: string; viewId?: string }

interface State extends Snapshot {
  ready: boolean
  adapter: Adapter | null
  meId: string
  route: Route
  openItemId: string | null
  paletteOpen: boolean
  theme: 'light' | 'dark'
}

export const useStore = create<State>(() => ({
  ...emptySnapshot(),
  ready: false,
  adapter: null,
  meId: '',
  route: parseHash(),
  openItemId: null,
  paletteOpen: false,
  theme: (localStorage.getItem('tideline:theme') as 'light' | 'dark') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
}))
const get = useStore.getState
const set = useStore.setState

// ---------- routing (hash based, works on any static host) ----------
function parseHash(): Route {
  const [, page, id, viewId] = location.hash.replace(/^#\/?/, '/').split('/')
  if (page === 'board' && id) return { page: 'board', boardId: id, viewId }
  if (page === 'my-work') return { page: 'my-work' }
  if (page === 'inbox') return { page: 'inbox' }
  return { page: 'home' }
}
export function navigate(route: Route) {
  const hash = route.page === 'board' ? `#/board/${route.boardId}${route.viewId ? '/' + route.viewId : ''}` : `#/${route.page}`
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
export function put<K extends Kind>(kind: K, doc: Docs[K]) {
  set((s) => ({ [kind]: { ...s[kind], [doc.id]: doc } }) as Partial<State>)
  get().adapter?.put(kind, doc)
}
export function remove(kind: Kind, id: string) {
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
    put('board', board)
    items.forEach((it) => put('item', it))
    first ||= board.id
  })
  navigate({ page: 'board', boardId: first })
}

// ---------- selectors ----------
export const me = () => get().user[get().meId]
export const boardItems = (boardId: string) =>
  Object.values(get().item)
    .filter((i) => i.boardId === boardId)
    .sort((a, b) => a.order - b.order)
export const useBoard = (id: string) => useStore((s) => s.board[id])
export const labelOf = (col: Column | undefined, id: unknown): Label | undefined => col?.labels?.find((l) => l.id === id)
export const userName = (id: string) => get().user[id]?.name ?? 'Someone'

function log(boardId: string, text: string, itemId?: string) {
  const a: Activity = { id: uid('a_'), boardId, itemId, actorId: get().meId, text, at: Date.now() }
  put('activity', a)
}
export function notify(userId: string, text: string, boardId?: string, itemId?: string) {
  if (!userId || userId === get().meId) return
  put('notification', { id: uid('n_'), userId, actorId: get().meId, text, boardId, itemId, read: false, at: Date.now() })
}

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
  put('board', board)
  items.forEach((it) => put('item', it))
  log(board.id, `created board “${board.name}”`)
  navigate({ page: 'board', boardId: board.id })
  return board
}
export function updateBoard(id: string, patch: Partial<Board>) {
  const b = get().board[id]
  if (b) put('board', { ...b, ...patch })
}
export function deleteBoard(id: string) {
  const b = get().board[id]
  if (!b) return
  const items = boardItems(id)
  items.forEach((i) => remove('item', i.id))
  remove('board', id)
  navigate({ page: 'home' })
  toast(`Deleted “${b.name}”`, {
    action: { label: 'Undo', onClick: () => (put('board', b), items.forEach((i) => put('item', i))) },
  })
}
export function duplicateBoard(id: string) {
  const b = get().board[id]
  if (!b) return
  const groupMap = new Map(b.groups.map((g) => [g.id, uid('g_')]))
  const copy: Board = { ...structuredClone(b), id: uid('b_'), name: b.name + ' (copy)', createdAt: Date.now(), order: Date.now() }
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
}
export function addColumn(boardId: string, type: Column['type']) {
  const b = get().board[boardId]
  const c: Column = { id: uid('c_'), type, title: DEFAULT_TITLES[type] }
  if (type === 'status') c.labels = statusLabels()
  if (type === 'priority') c.labels = priorityLabels()
  if (type === 'tags') c.labels = []
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
export function removeGroup(boardId: string, groupId: string) {
  const b = get().board[boardId]
  const items = boardItems(boardId).filter((i) => i.groupId === groupId)
  updateBoard(boardId, { groups: b.groups.filter((g) => g.id !== groupId) })
  items.forEach((i) => remove('item', i.id))
  toast('Group deleted', { action: { label: 'Undo', onClick: () => (updateBoard(boardId, { groups: b.groups }), items.forEach((i) => put('item', i))) } })
}

// ---------- views ----------
export function addView(boardId: string, type: View['type']) {
  const b = get().board[boardId]
  const status = b.columns.find((c) => c.type === 'status')
  const date = b.columns.find((c) => c.type === 'date')
  const timeline = b.columns.find((c) => c.type === 'timeline')
  const columnId = type === 'calendar' ? date?.id : type === 'timeline' ? (timeline ?? date)?.id : status?.id
  const names = { table: 'Table', kanban: 'Kanban', timeline: 'Timeline', calendar: 'Calendar', chart: 'Dashboard' }
  const v: View = { id: uid('v_'), type, name: names[type], columnId }
  updateBoard(boardId, { views: [...b.views, v] })
  navigate({ page: 'board', boardId, viewId: v.id })
}

// ---------- items ----------
export function addItem(boardId: string, groupId: string, name: string, opts: { parentId?: string; values?: Record<string, CellValue>; top?: boolean } = {}) {
  const siblings = boardItems(boardId).filter((i) => i.groupId === groupId && i.parentId === opts.parentId)
  const order = opts.top ? (siblings[0]?.order ?? 1) - 1 : (siblings.at(-1)?.order ?? 0) + 1
  const item: Item = { id: uid('i_'), boardId, groupId, parentId: opts.parentId, name, values: opts.values ?? {}, order, createdAt: Date.now(), createdBy: get().meId }
  put('item', item)
  log(boardId, `created “${name}”`, item.id)
  runAutomations(item, { kind: 'item_created' })
  return item
}
export function renameItem(id: string, name: string) {
  const i = get().item[id]
  if (i && i.name !== name) put('item', { ...i, name })
}
export function setValue(itemId: string, colId: string, value: CellValue) {
  const item = get().item[itemId]
  if (!item) return
  const b = get().board[item.boardId]
  const col = b?.columns.find((c) => c.id === colId)
  const prev = item.values[colId]
  const next: Item = { ...item, values: { ...item.values, [colId]: value } }
  put('item', next)
  if (!col) return
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
export function deleteItems(ids: string[]) {
  const removed: Item[] = []
  for (const id of ids) {
    const i = get().item[id]
    if (!i) continue
    removed.push(i, ...Object.values(get().item).filter((s) => s.parentId === id))
  }
  removed.forEach((i) => remove('item', i.id))
  if (get().openItemId && ids.includes(get().openItemId!)) openItem(null)
  if (removed.length) toast(`Deleted ${ids.length} item${ids.length > 1 ? 's' : ''}`, { action: { label: 'Undo', onClick: () => removed.forEach((i) => put('item', i)) } })
}
export function duplicateItem(id: string) {
  const i = get().item[id]
  if (!i) return
  return addItem(i.boardId, i.groupId, i.name + ' (copy)', { parentId: i.parentId, values: structuredClone(i.values) })
}

// ---------- updates (comments) ----------
export function addUpdate(itemId: string, body: string) {
  const item = get().item[itemId]
  if (!item || !body.trim()) return
  put('update', { id: uid('up_'), itemId, boardId: item.boardId, authorId: get().meId, body, createdAt: Date.now(), likes: [] })
  log(item.boardId, `commented on “${item.name}”`, itemId)
  // notify mentioned teammates (@First) and everyone assigned
  const b = get().board[item.boardId]
  const assignees = new Set<string>()
  b.columns.filter((c) => c.type === 'people').forEach((c) => ((item.values[c.id] as string[]) ?? []).forEach((u) => assignees.add(u)))
  Object.values(get().user).forEach((u) => body.includes('@' + u.name.split(' ')[0]) && assignees.add(u.id))
  assignees.forEach((u) => notify(u, `wrote an update on “${item.name}”`, b.id, itemId))
}
export function toggleLike(updateId: string) {
  const u = get().update[updateId]
  const meId = get().meId
  if (u) put('update', { ...u, likes: u.likes.includes(meId) ? u.likes.filter((x) => x !== meId) : [...u.likes, meId] })
}

// ---------- automations ----------
type Event = { kind: 'item_created' } | { kind: 'status_changes'; columnId: string; labelId: string } | { kind: 'date_arrives'; columnId: string }
let depth = 0
function runAutomations(item: Item, ev: Event) {
  const b = get().board[item.boardId]
  if (!b || depth > 3) return // guard against automation loops
  depth++
  try {
    for (const a of b.automations.filter((x) => x.enabled)) {
      const t = a.trigger
      const hit =
        t.kind === ev.kind &&
        (t.kind !== 'status_changes' || (ev.kind === 'status_changes' && t.columnId === ev.columnId && t.labelId === ev.labelId)) &&
        (t.kind !== 'date_arrives' || (ev.kind === 'date_arrives' && t.columnId === ev.columnId))
      if (!hit) continue
      const cur = get().item[item.id]
      if (!cur) continue
      const act = a.action
      if (act.kind === 'move_to_group') moveItem(cur.id, act.groupId, Date.now())
      if (act.kind === 'set_status') setValue(cur.id, act.columnId, act.labelId)
      if (act.kind === 'assign') setValue(cur.id, act.columnId, [...new Set([...((cur.values[act.columnId] as string[]) ?? []), act.userId])])
      if (act.kind === 'set_date_today') setValue(cur.id, act.columnId, today())
      if (act.kind === 'notify') {
        const targets = act.userId
          ? [act.userId]
          : b.columns.filter((c) => c.type === 'people').flatMap((c) => (cur.values[c.id] as string[]) ?? [])
        targets.forEach((u) => notify(u, `automation: “${cur.name}” needs your attention`, b.id, cur.id))
      }
      log(b.id, `automation ran on “${cur.name}”`, cur.id)
    }
  } finally {
    depth--
  }
}
/** Fire "date arrives" automations once per item/day (checked on load + hourly). */
export function checkDateAutomations() {
  const t = today()
  const doneKey = 'tideline:date-auto:' + t
  const done = new Set<string>(JSON.parse(localStorage.getItem(doneKey) ?? '[]'))
  for (const b of Object.values(get().board)) {
    for (const a of b.automations) {
      if (!a.enabled || a.trigger.kind !== 'date_arrives') continue
      const colId = a.trigger.columnId
      for (const it of boardItems(b.id)) {
        const key = a.id + it.id
        if (it.values[colId] === t && !done.has(key)) {
          done.add(key)
          runAutomations(it, { kind: 'date_arrives', columnId: colId })
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

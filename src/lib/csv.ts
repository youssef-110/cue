import { isValid, parse, format } from 'date-fns'
import { COLOR_LIST, COLORS, uid } from './seed'
import { addTeammate, boardItems, labelOf, navigate, put, useStore } from './store'
import type { Board, Column, Item } from './types'

/** RFC 4180 parser: quotes, escaped quotes, newlines inside quotes. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const delim = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === delim) row.push(cell), (cell = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell), rows.push(row), (row = []), (cell = '')
    } else cell += c
  }
  if (cell || row.length) row.push(cell), rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim()))
}

// Prefix cells that spreadsheets would run as formulas (=, +, -, @, tab, CR).
const neutralize = (s: string) => (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" + s : s)
const esc = (raw: string) => {
  const s = neutralize(raw)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportBoardCSV(board: Board) {
  const users = useStore.getState().user
  const groups = new Map(board.groups.map((g) => [g.id, g.title]))
  const cellText = (c: Column, i: Item): string => {
    const v = i.values[c.id]
    if (v == null) return ''
    if (c.type === 'status' || c.type === 'priority') return labelOf(c, v)?.name ?? ''
    if (c.type === 'tags') return (v as string[]).map((id) => labelOf(c, id)?.name).filter(Boolean).join(', ')
    if (c.type === 'people') return (v as string[]).map((id) => users[id]?.name).filter(Boolean).join(', ')
    if (c.type === 'timeline') return `${(v as { start: string }).start} → ${(v as { end: string }).end}`
    return String(v)
  }
  const rows = [
    ['Item', 'Group', ...board.columns.map((c) => c.title)],
    ...boardItems(board.id)
      .filter((i) => !i.parentId)
      .map((i) => [i.name, groups.get(i.groupId) ?? '', ...board.columns.map((c) => cellText(c, i))]),
  ]
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${board.name.replace(/[^\w\- ]+/g, '')}.csv` })
  a.click()
  URL.revokeObjectURL(a.href)
}

const DATE_FORMATS = ['yyyy-MM-dd', 'yyyy-MM-dd HH:mm:ss', 'dd/MM/yyyy', 'MM/dd/yyyy', 'd.M.yyyy', 'MMM d, yyyy', 'd MMM yyyy']
function toISO(s: string): string | null {
  for (const f of DATE_FORMATS) {
    const d = parse(s.trim(), f, new Date())
    if (isValid(d) && d.getFullYear() > 1900) return format(d, 'yyyy-MM-dd')
  }
  return null
}
const EMPTY = /^(nan|nat|null|none|n\/a|-)?$/i

/** Build a new board from CSV text; infers column types from headers + values. */
export function importCSV(text: string, workspaceId: string, name: string) {
  const [header, ...body] = parseCSV(text)
  if (!header || !body.length) throw new Error('The file has no rows')
  const clean = (s = '') => (EMPTY.test(s.trim()) ? '' : s.trim())
  const nameIdx = 0
  const groupIdx = header.findIndex((h) => /^group$/i.test(h.trim()))
  const columns: (Column | null)[] = header.map((h, idx) => {
    if (idx === nameIdx || idx === groupIdx) return null
    const vals = body.map((r) => clean(r[idx])).filter(Boolean)
    const title = h.trim() || `Column ${idx + 1}`
    const distinct = [...new Set(vals)]
    if (/owner|person|people|assignee|collaborator|who/i.test(title) && vals.every((v) => v.length < 60)) return { id: uid('c_'), type: 'people', title }
    if (vals.length && vals.every((v) => toISO(v))) return { id: uid('c_'), type: 'date', title }
    if (vals.length && vals.every((v) => /^https?:\/\//.test(v))) return { id: uid('c_'), type: 'link', title }
    if (vals.length && vals.every((v) => /^-?[\d.,\s]+$/.test(v) && !isNaN(Number(v.replace(/[\s,]/g, ''))))) return { id: uid('c_'), type: 'number', title }
    if (/^(true|false|yes|no|x|✓)?$/i.test(distinct.join('')) && distinct.length && distinct.length <= 2 && distinct.every((v) => /^(true|false|yes|no|x|✓)$/i.test(v)))
      return { id: uid('c_'), type: 'checkbox', title }
    const statusy = /status|stage|state|priority|phase/i.test(title)
    if (distinct.length && (statusy || (distinct.length <= 8 && vals.length >= distinct.length * 2)) && distinct.every((v) => v.length < 40)) {
      const isPrio = /priority/i.test(title)
      return {
        id: uid('c_'),
        type: isPrio ? 'priority' : 'status',
        title,
        labels: distinct.map((n, i) => ({
          id: uid('l_'),
          name: n,
          color: /done|complete|paid|paying|won|published/i.test(n) ? COLORS.green : /block|stuck|lost/i.test(n) ? COLORS.red : /progress|working|review/i.test(n) ? COLORS.orange : /not started|todo|idea/i.test(n) ? COLORS.slate : COLOR_LIST[(i * 3 + 2) % COLOR_LIST.length],
          done: /done|complete|paying|won|published/i.test(n),
        })),
      }
    }
    return { id: uid('c_'), type: vals.some((v) => v.length > 80) ? 'longtext' : 'text', title, width: 200 }
  })

  const users = () => Object.values(useStore.getState().user)
  const personId = (n: string) => (users().find((u) => u.name.toLowerCase() === n.toLowerCase() || u.email?.toLowerCase() === n.toLowerCase()) ?? addTeammate(n)).id

  const groupNames = groupIdx >= 0 ? [...new Set(body.map((r) => clean(r[groupIdx]) || 'Imported'))] : ['Imported']
  const groups = groupNames.map((title, i) => ({ id: uid('g_'), title, color: COLOR_LIST[(i * 3 + 3) % COLOR_LIST.length] }))
  const cols = columns.filter((c): c is Column => !!c)
  const statusCol = cols.find((c) => c.type === 'status')
  const dateCol = cols.find((c) => c.type === 'date')
  const board: Board = {
    id: uid('b_'),
    workspaceId,
    name,
    icon: '📥',
    columns: cols,
    groups,
    views: [
      { id: uid('v_'), type: 'table', name: 'Main table' },
      { id: uid('v_'), type: 'kanban', name: 'Kanban', columnId: statusCol?.id },
      ...(dateCol ? [{ id: uid('v_'), type: 'calendar' as const, name: 'Calendar', columnId: dateCol.id }] : []),
      { id: uid('v_'), type: 'chart', name: 'Dashboard', columnId: statusCol?.id },
    ],
    automations: [],
    createdAt: Date.now(),
    order: Date.now(),
  }
  put('board', board)
  let n = 0
  body.forEach((r, ri) => {
    const itemName = clean(r[nameIdx])
    if (!itemName) return
    const values: Record<string, unknown> = {}
    columns.forEach((c, idx) => {
      const v = clean(r[idx])
      if (!c || !v) return
      if (c.type === 'people') values[c.id] = v.split(/[,;&]| and /).map((s) => s.trim()).filter(Boolean).map(personId)
      else if (c.type === 'date') values[c.id] = toISO(v)
      else if (c.type === 'number') values[c.id] = Number(v.replace(/[\s,]/g, ''))
      else if (c.type === 'checkbox') values[c.id] = /^(true|yes|x|✓)$/i.test(v)
      else if (c.type === 'status' || c.type === 'priority') values[c.id] = c.labels?.find((l) => l.name === v)?.id
      else values[c.id] = v
    })
    const g = groupIdx >= 0 ? groups[groupNames.indexOf(clean(r[groupIdx]) || 'Imported')] : groups[0]
    put('item', { id: uid('i_'), boardId: board.id, groupId: g.id, name: itemName, values, order: ri, createdAt: Date.now(), createdBy: useStore.getState().meId })
    n++
  })
  navigate({ page: 'board', boardId: board.id })
  return n
}

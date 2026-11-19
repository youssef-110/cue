import { useState } from 'react'
import { canEdit, updateBoard, useStore } from './store'
import type { Board, Column, FilterOp, FilterRule, Item, View, ViewFilter } from './types'

export const OP_LABEL: Record<FilterOp, string> = {
  is: 'is', is_not: 'is not', contains: 'contains', empty: 'is empty', not_empty: 'is not empty',
  before: 'is before', after: 'is after', gt: 'greater than', lt: 'less than',
}

type Kind = 'choice' | 'date' | 'number' | 'bool' | 'text'
export function filterKind(c?: Column): Kind {
  if (!c) return 'text'
  if (['status', 'priority', 'tags', 'people'].includes(c.type)) return 'choice'
  if (c.type === 'date' || c.type === 'timeline') return 'date'
  if (['number', 'rating', 'progress'].includes(c.type)) return 'number'
  if (c.type === 'checkbox') return 'bool'
  return 'text' // text-like and any other column type: compares its text form
}
const OPS: Record<Kind, FilterOp[]> = {
  choice: ['is', 'is_not', 'empty', 'not_empty'],
  date: ['is', 'before', 'after', 'empty', 'not_empty'],
  number: ['is', 'gt', 'lt', 'empty', 'not_empty'],
  bool: ['is'],
  text: ['contains', 'is', 'is_not', 'empty', 'not_empty'],
}
export const opsFor = (c?: Column) => OPS[filterKind(c)]
export const needsValue = (op: FilterOp) => op !== 'empty' && op !== 'not_empty'

const textOf = (v: unknown): string =>
  v == null ? '' : Array.isArray(v) ? v.map(textOf).join(', ') : typeof v === 'object' ? Object.values(v).map(textOf).join(' ') : String(v)

export function matchRule(board: Board, item: Item, r: FilterRule): boolean {
  const col = board.columns.find((c) => c.id === r.columnId)
  if (r.columnId !== 'name' && !col) return true // column was removed: ignore the rule
  const raw = r.columnId === 'name' ? item.name : item.values[col!.id]
  const k = r.columnId === 'name' ? 'text' : filterKind(col)
  const list = k === 'choice' ? (Array.isArray(raw) ? raw : raw == null || raw === '' ? [] : [raw]).map(String) : []
  const empty = k === 'choice' ? !list.length : k === 'bool' ? !raw : raw == null || raw === '' || (Array.isArray(raw) && !raw.length)
  if (r.op === 'empty') return empty
  if (r.op === 'not_empty') return !empty
  const val = r.value ?? ''
  switch (k) {
    case 'choice':
      return r.op === 'is_not' ? !list.includes(val) : list.includes(val)
    case 'bool':
      return !!raw === (val !== 'false')
    case 'number': {
      const n = Number(raw)
      if (empty || isNaN(n)) return false
      const x = Number(val)
      return r.op === 'gt' ? n > x : r.op === 'lt' ? n < x : n === x
    }
    case 'date': {
      const range = typeof raw === 'string' ? { start: raw, end: raw } : (raw as { start?: string; end?: string } | null)
      if (!range?.start) return false
      const end = range.end ?? range.start
      return r.op === 'before' ? range.start < val : r.op === 'after' ? end > val : range.start <= val && val <= end
    }
    default: {
      const t = textOf(raw).toLowerCase()
      const v = val.toLowerCase()
      return r.op === 'contains' ? t.includes(v) : r.op === 'is_not' ? t !== v : t === v
    }
  }
}

/** Rules missing a value don't filter anything yet. */
const complete = (r: FilterRule) => !needsValue(r.op) || (r.value ?? '') !== ''
export function matchFilter(board: Board, item: Item, f?: ViewFilter) {
  const rules = (f?.rules ?? []).filter(complete)
  if (!rules.length) return true
  return f!.mode === 'or' ? rules.some((r) => matchRule(board, item, r)) : rules.every((r) => matchRule(board, item, r))
}
export const activeRules = (f?: ViewFilter) => (f?.rules ?? []).filter(complete).length

export function updateView(boardId: string, viewId: string, patch: Partial<View>) {
  const b = useStore.getState().board[boardId]
  if (b) updateBoard(boardId, { views: b.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)) })
}

/**
 * A view setting (filter, group by, …). Editors persist it on the view for everyone;
 * viewers can't write boards, so their choice stays local to this page.
 */
export function useViewSetting<K extends keyof View>(board: Board, view: View, key: K): [View[K], (v: View[K]) => void] {
  const [local, setLocal] = useState<Record<string, View[K]>>({})
  const id = view.id + ':' + key
  const value = id in local ? local[id] : view[key]
  const set = (v: View[K]) => (canEdit() ? updateView(board.id, view.id, { [key]: v } as Partial<View>) : setLocal((l) => ({ ...l, [id]: v })))
  return [value, set]
}

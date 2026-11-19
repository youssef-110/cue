// Safe formula evaluator: tokenizer + recursive-descent parser that compiles to
// closures. No eval / new Function. Also resolves cell values for formulas,
// mirror columns and CSV export.
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import type { Board, Column, Item, User } from './types'

export type Val = number | string | boolean | null
type Resolve = (name: string) => Val
type Node = (r: Resolve) => Val

export class FormulaError extends Error {}
const fail = (m: string): never => {
  throw new FormulaError(m)
}

// ---------- coercion ----------
const isNum = (v: Val) => typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))
const num = (v: Val): number => (v == null || v === '' ? 0 : isNum(v) ? Number(v) : fail(`“${v}” is not a number`))
const str = (v: Val) => (v == null ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v))
const truthy = (v: Val) => !(v == null || v === '' || v === 0 || v === false)
const order = (a: Val, b: Val) => (isNum(a) && isNum(b) ? num(a) - num(b) : str(a).localeCompare(str(b), undefined, { sensitivity: 'base' }))
const date = (v: Val) => {
  const d = typeof v === 'string' ? parseISO(v) : new Date(NaN)
  return isValid(d) ? d : fail(`“${str(v)}” is not a date`)
}

// ---------- tokenizer ----------
type Tok = { t: 'num' | 'str' | 'ref' | 'id' | 'op'; v: string }
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\{([^}]*)\}|([A-Za-z_]\w*)|(<=|>=|<>|!=|==|[-+*/(),=<>&]))/y

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < src.length) {
    const at = TOKEN.lastIndex
    const m = TOKEN.exec(src)
    if (!m) {
      if (!src.slice(at).trim()) break
      fail(`Unexpected “${src.slice(at).trim()[0]}”`)
    }
    const [, n, s1, s2, ref, id, op] = m!
    if (n != null) out.push({ t: 'num', v: n })
    else if (s1 != null || s2 != null) out.push({ t: 'str', v: (s1 ?? s2).replace(/\\(.)/g, '$1') })
    else if (ref != null) out.push({ t: 'ref', v: ref.trim() })
    else if (id != null) out.push({ t: 'id', v: id })
    else if (op != null) out.push({ t: 'op', v: op })
    else break // trailing whitespace only
  }
  return out
}

// ---------- functions ----------
const all = (a: Node[], r: Resolve) => a.map((n) => n(r))
const nums = (a: Node[], r: Resolve) => all(a, r).filter((v) => v != null && v !== '').map(num)
const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
const FNS: Record<string, [min: number, max: number, fn: (a: Node[], r: Resolve) => Val]> = {
  IF: [2, 3, (a, r) => (truthy(a[0](r)) ? a[1](r) : (a[2]?.(r) ?? null))], // lazy: only the chosen branch runs
  SUM: [0, 99, (a, r) => sum(nums(a, r))],
  AVG: [1, 99, (a, r) => ((xs) => (xs.length ? sum(xs) / xs.length : null))(nums(a, r))],
  MIN: [1, 99, (a, r) => ((xs) => (xs.length ? Math.min(...xs) : null))(nums(a, r))],
  MAX: [1, 99, (a, r) => ((xs) => (xs.length ? Math.max(...xs) : null))(nums(a, r))],
  ROUND: [1, 2, (a, r) => ((f) => Math.round(num(a[0](r)) * f) / f)(10 ** (a[1] ? num(a[1](r)) : 0))],
  ABS: [1, 1, (a, r) => Math.abs(num(a[0](r)))],
  CONCAT: [0, 99, (a, r) => all(a, r).map(str).join('')],
  LEN: [1, 1, (a, r) => str(a[0](r)).length],
  UPPER: [1, 1, (a, r) => str(a[0](r)).toUpperCase()],
  LOWER: [1, 1, (a, r) => str(a[0](r)).toLowerCase()],
  DAYS: [2, 2, (a, r) => ((x, y) => (x == null || x === '' || y == null || y === '' ? null : differenceInCalendarDays(date(x), date(y))))(a[0](r), a[1](r))],
  TODAY: [0, 0, () => format(new Date(), 'yyyy-MM-dd')],
  NOW: [0, 0, () => new Date().toISOString()],
}

const BIN: Record<string, (a: Val, b: Val) => Val> = {
  '+': (a, b) => (typeof a === 'string' || typeof b === 'string' ? str(a) + str(b) : num(a) + num(b)),
  '-': (a, b) => num(a) - num(b),
  '&': (a, b) => str(a) + str(b),
  '*': (a, b) => num(a) * num(b),
  '/': (a, b) => (num(b) === 0 ? fail('Division by zero') : num(a) / num(b)),
  '=': (a, b) => order(a, b) === 0,
  '==': (a, b) => order(a, b) === 0,
  '!=': (a, b) => order(a, b) !== 0,
  '<>': (a, b) => order(a, b) !== 0,
  '<': (a, b) => order(a, b) < 0,
  '>': (a, b) => order(a, b) > 0,
  '<=': (a, b) => order(a, b) <= 0,
  '>=': (a, b) => order(a, b) >= 0,
}

// ---------- parser ----------
// cmp := add (('='|'!='|'<>'|'<'|'>'|'<='|'>=') add)*
// add := mul (('+'|'-'|'&') mul)*      mul := unary (('*'|'/') unary)*
// unary := ('-'|'+') unary | primary
// primary := number | "string" | {Column} | TRUE | FALSE | NAME '(' args ')' | '(' cmp ')'
function parse(src: string): Node {
  const toks = tokenize(src)
  let p = 0
  const isOp = (v: string) => toks[p]?.t === 'op' && toks[p].v === v
  const eat = (v: string) => (isOp(v) ? (p++, true) : false)
  const expect = (v: string) => eat(v) || fail(`Expected “${v}”`)
  const binary = (ops: string[], next: () => Node) => (): Node => {
    let l = next()
    while (toks[p]?.t === 'op' && ops.includes(toks[p].v)) {
      const f = BIN[toks[p++].v]
      const a = l
      const b = next()
      l = (r) => f(a(r), b(r))
    }
    return l
  }
  const unary = (): Node => {
    if (eat('-')) {
      const n = unary()
      return (r) => -num(n(r))
    }
    if (eat('+')) return unary()
    return primary()
  }
  const mul = binary(['*', '/'], unary)
  const add = binary(['+', '-', '&'], mul)
  const cmp = binary(['=', '==', '!=', '<>', '<', '>', '<=', '>='], add)
  function primary(): Node {
    const t = toks[p++]
    if (!t) return fail('Unexpected end of formula')
    if (t.t === 'num') return () => Number(t.v)
    if (t.t === 'str') return () => t.v
    if (t.t === 'ref') return (r) => r(t.v)
    if (t.t === 'id') {
      const name = t.v.toUpperCase()
      if (name === 'TRUE' || name === 'FALSE') return () => name === 'TRUE'
      const spec = FNS[name] ?? fail(`Unknown function ${t.v}`)
      expect('(')
      const args: Node[] = []
      if (!eat(')')) {
        do args.push(cmp())
        while (eat(','))
        expect(')')
      }
      if (args.length < spec[0] || args.length > spec[1]) fail(`${name} takes ${spec[0] === spec[1] ? spec[0] : `${spec[0]}–${spec[1]}`} argument(s)`)
      return (r) => spec[2](args, r)
    }
    if (t.v === '(') {
      const n = cmp()
      expect(')')
      return n
    }
    return fail(`Unexpected “${t.v}”`)
  }
  const root = cmp()
  if (p < toks.length) fail(`Unexpected “${toks[p].v}”`)
  return root
}

const cache = new Map<string, Node>()
/** Evaluate a formula. Throws FormulaError on syntax or runtime errors. Empty formula = null. */
export function evaluate(src: string, resolve: Resolve): Val {
  if (!src.trim()) return null
  let node = cache.get(src)
  if (!node) cache.set(src, (node = parse(src)))
  const v = node(resolve)
  return typeof v === 'number' && !isFinite(v) ? fail('Not a finite number') : v
}

export const fmtVal = (v: Val) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : str(v))

// ---------- cell values (formula refs, mirror, CSV) ----------
export interface Ctx {
  users: Record<string, User>
  items: Record<string, Item>
  boards: Record<string, Board>
}
export type TimeVal = { total: number; runningSince?: number }
export const timeTotal = (v: unknown) => {
  const t = v as TimeVal | undefined
  return t ? (t.total ?? 0) + (t.runningSince ? Date.now() - t.runningSince : 0) : 0
}
export const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}
export const shortId = (item: Item) => item.id.slice(-6).toUpperCase()

/** Items reached through a connect column (or a dependency column) of `item`. */
export const linkedItems = (col: Column, item: Item, ctx: Ctx) => ((item.values[col.id] as string[] | undefined) ?? []).map((id) => ctx.items[id]).filter(Boolean)

/** Mirror column: the target board/column plus the linked items whose values it shows. */
export function mirrorSource(board: Board, col: Column, item: Item, ctx: Ctx) {
  const via = board.columns.find((c) => c.id === col.connectColumnId && c.type === 'connect')
  const target = via?.boardId ? ctx.boards[via.boardId] : undefined
  const tcol = target?.columns.find((c) => c.id === col.mirrorColumnId)
  return { via, target, tcol, items: via && tcol ? linkedItems(via, item, ctx) : [] }
}

/** Scalar value of a cell as formulas see it (labels -> names, people -> names, time -> hours). */
export function cellScalar(board: Board, col: Column, item: Item, ctx: Ctx, depth = 0): Val {
  if (depth > 8) fail('Circular reference')
  const v = item.values[col.id]
  const names = (ids: unknown, map: (id: string) => string | undefined) => ((ids as string[] | undefined) ?? []).map(map).filter(Boolean).join(', ') || null
  switch (col.type) {
    case 'status':
    case 'priority':
      return col.labels?.find((l) => l.id === v)?.name ?? null
    case 'tags':
      return names(v, (id) => col.labels?.find((l) => l.id === id)?.name)
    case 'people':
      return names(v, (id) => ctx.users[id]?.name)
    case 'dependency':
    case 'connect':
      return names(v, (id) => ctx.items[id]?.name)
    case 'files':
      return ((v as { name: string }[] | undefined) ?? []).map((f) => f.name).join(', ') || null
    case 'vote':
      return ((v as string[] | undefined) ?? []).length
    case 'timeline':
      return v ? `${(v as { start: string }).start} → ${(v as { end: string }).end}` : null
    case 'time':
      return Math.round((timeTotal(v) / 36e5) * 100) / 100
    case 'checkbox':
      return !!v
    case 'created':
      return format(item.createdAt, 'yyyy-MM-dd')
    case 'updated':
      return format(item.updatedAt ?? item.createdAt, 'yyyy-MM-dd')
    case 'itemId':
      return shortId(item)
    case 'formula':
      return evaluate(col.formula ?? '', (name) => {
        const ref = board.columns.find((c) => c.title.toLowerCase() === name.toLowerCase())
        if (ref) return cellScalar(board, ref, item, ctx, depth + 1)
        return /^(name|item)$/i.test(name) ? item.name : fail(`Unknown column {${name}}`)
      })
    case 'mirror': {
      const m = mirrorSource(board, col, item, ctx)
      return m.items.map((it) => str(cellScalar(m.target!, m.tcol!, it, ctx, depth + 1))).filter(Boolean).join(', ') || null
    }
    default:
      return v == null || v === '' ? null : typeof v === 'number' ? v : String(v)
  }
}

// ---------- self-check (dev only) ----------
export function selfTest() {
  const vars: Record<string, Val> = { Hours: 4, Rate: 25, Status: 'Done', Deadline: '2030-01-10', Name: 'abc', Empty: null }
  const r: Resolve = (n) => (n in vars ? vars[n] : fail(`Unknown column {${n}}`))
  const ok: [string, Val][] = [
    ['{Hours} * {Rate}', 100],
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['IF({Status} = "Done", 1, 0)', 1],
    ['IF({Status} != "done", 1, 0)', 0],
    ['SUM(1, 2, {Hours})', 7],
    ['AVG(2, 4) + MIN(3, 1) + MAX(1, 5)', 9],
    ['ROUND(10 / 3, 2)', 3.33],
    ['CONCAT("a", {Name}, 1)', 'aabc1'],
    ["UPPER({Name}) & LEN('xy')", 'ABC2'],
    ['DAYS({Deadline}, "2030-01-01")', 9],
    ['-{Hours} + ABS(-2)', -2],
    ['MAX(1, 5, 3) >= 5', true],
    ['IF(0, 1 / 0, 2)', 2],
    ['{Empty} + 1', 1],
    ['DAYS({Empty}, TODAY())', null],
  ]
  for (const [src, want] of ok) {
    const got = evaluate(src, r)
    if (got !== want) throw new Error(`formula selfTest: ${src} = ${String(got)}, expected ${String(want)}`)
  }
  for (const bad of ['1 / 0', '{Nope}', 'FOO(1)', '1 +', 'IF(1, 2', 'ROUND()', '2 # 3']) {
    let threw = false
    try {
      evaluate(bad, r)
    } catch (e) {
      threw = e instanceof FormulaError
    }
    if (!threw) throw new Error(`formula selfTest: expected FormulaError for ${bad}`)
  }
}
if (import.meta.env?.DEV) selfTest()

// Tiny markdown parser for docs. It returns a plain tree that React renders as
// elements, so text is always escaped and no HTML from the doc ever reaches the page.
// Supports: # headings (1-3), **bold**, *italic* / _italic_, `code`, ``` blocks,
// [links](https://…) (http/https only), - / 1. lists and - [ ] checklists.

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'b'; c: Inline[] }
  | { t: 'i'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }
export type ListItem = { c: Inline[]; check?: boolean; line: number }
export type Block =
  | { t: 'h'; level: number; c: Inline[] }
  | { t: 'p'; lines: Inline[][] }
  | { t: 'ul' | 'ol'; items: ListItem[] }
  | { t: 'code'; v: string }

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|(?<!\w)_([^_]+)_(?!\w)/g
export const safeHref = (url: string) => /^https?:\/\/[^\s]+$/i.test(url)

export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) })
    if (m[1] != null) out.push({ t: 'code', v: m[1] })
    else if (m[2] != null) out.push({ t: 'b', c: parseInline(m[2]) })
    else if (m[3] != null) out.push(safeHref(m[4]) ? { t: 'link', href: m[4], c: parseInline(m[3]) } : { t: 'text', v: m[0] })
    else out.push({ t: 'i', c: parseInline(m[5] ?? m[6]) })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) })
  return out
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out: Block[] = []
  let para: Inline[][] | null = null
  let list: { t: 'ul' | 'ol'; items: ListItem[] } | null = null
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^\s*```/.test(l)) {
      const code: string[] = []
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i])
      out.push({ t: 'code', v: code.join('\n') })
      para = list = null
      continue
    }
    if (!l.trim()) {
      para = list = null
      continue
    }
    const h = l.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      out.push({ t: 'h', level: h[1].length, c: parseInline(h[2]) })
      para = list = null
      continue
    }
    const check = l.match(/^\s*[-*+]\s+\[([ xX])\]\s?(.*)$/)
    const bullet = check ? null : l.match(/^\s*[-*+]\s+(.*)$/)
    const num = check || bullet ? null : l.match(/^\s*\d+[.)]\s+(.*)$/)
    if (check || bullet || num) {
      const t = num ? 'ol' : 'ul'
      if (!list || list.t !== t) {
        list = { t, items: [] }
        out.push(list)
        para = null
      }
      list.items.push(check ? { c: parseInline(check[2]), check: check[1] !== ' ', line: i } : { c: parseInline((bullet ?? num)![1]), line: i })
      continue
    }
    list = null
    if (!para) {
      para = []
      out.push({ t: 'p', lines: para })
    }
    para.push(parseInline(l.trim()))
  }
  return out
}

/** Flips the checklist box on one source line. */
export const toggleCheck = (src: string, line: number) =>
  src
    .split('\n')
    .map((l, i) => (i === line ? l.replace(/\[([ xX])\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]')) : l))
    .join('\n')

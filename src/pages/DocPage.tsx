import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { createDoc, deleteDoc, navigate, updateDoc, useCanEdit, useStore } from '../lib/store'
import { parseMarkdown, toggleCheck, type Inline } from '../lib/markdown'
import type { Board, Doc } from '../lib/types'
import { Button, cx } from '../components/ui'

/** Standalone workspace doc at #/doc/<id>. */
export function DocPage({ id }: { id: string }) {
  const doc = useStore((s) => s.doc[id])
  const ws = useStore((s) => (doc ? s.workspace[doc.workspaceId] : undefined))
  const editable = useCanEdit()
  if (!doc)
    return (
      <div className="grid flex-1 place-items-center text-center">
        <div>
          <p className="caps text-[22px] font-bold">This doc doesn’t exist anymore</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate({ page: 'home' })}>Go home</Button>
        </div>
      </div>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="caps flex items-center gap-2 px-6 pt-5 text-[12px] font-semibold tracking-[0.12em] text-faint">
        <FileText className="size-3.5" /> {ws?.name ?? 'Workspace'} <span aria-hidden>/</span> Docs
        {editable && (
          <button
            className="ml-auto flex h-8 items-center gap-1.5 rounded-md px-3 font-sans text-[13px] font-medium normal-case tracking-normal text-alert transition-colors hover:bg-alert-soft"
            onClick={() => (deleteDoc(doc.id), navigate({ page: 'home' }))}
          >
            <Trash2 className="size-4" /> Delete doc
          </button>
        )}
      </div>
      <DocEditor key={doc.id} doc={doc} />
    </div>
  )
}

/** The "Doc" tab of a board: one doc attached to the board, created on first use. */
export function BoardDoc({ board }: { board: Board }) {
  const doc = useStore((s) => Object.values(s.doc).find((d) => d.boardId === board.id))
  const editable = useCanEdit()
  if (!doc)
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div className="max-w-sm">
          <FileText className="mx-auto mb-3 size-8 text-faint" />
          <p className="caps text-[19px] font-bold">No doc for this board yet</p>
          <p className="mt-1 text-[13px] text-muted">Keep the brief, notes and decisions next to the work.</p>
          {editable && (
            <Button variant="primary" className="mt-4" onClick={() => createDoc(board.workspaceId, board.id, `${board.name} doc`)}>
              <Plus /> Create doc
            </Button>
          )}
        </div>
      </div>
    )
  return <DocEditor key={doc.id} doc={doc} />
}

function DocEditor({ doc }: { doc: Doc }) {
  const editable = useCanEdit()
  const users = useStore((s) => s.user)
  const [body, setBody] = useState(doc.body)
  const pending = useRef<number | undefined>(undefined)
  const latest = useRef(body)
  // take remote edits unless we have unsaved typing
  useEffect(() => {
    if (pending.current === undefined) setBody(doc.body)
  }, [doc.body])
  // flush unsaved typing when leaving
  useEffect(
    () => () => {
      if (pending.current !== undefined) (clearTimeout(pending.current), updateDoc(doc.id, { body: latest.current }))
    },
    [doc.id],
  )
  const change = (v: string) => {
    setBody(v)
    latest.current = v
    clearTimeout(pending.current)
    pending.current = window.setTimeout(() => ((pending.current = undefined), updateDoc(doc.id, { body: v })), 500)
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-3">
      <input
        aria-label="Doc title"
        readOnly={!editable}
        defaultValue={doc.title}
        key={doc.id + doc.title}
        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== doc.title && updateDoc(doc.id, { title: e.target.value.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="caps -mx-1 rounded-sm bg-transparent px-1 text-[32px] font-bold leading-tight outline-none focus:ring-1 focus:ring-accent"
      />
      <p className="mb-4 text-[12.5px] text-faint">
        Edited {formatDistanceToNow(doc.updatedAt, { addSuffix: true })}
        {users[doc.createdBy] ? ` · created by ${users[doc.createdBy].name}` : ''}
      </p>
      <div className={cx('grid min-h-0 flex-1 gap-4', editable && 'lg:grid-cols-2')}>
        {editable && (
          <textarea
            aria-label="Doc body (markdown)"
            value={body}
            onChange={(e) => change(e.target.value)}
            placeholder={'# Heading\n\nWrite with **markdown**. Lists, - [ ] checklists, `code` and [links](https://…) work.'}
            className="min-h-[320px] resize-none rounded-md border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent"
          />
        )}
        <div className="min-h-[320px] overflow-y-auto rounded-md border border-line bg-panel px-6 py-5">
          {body.trim() ? <Markdown text={body} onToggle={editable ? (line) => change(toggleCheck(body, line)) : undefined} /> : <p className="text-[13px] text-faint">Nothing written yet.</p>}
        </div>
      </div>
    </div>
  )
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((n, i): ReactNode => {
    if (n.t === 'text') return <Fragment key={i}>{n.v}</Fragment>
    if (n.t === 'code') return <code key={i} className="rounded-sm bg-panel-2 px-1 py-px font-mono text-[0.88em]">{n.v}</code>
    if (n.t === 'b' || n.t === 'i') {
      const Tag = n.t === 'b' ? 'strong' : 'em'
      return <Tag key={i}><Inlines nodes={n.c} /></Tag>
    }
    return (
      <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
        <Inlines nodes={n.c} />
      </a>
    )
  })
}

/** Renders markdown as React elements (all text escaped by React). */
export function Markdown({ text, onToggle }: { text: string; onToggle?: (line: number) => void }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className="max-w-[72ch] space-y-3 font-sans text-[14.5px] leading-relaxed">
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          const cls =
            b.level === 1
              ? 'caps border-b-2 border-fg pb-1 pt-3 text-[26px] font-bold leading-tight first:pt-0'
              : b.level === 2
                ? 'caps pt-3 text-[19px] font-bold leading-tight tracking-[0.08em] first:pt-0'
                : 'pt-2 text-[15px] font-semibold first:pt-0'
          const H = (['h1', 'h2', 'h3'] as const)[b.level - 1]
          return <H key={i} className={cls}><Inlines nodes={b.c} /></H>
        }
        if (b.t === 'code') return <pre key={i} className="overflow-x-auto rounded-md border border-line bg-panel-2 p-3 font-mono text-[12.5px] leading-normal"><code>{b.v}</code></pre>
        if (b.t === 'p')
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Inlines nodes={l} />
                </Fragment>
              ))}
            </p>
          )
        const List = b.t
        return (
          <List key={i} className={cx('space-y-1 pl-5', List === 'ol' ? 'list-decimal' : 'list-disc')}>
            {b.items.map((it) =>
              it.check === undefined ? (
                <li key={it.line}><Inlines nodes={it.c} /></li>
              ) : (
                <li key={it.line} className="-ml-5 flex list-none items-start gap-2">
                  <input type="checkbox" checked={it.check} disabled={!onToggle} onChange={() => onToggle?.(it.line)} className="mt-1 size-3.5 accent-[var(--accent)]" aria-label="Toggle checklist item" />
                  <span className={cx(it.check && 'text-muted line-through')}><Inlines nodes={it.c} /></span>
                </li>
              ),
            )}
          </List>
        )
      })}
    </div>
  )
}

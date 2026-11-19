import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Archive, RotateCcw, Table2, Trash2 } from 'lucide-react'
import {
  deleteBoardForever,
  deleteGroupForever,
  deleteItemsForever,
  emptyTrash,
  isLive,
  openItem,
  restoreBoard,
  restoreGroup,
  restoreItems,
  useCanEdit,
  useStore,
} from '../lib/store'
import { Button, cx } from '../components/ui'

type Row = { key: string; icon: React.ReactNode; name: string; where: string; at: number; restore: () => void; purge: () => void; open?: () => void }
const DAY = 864e5
const swatch = (color?: string) => <span aria-hidden className="size-2.5 rounded-[1px]" style={{ background: color ?? 'var(--faint)' }} />

/** Lists archived and trashed boards, groups and items with Restore / Delete forever. */
export function ArchivePage() {
  const boards = useStore((s) => s.board)
  const items = useStore((s) => s.item)
  const editable = useCanEdit()
  const [tab, setTab] = useState<'archive' | 'trash'>('archive')

  const rows = useMemo(() => {
    const flagged = (x: { archived?: boolean; deletedAt?: number } | undefined) => !!x && (tab === 'trash' ? !!x.deletedAt : !!x.archived && !x.deletedAt)
    const when = (x: { archivedAt?: number; deletedAt?: number }) => (tab === 'trash' ? x.deletedAt : x.archivedAt) ?? 0
    const out: Row[] = []
    for (const b of Object.values(boards)) {
      if (flagged(b))
        out.push({ key: b.id, icon: <Table2 className="size-4 text-muted" />, name: b.name, where: 'Board', at: when(b), restore: () => restoreBoard(b.id), purge: () => deleteBoardForever(b.id) })
      if (b.deletedAt || b.archived) continue // its groups and items come back with the board
      for (const g of b.groups)
        if (flagged(g))
          out.push({ key: g.id, icon: swatch(g.color), name: g.title, where: `Group in ${b.name}`, at: when(g), restore: () => restoreGroup(b.id, g.id), purge: () => deleteGroupForever(b.id, g.id) })
    }
    for (const i of Object.values(items)) {
      const b = boards[i.boardId]
      const g = b?.groups.find((x) => x.id === i.groupId)
      // subitems and items inside a flagged board / group travel with their parent
      if (!flagged(i) || !isLive(b) || (g && !isLive(g)) || (i.parentId && !isLive(items[i.parentId]))) continue
      out.push({
        key: i.id,
        icon: swatch(g?.color),
        name: i.name,
        where: `${b.name}${g ? ' / ' + g.title : ''}`,
        at: when(i),
        restore: () => restoreItems([i.id]),
        purge: () => deleteItemsForever([i.id]),
        open: () => openItem(i.id),
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [boards, items, tab])

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="caps text-[34px] font-bold leading-none">Archive &amp; Trash</h1>
            <p className="mt-2 text-[14px] text-muted">Archived work is hidden but kept. Trash is emptied automatically after 30 days.</p>
          </div>
          {tab === 'trash' && editable && rows.length > 0 && <ConfirmButton label="Empty trash" onConfirm={() => emptyTrash()} />}
        </div>
        <div role="tablist" className="mb-4 flex gap-1 border-b border-line">
          {(['archive', 'trash'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx('caps -mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-[14px] font-semibold tracking-[0.1em]', tab === t ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg')}
            >
              {t === 'archive' ? <Archive className="size-4" /> : <Trash2 className="size-4" />}
              {t === 'archive' ? 'Archive' : 'Trash'}
            </button>
          ))}
        </div>
        <ul className="rounded-lg border border-line bg-panel">
          {rows.map((r) => {
            const left = Math.max(0, 30 - Math.floor((Date.now() - r.at) / DAY))
            return (
              <li key={r.key} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[14px] last:border-b-0">
                <span className="grid w-5 place-items-center">{r.icon}</span>
                <button disabled={!r.open} onClick={r.open} className="min-w-0 flex-1 text-left enabled:hover:text-accent">
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block truncate text-[12.5px] text-faint">
                    {r.where} · {tab === 'trash' ? 'deleted' : 'archived'} {r.at ? formatDistanceToNow(r.at, { addSuffix: true }) : ''}
                  </span>
                </button>
                {tab === 'trash' && (
                  <span className={cx('shrink-0 font-mono text-[12px] tabular-nums', left <= 3 ? 'text-alert' : 'text-muted')}>
                    {left}D LEFT
                  </span>
                )}
                {editable && (
                  <>
                    <Button variant="ghost" onClick={r.restore}>
                      <RotateCcw /> Restore
                    </Button>
                    <ConfirmButton label="Delete forever" onConfirm={r.purge} />
                  </>
                )}
              </li>
            )
          })}
          {!rows.length && <li className="px-6 py-10 text-[14px] text-muted">{tab === 'trash' ? 'Trash is empty.' : 'Nothing archived.'}</li>}
        </ul>
      </div>
    </div>
  )
}

/** Irreversible action: the first click arms it, a second click within 4s runs it. */
function ConfirmButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      className={cx('flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors', armed ? 'bg-alert text-white' : 'text-alert hover:bg-alert-soft')}
    >
      <Trash2 className="size-4" /> {armed ? 'Click to confirm' : label}
    </button>
  )
}

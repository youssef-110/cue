import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { TEMPLATES } from '../lib/seed'
import { createBoardFromTemplate } from '../lib/store'
import { Button, cx } from './ui'

const dialogField =
  'h-10 w-full rounded-md border border-line bg-panel px-3 text-[14px] text-fg outline-none placeholder:text-faint focus:border-accent focus:ring-1 focus:ring-accent'

export function Modal({ open, onClose, children, width = 640, title }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; title?: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
          <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative max-h-[86vh] w-full overflow-auto rounded-lg border border-line-strong bg-panel shadow-pop"
            style={{ maxWidth: width }}
          >
            {title && (
              <div className="sticky top-0 z-10 flex items-center border-b-2 border-fg bg-panel py-3 pl-6 pr-4">
                <h2 className="caps text-[22px] font-bold leading-none">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg">
                  <X className="size-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function TemplateModal({ workspaceId, onClose }: { workspaceId: string | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [pick, setPick] = useState('blank')
  return (
    <Modal open={!!workspaceId} onClose={onClose} title="Create a board" width={640}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          createBoardFromTemplate(pick, workspaceId!, name.trim() || undefined)
          setName('')
          onClose()
        }}
      >
        <label className="mb-5 block">
          <span className="caps mb-1.5 block text-[12px] font-semibold tracking-[0.12em] text-muted">Board name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Uses the template name if empty" aria-label="Board name" className={dialogField} />
        </label>
        <p id="tpl-label" className="caps mb-1.5 text-[12px] font-semibold tracking-[0.12em] text-muted">
          Start from
        </p>
        <div role="radiogroup" aria-labelledby="tpl-label" className="rounded-lg border border-line">
          {TEMPLATES.map((t) => {
            const on = pick === t.id
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={t.id}
                onClick={() => setPick(t.id)}
                className={cx(
                  'flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg last:border-b-0',
                  on ? 'bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent)]' : 'hover:bg-hover',
                )}
              >
                <span className={cx('mt-0.5 grid size-4 shrink-0 place-items-center rounded-sm border', on ? 'border-accent bg-accent text-panel' : 'border-line-strong')}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{t.name}</span>
                  <span className="text-[13px] text-muted">{t.description}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="h-9" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" className="h-9 px-4">
            Create board
          </Button>
        </div>
      </form>
    </Modal>
  )
}

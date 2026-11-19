import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { TEMPLATES } from '../lib/seed'
import { createBoardFromTemplate } from '../lib/store'
import { cx } from './ui'

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
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-[#0b0d1a]/40 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative max-h-[86vh] w-full overflow-auto rounded-2xl border border-line bg-panel shadow-pop"
            style={{ maxWidth: width }}
          >
            {title && (
              <div className="sticky top-0 z-10 flex items-center border-b border-line bg-panel/95 px-6 py-4 backdrop-blur">
                <h2 className="font-display text-[19px] font-semibold tracking-tight">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-hover">
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
    <Modal open={!!workspaceId} onClose={onClose} title="Create a board" width={720}>
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault()
          createBoardFromTemplate(pick, workspaceId!, name.trim() || undefined)
          setName('')
          onClose()
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Board name"
          aria-label="Board name"
          className="mb-5 h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t, i) => (
            <motion.button
              type="button"
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setPick(t.id)}
              className={cx(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-card',
                pick === t.id ? 'border-accent bg-accent-soft ring-4 ring-accent/10' : 'border-line',
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel-2 text-[20px]">{t.icon}</span>
              <span>
                <span className="block text-[14px] font-medium">{t.name}</span>
                <span className="text-[12.5px] text-muted">{t.description}</span>
              </span>
            </motion.button>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-[13.5px] text-muted hover:bg-hover">
            Cancel
          </button>
          <button className="h-10 rounded-xl bg-accent px-5 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-8px_var(--accent)] hover:brightness-110">Create board</button>
        </div>
      </form>
    </Modal>
  )
}

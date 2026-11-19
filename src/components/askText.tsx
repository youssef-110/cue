import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Modal } from './TemplateModal'

/** Styled replacement for window.prompt(). Resolves null on cancel. */
export function askText(title: string, initial = '', cta = 'Save'): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    const done = (v: string | null) => {
      resolve(v?.trim() || null)
      root.render(<Dialog open={false} />)
      setTimeout(() => (root.unmount(), host.remove()), 300)
    }
    function Dialog({ open }: { open: boolean }) {
      const [v, setV] = useState(initial)
      return (
        <Modal open={open} onClose={() => done(null)} title={title} width={420}>
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault()
              done(v)
            }}
          >
            <input
              autoFocus
              aria-label={title}
              value={v}
              onChange={(e) => setV(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="h-11 w-full rounded-xl border border-line bg-panel px-3.5 text-[15px] outline-none focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => done(null)} className="h-10 rounded-xl px-4 text-[13.5px] text-muted hover:bg-hover">
                Cancel
              </button>
              <button disabled={!v.trim()} className="h-10 rounded-xl bg-accent px-5 text-[13.5px] font-medium text-white hover:brightness-110 disabled:opacity-50">
                {cta}
              </button>
            </div>
          </form>
        </Modal>
      )
    }
    root.render(<Dialog open />)
  })
}

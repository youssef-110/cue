import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Modal } from './TemplateModal'
import { Button } from './ui'

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
        <Modal open={open} onClose={() => done(null)} title={title} width={440}>
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
              className="h-10 w-full rounded-md border border-line bg-panel px-3 text-[14px] text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" className="h-9" onClick={() => done(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="h-9 px-4" disabled={!v.trim()}>
                {cta}
              </Button>
            </div>
          </form>
        </Modal>
      )
    }
    root.render(<Dialog open />)
  })
}

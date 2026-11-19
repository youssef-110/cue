import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Toaster, toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { checkDateAutomations, init, openItem, setPalette, setTheme, useStore } from './lib/store'
import { cloudAdapter, localAdapter, supabase } from './lib/sync'
import { Sidebar } from './components/Sidebar'
import { ItemPanel } from './components/ItemPanel'
import { CommandPalette } from './components/CommandPalette'
import { Onboarding, SignIn, Splash } from './pages/Auth'
import { BoardPage } from './pages/BoardPage'
import { MyWork } from './pages/MyWork'
import { Inbox } from './pages/Inbox'
import { Home } from './pages/Home'

const LOCAL_ME = 'tideline:me'

export default function App() {
  const { ready, theme, meId, route } = useStore(useShallow((s) => ({ ready: s.ready, theme: s.theme, meId: s.meId, route: s.route })))
  const hasProfile = useStore((s) => !!s.user[s.meId])
  const [session, setSession] = useState<'loading' | 'out' | 'in'>(supabase ? 'loading' : 'in')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // connect storage
  useEffect(() => {
    if (!supabase) {
      init(localAdapter(), localStorage.getItem(LOCAL_ME) ?? '')
      return
    }
    const sb = supabase
    sb.auth.getSession().then(({ data }) => setSession(data.session ? 'in' : 'out'))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s ? 'in' : 'out'))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || session !== 'in' || useStore.getState().ready) return
    supabase.auth.getUser().then(({ data }) =>
      init(cloudAdapter(supabase!), data.user!.id).catch((e) => toast.error('Could not load your team data: ' + e.message)),
    )
  }, [session])

  useEffect(() => {
    if (!ready) return
    checkDateAutomations()
    const t = setInterval(checkDateAutomations, 60 * 60 * 1000)
    const onErr = (e: Event) => toast.error('Sync problem: ' + (e as CustomEvent).detail)
    addEventListener('tideline:sync-error', onErr)
    return () => (clearInterval(t), removeEventListener('tideline:sync-error', onErr))
  }, [ready])

  // global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(!useStore.getState().paletteOpen)
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') openItem(null)
      if (e.key.toLowerCase() === 'd') setTheme(useStore.getState().theme === 'dark' ? 'light' : 'dark')
      if (e.key === '/') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-board-search]')?.focus()
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        window.dispatchEvent(new Event('tideline:new-item'))
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  let body
  if (session === 'loading' || (session === 'in' && !ready)) body = <Splash />
  else if (session === 'out') body = <SignIn />
  else if (!meId || !hasProfile) body = <Onboarding localKey={LOCAL_ME} />
  else
    body = (
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={route.page === 'board' ? route.boardId : route.page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {route.page === 'board' ? <BoardPage boardId={route.boardId} viewId={route.viewId} /> : route.page === 'my-work' ? <MyWork /> : route.page === 'inbox' ? <Inbox /> : <Home />}
            </motion.div>
          </AnimatePresence>
        </main>
        <ItemPanel />
        <CommandPalette />
      </div>
    )

  return (
    <>
      {body}
      <Toaster theme={theme} position="bottom-right" toastOptions={{ className: '!rounded-xl !border-line !bg-panel !text-fg !shadow-pop' }} />
    </>
  )
}


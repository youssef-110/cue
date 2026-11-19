import { Suspense, lazy, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Toaster, toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { checkDateAutomations, init, openItem, setPalette, setTheme, useStore } from './lib/store'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, cloudAdapter, db, localAdapter } from './lib/sync'
import { checkAccess } from './lib/team'
import { Sidebar } from './components/Sidebar'
import { ItemPanel } from './components/ItemPanel'
import { CommandPalette } from './components/CommandPalette'
import { ChangePassword, ClaimWorkspace, NotOnTeam, Onboarding, SignIn, Splash } from './pages/Auth'
import { BoardPage } from './pages/BoardPage'
import { MyWork } from './pages/MyWork'
import { Inbox } from './pages/Inbox'
import { Home } from './pages/Home'
import { ArchivePage } from './pages/ArchivePage'
import { DocPage } from './pages/DocPage'
// recharts-heavy, loaded on demand
const Dashboards = lazy(() => import('./pages/Dashboards').then((m) => ({ default: m.Dashboards })))

const LOCAL_ME = 'tideline:me'

export default function App() {
  const { ready, theme, meId, route } = useStore(useShallow((s) => ({ ready: s.ready, theme: s.theme, meId: s.meId, route: s.route })))
  const hasProfile = useStore((s) => !!s.user[s.meId])
  const [session, setSession] = useState<'loading' | 'out' | 'password' | 'claim' | 'denied' | 'in'>(auth ? 'loading' : 'in')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // connect storage: local mode, or Firebase sign-in -> team check -> live sync
  useEffect(() => {
    if (!auth || !db) {
      init(localAdapter(), localStorage.getItem(LOCAL_ME) ?? '')
      return
    }
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return setSession('out')
      try {
        const access = await checkAccess()
        if (access.kind !== 'member') return setSession(access.kind)
        if (access.member.mustChangePassword) return setSession('password')
        useStore.setState({ isAdmin: access.member.role === 'admin', role: access.member.role })
        if (!useStore.getState().ready) await init(cloudAdapter(db!, u.uid), u.uid)
        setSession('in')
      } catch (e) {
        toast.error('Could not load your team data: ' + (e as Error).message)
      }
    })
  }, [])

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
  else if (session === 'password') body = <ChangePassword />
  else if (session === 'claim') body = <ClaimWorkspace />
  else if (session === 'denied') body = <NotOnTeam />
  else if (!meId || !hasProfile) body = <Onboarding localKey={LOCAL_ME} />
  else
    body = (
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={route.page === 'board' ? route.boardId : route.page === 'doc' ? route.id : route.page}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {route.page === 'board' ? (
                <BoardPage boardId={route.boardId} viewId={route.viewId} />
              ) : route.page === 'my-work' ? (
                <MyWork />
              ) : route.page === 'inbox' ? (
                <Inbox />
              ) : route.page === 'archive' ? (
                <ArchivePage />
              ) : route.page === 'doc' ? (
                <DocPage id={route.id} />
              ) : route.page === 'dashboards' ? (
                <Suspense fallback={<div className="flex-1 animate-pulse bg-panel-2/40" />}>
                  <Dashboards id={route.id} />
                </Suspense>
              ) : (
                <Home />
              )}
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
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          className: '!rounded-lg !border !border-line-strong !bg-panel !font-sans !text-[13.5px] !text-fg !shadow-pop',
          classNames: { error: '!border-alert [&_[data-icon]]:!text-alert', success: '[&_[data-icon]]:!text-fg', description: '!text-muted' },
        }}
      />
    </>
  )
}


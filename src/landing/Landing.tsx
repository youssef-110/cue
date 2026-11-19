import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import cx from 'clsx'
import { HeroBoard } from './HeroBoard'
import { Automations, Columns, PrivateAndRun, Views, WhatIs } from './Sections'
import { APP_URL, GitHubMark, Logo, REPO_URL, WRAP, useClock } from './shared'

const NAV = [
  ['Views', '#views'],
  ['Automations', '#automations'],
  ['Columns', '#columns'],
  ['Private', '#private'],
  ['Run your own', '#run'],
] as const

export function Landing() {
  return (
    <>
      <a href="#main" className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-on-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Hero />
      <main id="main" className="pb-28 sm:pb-36">
        <WhatIs />
        <Views />
        <Automations />
        <Columns />
        <PrivateAndRun />
      </main>
      <Closing />
      <Footer />
    </>
  )
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  const toggle = () => {
    const next = !dark
    try {
      localStorage.setItem('tideline:theme', next ? 'dark' : 'light')
    } catch {
      /* storage blocked: the theme still switches for this visit */
    }
    setDark(next)
  }
  return { dark, toggle }
}

function Actions() {
  return (
    <div className="flex flex-wrap gap-3">
      <a href={APP_URL} className="inline-flex h-12 items-center gap-2 rounded-md bg-ink px-5 text-[16px] font-semibold text-on-ink transition-colors hover:bg-[#2a2a27]">
        Open the team workspace
        <ArrowRight className="size-4" aria-hidden />
      </a>
      <a href={REPO_URL} className="inline-flex h-12 items-center gap-2 rounded-md border-2 border-on-signal px-5 text-[16px] font-semibold text-on-signal transition-colors hover:bg-on-signal/8">
        <GitHubMark size={17} />
        Get the code
      </a>
    </div>
  )
}

function Hero() {
  const { dark, toggle } = useTheme()
  const clock = useClock()
  return (
    <header>
      <div className="on-signal bg-signal pb-32 text-on-signal sm:pb-40">
        <div className={WRAP}>
          <nav aria-label="Main" className="flex h-[72px] items-center gap-6 border-b-2 border-on-signal">
            <a href="#" className="flex items-center gap-2.5" aria-label="Cue, back to top">
              <Logo size={30} />
              <span className="caps text-[26px] leading-none font-bold tracking-[0.02em]">Cue</span>
            </a>
            <ul className="hidden items-center gap-6 lg:flex">
              {NAV.map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="caps text-[14px] font-semibold tracking-[0.12em] underline-offset-[6px] hover:underline">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} className="grid size-10 place-items-center rounded-md transition-colors hover:bg-on-signal/10">
                {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
              </button>
              <a href={REPO_URL} className="flex h-10 items-center gap-2 rounded-md px-2.5 text-[14px] font-semibold transition-colors hover:bg-on-signal/10">
                <GitHubMark size={16} />
                <span className="hidden sm:inline">GitHub</span>
              </a>
            </div>
          </nav>

          <h1 className="caps pt-10 text-[clamp(2.75rem,10.6vw,8.75rem)] leading-[0.86] font-bold tracking-[0.005em] text-balance sm:pt-14">Every task has a departure time.</h1>

          <div className="mt-8 grid gap-x-12 gap-y-7 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <p className="max-w-[44ch] text-[19px] leading-[1.45] font-medium text-pretty sm:text-[21px]">
              Cue is the free, open-source work manager the Deep Echo team runs its day on. Boards, ten views and automations, with every deadline read like a train time.
            </p>
            <div>
              <Actions />
              <p className="mt-3 text-[14px]">The workspace is for the team: logins come from our admin. Anyone can take the code.</p>
            </div>
          </div>

          <p className="mt-10 flex flex-wrap gap-x-5 gap-y-1 border-t-2 border-on-signal pt-3 font-mono text-[13px] font-medium">
            <span>MIT LICENCE</span>
            <span>FREE FOR EVERY SEAT</span>
            <span>10 VIEWS</span>
            <span className="hidden sm:inline">NO PUBLIC SIGN-UP</span>
            <span className="ml-auto">
              {clock.day} {clock.time}
            </span>
          </p>
        </div>
      </div>
      <div className={cx(WRAP, '-mt-24 sm:-mt-28')}>
        <HeroBoard />
      </div>
    </header>
  )
}

function Closing() {
  return (
    <section aria-labelledby="closing" className="on-signal bg-signal text-on-signal">
      <div className={cx(WRAP, 'py-20 sm:py-28')}>
        <h2 id="closing" className="caps text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.88] font-bold tracking-[0.01em] text-balance">
          The code is public. The data never is.
        </h2>
        <div className="mt-10 border-t-2 border-on-signal pt-6">
          <Actions />
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ink text-on-ink">
      <div className={cx(WRAP, 'flex flex-wrap items-center gap-x-8 gap-y-4 py-8 text-[14px]')}>
        <span className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="caps text-[20px] leading-none font-bold">Cue</span>
        </span>
        <span className="text-on-ink-muted">Built by Deep Echo. MIT licence, © 2026.</span>
        <ul className="flex gap-6 sm:ml-auto">
          <li>
            <a href={REPO_URL} className="hover:underline">
              Source
            </a>
          </li>
          <li>
            <a href={`${REPO_URL}#readme`} className="hover:underline">
              README
            </a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/LICENSE`} className="hover:underline">
              Licence
            </a>
          </li>
          <li>
            <a href={APP_URL} className="hover:underline">
              Team workspace
            </a>
          </li>
        </ul>
      </div>
    </footer>
  )
}

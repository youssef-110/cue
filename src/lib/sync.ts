import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc as fsDoc,
  getDocs,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  where,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import { KINDS, type Docs, type Kind } from './types'

export type Snapshot = { [K in Kind]: Record<string, Docs[K]> }
export type RemoteChange = { kind: Kind; id: string; doc: Docs[Kind] | null }

export interface Adapter {
  mode: 'local' | 'cloud'
  load(): Promise<Snapshot>
  put<K extends Kind>(kind: K, doc: Docs[K]): void
  remove(kind: Kind, id: string): void
  subscribe(cb: (c: RemoteChange) => void): () => void
}

export const emptySnapshot = (): Snapshot =>
  Object.fromEntries(KINDS.map((k) => [k, {}])) as unknown as Snapshot

const LS_KEY = 'tideline:v1'

/** Browser-only storage. Tabs stay in sync through the `storage` event. */
export function localAdapter(): Adapter {
  let snap = emptySnapshot()
  let timer: number | undefined
  const flush = () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(snap))
      } catch (e) {
        console.error('Tideline: could not save to local storage', e)
      }
    }, 150)
  }
  return {
    mode: 'local',
    async load() {
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (raw) snap = { ...emptySnapshot(), ...JSON.parse(raw) }
      } catch {
        snap = emptySnapshot()
      }
      return structuredClone(snap)
    },
    put(kind, doc) {
      ;(snap[kind] as Record<string, unknown>)[doc.id] = doc
      flush()
    },
    remove(kind, id) {
      delete snap[kind][id]
      flush()
    },
    subscribe(cb) {
      const onStorage = (e: StorageEvent) => {
        if (e.key !== LS_KEY || !e.newValue) return
        const next: Snapshot = { ...emptySnapshot(), ...JSON.parse(e.newValue) }
        for (const kind of KINDS) {
          for (const id of Object.keys(snap[kind])) if (!next[kind][id]) cb({ kind, id, doc: null })
          for (const [id, doc] of Object.entries(next[kind]))
            if (JSON.stringify(doc) !== JSON.stringify(snap[kind][id])) cb({ kind, id, doc })
        }
        snap = next
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}

const env = import.meta.env
export const firebaseConfig = env.VITE_FIREBASE_API_KEY
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY as string,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: env.VITE_FIREBASE_PROJECT_ID as string,
      appId: env.VITE_FIREBASE_APP_ID as string,
    }
  : null
export const app = firebaseConfig ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const db = app
  ? initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  : null
// local development against `npm run emulators` (no real project needed)
if (env.VITE_FIREBASE_EMULATOR && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8085)
}

/**
 * Shared team storage: one Firestore collection per kind, live listeners.
 * Activity is capped to the newest rows and notifications are scoped to you,
 * which keeps daily reads well inside the free quota.
 */
export function cloudAdapter(fs: Firestore, uid: string): Adapter {
  const report = (e: unknown) => {
    console.error('Tideline sync error', e)
    window.dispatchEvent(new CustomEvent('tideline:sync-error', { detail: (e as Error).message }))
  }
  const queries = (): [Kind, Query][] =>
    KINDS.map((kind) => {
      const c = collection(fs, kind)
      if (kind === 'activity') return [kind, query(c, orderBy('at', 'desc'), limit(400))]
      if (kind === 'notification') return [kind, query(c, where('userId', '==', uid))]
      return [kind, c]
    })
  return {
    mode: 'cloud',
    async load() {
      const snap = emptySnapshot()
      await Promise.all(
        queries().map(async ([kind, q]) => {
          const res = await getDocs(q)
          res.forEach((d) => ((snap[kind] as Record<string, unknown>)[d.id] = d.data()))
        }),
      )
      return snap
    },
    put(kind, doc) {
      setDoc(fsDoc(fs, kind, doc.id), doc).catch(report)
    },
    remove(kind, id) {
      deleteDoc(fsDoc(fs, kind, id)).catch(report)
    },
    subscribe(cb) {
      const offs = queries().map(([kind, q]) =>
        onSnapshot(
          q,
          (res) =>
            res.docChanges().forEach((ch) =>
              cb({ kind, id: ch.doc.id, doc: ch.type === 'removed' ? null : (ch.doc.data() as Docs[Kind]) }),
            ),
          report,
        ),
      )
      return () => offs.forEach((off) => off())
    },
  }
}

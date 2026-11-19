import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

/** Shared team storage: one `docs` table, realtime row updates. */
export function cloudAdapter(sb: SupabaseClient): Adapter {
  const report = (error: { message: string } | null) => {
    if (error) {
      console.error('Tideline sync error', error)
      window.dispatchEvent(new CustomEvent('tideline:sync-error', { detail: error.message }))
    }
  }
  // Our own writes echo back through realtime; ignore echoes for rows we just
  // wrote so fast typing never flickers back to an older value.
  const recent = new Map<string, number>()
  const mark = (id: string) => recent.set(id, Date.now())
  return {
    mode: 'cloud',
    async load() {
      const snap = emptySnapshot()
      const pageSize = 1000
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await sb
          .from('docs')
          .select('id, kind, data')
          .eq('deleted', false)
          .range(from, from + pageSize - 1)
        if (error) throw error
        for (const row of data) if (row.kind in snap) (snap[row.kind as Kind] as Record<string, unknown>)[row.id] = row.data
        if (data.length < pageSize) break
      }
      return snap
    },
    put(kind, doc) {
      mark(doc.id)
      sb.from('docs')
        .upsert({ id: doc.id, kind, data: doc, deleted: false, updated_at: new Date().toISOString() })
        .then(({ error }) => report(error))
    },
    remove(kind, id) {
      mark(id)
      sb.from('docs')
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('kind', kind)
        .then(({ error }) => report(error))
    },
    subscribe(cb) {
      const ch = sb
        .channel('docs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, (p) => {
          const row = (p.new && 'id' in p.new ? p.new : p.old) as { id: string; kind: Kind; data: Docs[Kind]; deleted?: boolean }
          if (!row?.id || !KINDS.includes(row.kind)) return
          if (Date.now() - (recent.get(row.id) ?? 0) < 2500) return
          cb({ kind: row.kind, id: row.id, doc: p.eventType === 'DELETE' || row.deleted ? null : row.data })
        })
        .subscribe()
      return () => {
        sb.removeChannel(ch)
      }
    },
  }
}

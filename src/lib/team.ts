import { useEffect, useState } from 'react'
import { collection, doc, getDoc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from './sync'

// Team members live in `members/{auth uid}`; Firestore rules enforce access.
// Accounts are username + password. Firebase Auth needs an email, so each
// username maps to `<username>@cue.invalid` (a reserved domain: no mail is ever sent).
export type Role = 'admin' | 'member' | 'viewer'
export interface Member {
  uid: string
  username: string
  name: string
  role: Role
  addedBy: string
  addedAt: number
  mustChangePassword?: boolean
  notifyEmail?: string // confirmed by code; only the team server writes it
}

export const LOGIN_DOMAIN = 'cue.invalid'
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/
export const normalizeUsername = (u: string) => u.trim().toLowerCase()
export const loginEmail = (username: string) => `${normalizeUsername(username)}@${LOGIN_DOMAIN}`
export const usernameOf = (email?: string | null) => (email ?? '').replace(`@${LOGIN_DOMAIN}`, '')
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** What people type at sign-in: a username, or the real email a login was switched to. */
export const loginFor = (id: string) => (id.includes('@') ? id.trim().toLowerCase() : loginEmail(id))
/** A login that can receive mail (Firebase can send it a reset link); username logins live on the reserved domain. */
export const hasRealEmail = (email?: string | null) => !!email && !email.endsWith('@' + LOGIN_DOMAIN)

export type Access = { kind: 'member'; member: Member } | { kind: 'claim' } | { kind: 'denied' }

/** Is the signed-in account on the team? 'claim' = brand-new workspace, owner not set up yet. */
export async function checkAccess(): Promise<Access> {
  const u = auth?.currentUser
  if (!db || !u) return { kind: 'denied' }
  try {
    const m = await getDoc(doc(db, 'members', u.uid))
    if (m.exists()) return { kind: 'member', member: m.data() as Member }
  } catch {
    // not a member: rules deny the read
  }
  const setup = await getDoc(doc(db, 'meta', 'setup'))
  return setup.exists() ? { kind: 'denied' } : { kind: 'claim' }
}

/** The owner login baked into the deployed rules claims an empty workspace once and becomes admin. */
export async function claimWorkspace(name: string) {
  const u = auth!.currentUser!
  const b = writeBatch(db!)
  const member: Member = { uid: u.uid, username: usernameOf(u.email), name, role: 'admin', addedBy: u.uid, addedAt: Date.now() }
  b.set(doc(db!, 'members', u.uid), member)
  b.set(doc(db!, 'meta', 'setup'), { at: Date.now() })
  await b.commit()
}

export function useMembers() {
  const [list, setList] = useState<Member[]>([])
  useEffect(() => {
    if (!db) return
    return onSnapshot(collection(db, 'members'), (s) => setList(s.docs.map((d) => d.data() as Member).sort((a, b) => a.addedAt - b.addedAt)))
  }, [])
  return list
}

/** Live view of my own membership: role changes apply at once, removal signs me out (cb gets null). */
export const watchMyMembership = (uid: string, cb: (m: Member | null) => void) =>
  onSnapshot(
    doc(db!, 'members', uid),
    (s) => cb(s.exists() ? (s.data() as Member) : null),
    (e) => e.code === 'permission-denied' && cb(null), // other errors are transient: keep the session
  )

/** Ask the team server to email these notifications (it checks each recipient's settings). */
export const emailNotifications = (ids: string[]) => (ids.length ? call<{ sent: number }>({ action: 'notify', ids }) : Promise.resolve({ sent: 0 }))
export const sendTestEmail = () => call<{ to: string }>({ action: 'test' })
/** Connect an email: the server mails a 6-digit code, then confirms it. */
export const startEmail = (email: string) => call<{ ok: true }>({ action: 'email-start', email })
export const confirmEmail = (code: string) => call<{ email: string }>({ action: 'email-confirm', code })
export const disconnectEmail = () => call<{ ok: true }>({ action: 'email-remove' })
/** Restamp a board and everything on it with new readers (server side, so nothing is missed). */
export const saveBoardAccess = (boardId: string, readers: string[]) => call({ action: 'access', boardId, readers })

export const clearPasswordFlag = () => updateDoc(doc(db!, 'members', auth!.currentUser!.uid), { mustChangePassword: false })

// ---------- admin server (creates accounts, resets passwords) ----------
const API = (import.meta.env.VITE_ADMIN_API as string | undefined) ?? '/api/team'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const token = await auth!.currentUser!.getIdToken()
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error('The team server is not reachable. Check your connection and try again.')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Team server error (${res.status})`)
  return data as T
}

export const createAccount = (p: { username: string; name: string; password: string; role: Role }) => call<{ uid: string }>({ action: 'create', ...p })
export const resetPassword = (uid: string, password: string) => call<{ ok: true }>({ action: 'reset', uid, password })
export const setRole = (uid: string, role: Role) => call<{ ok: true }>({ action: 'role', uid, role })
export const removeAccount = (uid: string) => call<{ ok: true }>({ action: 'remove', uid })

/** Temporary password: 16 random characters (~79 bits) in groups of 4, no look-alike characters. */
export function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // 31 symbols, no 0/o/1/l/i
  const out: string[] = []
  const buf = new Uint8Array(1)
  while (out.length < 16) {
    crypto.getRandomValues(buf)
    if (buf[0] < 248) out.push(alphabet[buf[0] % 31]) // reject to avoid modulo bias (248 = 8 * 31)
  }
  return out.join('').match(/.{4}/g)!.join('-')
}

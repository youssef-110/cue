import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from './sync'

// Team allow-list lives in `members/{lowercased email}`; Firestore rules enforce it.
export type Role = 'admin' | 'member'
export interface Member {
  email: string
  role: Role
  addedBy: string
  addedAt: number
}

const myEmail = () => auth?.currentUser?.email?.toLowerCase() ?? ''

export type Access = 'member' | 'admin' | 'claim' | 'denied'

/** Is the signed-in user on the team? 'claim' = brand-new workspace with no admin yet. */
export async function checkAccess(): Promise<Access> {
  if (!db) return 'denied'
  try {
    const m = await getDoc(doc(db, 'members', myEmail()))
    if (m.exists()) return (m.data() as Member).role === 'admin' ? 'admin' : 'member'
  } catch {
    // not a member: rules deny the read
  }
  const setup = await getDoc(doc(db, 'meta', 'setup'))
  return setup.exists() ? 'denied' : 'claim'
}

/** First person to sign in to an empty workspace becomes its admin (rules allow this exactly once). */
export async function claimWorkspace() {
  const email = myEmail()
  const b = writeBatch(db!)
  b.set(doc(db!, 'members', email), { email, role: 'admin', addedBy: email, addedAt: Date.now() } satisfies Member)
  b.set(doc(db!, 'meta', 'setup'), { owner: email, at: Date.now() })
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

export const normalizeEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function addMember(email: string, role: Role) {
  const e = normalizeEmail(email)
  if (!validEmail(e)) throw new Error('That doesn’t look like an email address')
  await setDoc(doc(db!, 'members', e), { email: e, role, addedBy: myEmail(), addedAt: Date.now() } satisfies Member)
}
export const setRole = (email: string, role: Role) => updateDoc(doc(db!, 'members', email), { role })
export const removeMember = (email: string) => deleteDoc(doc(db!, 'members', email))
export { myEmail }

// Firestore rules tests. Run: npm run test:rules (starts the local emulator, needs Java).
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

let env
const user = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore()

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'tideline-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8').replace('__OWNER_EMAIL__', 'ada@team.io'), host: '127.0.0.1', port: 8085 },
  })
})
after(() => env.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'meta/setup'), { at: 1 })
    await setDoc(doc(db, 'members/ada@team.io'), { email: 'ada@team.io', role: 'admin', addedBy: 'ada@team.io', addedAt: 1 })
    await setDoc(doc(db, 'members/bo@team.io'), { email: 'bo@team.io', role: 'member', addedBy: 'ada@team.io', addedAt: 2 })
    await setDoc(doc(db, 'item/i1'), { id: 'i1', name: 'Task', createdBy: 'ada', values: {} })
    await setDoc(doc(db, 'update/u1'), { id: 'u1', authorId: 'ada', body: 'hi', likes: [] })
    await setDoc(doc(db, 'notification/n1'), { id: 'n1', userId: 'bo', actorId: 'ada', read: false })
  })
})

const ada = () => user('ada', 'ada@team.io')
const bo = () => user('bo', 'bo@team.io')
const eve = () => user('eve', 'eve@evil.io')

test('strangers and unverified users see nothing', async () => {
  await assertFails(getDoc(doc(eve(), 'item/i1')))
  await assertFails(getDoc(doc(user('bo', 'bo@team.io', false), 'item/i1')))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'item/i1')))
  await assertFails(setDoc(doc(eve(), 'item/x'), { id: 'x', name: 'spam', createdBy: 'eve' }))
})

test('members share boards and items', async () => {
  await assertSucceeds(getDoc(doc(bo(), 'item/i1')))
  await assertSucceeds(setDoc(doc(bo(), 'item/i1'), { id: 'i1', name: 'Renamed', createdBy: 'ada', values: {} }))
  await assertFails(setDoc(doc(bo(), 'item/i1'), { id: 'i1', name: 'Mine now', createdBy: 'bo', values: {} }))
  await assertSucceeds(deleteDoc(doc(bo(), 'item/i1')))
})

test('only admins manage the team, never themselves', async () => {
  await assertFails(setDoc(doc(bo(), 'members/eve@evil.io'), { email: 'eve@evil.io', role: 'admin', addedBy: 'bo', addedAt: 3 }))
  await assertSucceeds(setDoc(doc(ada(), 'members/cy@team.io'), { email: 'cy@team.io', role: 'member', addedBy: 'ada@team.io', addedAt: 3 }))
  await assertFails(setDoc(doc(ada(), 'members/Cy@Team.io'), { email: 'Cy@Team.io', role: 'member', addedBy: 'ada', addedAt: 3 }))
  await assertFails(updateDoc(doc(ada(), 'members/ada@team.io'), { role: 'member' }))
  await assertFails(deleteDoc(doc(ada(), 'members/ada@team.io')))
  await assertSucceeds(deleteDoc(doc(ada(), 'members/bo@team.io')))
  await assertFails(getDoc(doc(bo(), 'item/i1'))) // removed member loses access
})

test('only the configured owner can claim a fresh workspace, once', async () => {
  const claim = (db, email) => {
    const b = writeBatch(db)
    b.set(doc(db, `members/${email}`), { email, role: 'admin', addedBy: email, addedAt: 9 })
    b.set(doc(db, 'meta/setup'), { at: 9 })
    return b.commit()
  }
  await assertFails(claim(ada(), 'ada@team.io')) // already set up
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'meta/setup'))
    await deleteDoc(doc(ctx.firestore(), 'members/ada@team.io'))
  })
  await assertFails(claim(eve(), 'eve@evil.io')) // a stranger can't take a fresh workspace
  const db = ada()
  const b = writeBatch(db)
  b.set(doc(db, 'members/ada@team.io'), { email: 'ada@team.io', role: 'admin', addedBy: 'ada@team.io', addedAt: 9 })
  b.set(doc(db, 'meta/setup'), { at: 9, owner: 'ada@team.io' })
  await assertFails(b.commit()) // the setup flag may not carry personal data
  await assertSucceeds(claim(ada(), 'ada@team.io'))
})

test('comments: only the author edits, others toggle only their own like', async () => {
  await assertFails(setDoc(doc(bo(), 'update/u2'), { id: 'u2', authorId: 'ada', body: 'fake', likes: [] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { body: 'edited' }))
  await assertSucceeds(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo'] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo', 'bo'] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo', 'ada'] }))
  await assertSucceeds(updateDoc(doc(bo(), 'update/u1'), { likes: [] }))
  await assertFails(deleteDoc(doc(bo(), 'update/u1')))
  await assertSucceeds(deleteDoc(doc(ada(), 'update/u1')))
})

test('activity is append-only and signed', async () => {
  await assertFails(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'ada', text: 'x', at: 1 }))
  await assertSucceeds(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'bo', text: 'x', at: 1 }))
  await assertFails(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'bo', text: 'changed', at: 1 }))
})

test('notifications are private to recipient and sender', async () => {
  await assertSucceeds(getDocs(query(collection(bo(), 'notification'), where('userId', '==', 'bo'))))
  await assertFails(getDoc(doc(user('cy', 'cy@team.io'), 'notification/n1')))
  await assertSucceeds(updateDoc(doc(bo(), 'notification/n1'), { read: true }))
  await assertFails(updateDoc(doc(bo(), 'notification/n1'), { userId: 'eve' }))
  await assertFails(setDoc(doc(bo(), 'notification/n2'), { id: 'n2', userId: 'ada', actorId: 'ada', read: false }))
})

test('profiles: your own or placeholders only', async () => {
  await assertSucceeds(setDoc(doc(bo(), 'user/bo'), { id: 'bo', name: 'Bo' }))
  await assertFails(setDoc(doc(bo(), 'user/ada'), { id: 'ada', name: 'Hacked' }))
  await assertSucceeds(setDoc(doc(bo(), 'user/u_guest'), { id: 'u_guest', name: 'Guest' }))
})

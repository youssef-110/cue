// Firestore rules tests. Run: npm run test:rules (starts the local emulator, needs Java).
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

const OWNER = 'ada@cue.invalid'
let env
const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore()
const ada = () => as('ada', OWNER) // admin, owner
const bo = () => as('bo', 'bo@cue.invalid') // member
const vi = () => as('vi', 'vi@cue.invalid') // viewer
const eve = () => as('eve', 'eve@cue.invalid') // signed in, not on the team

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'tideline-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8').replace('__OWNER_EMAIL__', OWNER), host: '127.0.0.1', port: 8085 },
  })
})
after(() => env.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'meta/setup'), { at: 1 })
    await setDoc(doc(db, 'members/ada'), { uid: 'ada', username: 'ada', name: 'Ada', role: 'admin', addedBy: 'ada', addedAt: 1 })
    await setDoc(doc(db, 'members/bo'), { uid: 'bo', username: 'bo', name: 'Bo', role: 'member', addedBy: 'ada', addedAt: 2, mustChangePassword: true })
    await setDoc(doc(db, 'members/vi'), { uid: 'vi', username: 'vi', name: 'Vi', role: 'viewer', addedBy: 'ada', addedAt: 3 })
    await setDoc(doc(db, 'board/b1'), { id: 'b1', name: 'Team', readers: ['*'] })
    await setDoc(doc(db, 'item/i1'), { id: 'i1', name: 'Task', createdBy: 'ada', values: {}, boardId: 'b1', readers: ['*'] })
    await setDoc(doc(db, 'update/u1'), { id: 'u1', authorId: 'ada', body: 'hi', likes: [], boardId: 'b1', readers: ['*'] })
    // a private board shared with bo only (ada is an admin, so she sees it anyway)
    await setDoc(doc(db, 'board/bp'), { id: 'bp', name: 'Secret', readers: ['bo'] })
    await setDoc(doc(db, 'item/ip'), { id: 'ip', name: 'Hidden', createdBy: 'bo', values: {}, boardId: 'bp', readers: ['bo'] })
    await setDoc(doc(db, 'notification/n1'), { id: 'n1', userId: 'bo', actorId: 'ada', read: false })
  })
})

test('strangers and signed-out visitors see nothing', async () => {
  await assertFails(getDoc(doc(eve(), 'item/i1')))
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'item/i1')))
  await assertFails(setDoc(doc(eve(), 'item/x'), { id: 'x', name: 'spam', createdBy: 'eve' }))
  await assertFails(getDocs(collection(eve(), 'members')))
})

test('members edit shared work; viewers only read', async () => {
  await assertSucceeds(getDoc(doc(bo(), 'item/i1')))
  await assertSucceeds(setDoc(doc(bo(), 'item/i1'), { id: 'i1', name: 'Renamed', createdBy: 'ada', values: {}, boardId: 'b1', readers: ['*'] }))
  await assertFails(setDoc(doc(bo(), 'item/i1'), { id: 'i1', name: 'Mine now', createdBy: 'bo', values: {}, boardId: 'b1', readers: ['*'] }))
  await assertSucceeds(getDoc(doc(vi(), 'item/i1')))
  await assertFails(setDoc(doc(vi(), 'item/i1'), { id: 'i1', name: 'x', createdBy: 'ada', values: {}, boardId: 'b1', readers: ['*'] }))
  await assertFails(deleteDoc(doc(vi(), 'item/i1')))
  await assertSucceeds(deleteDoc(doc(bo(), 'item/i1')))
})

test('nobody manages the team from the browser, not even admins', async () => {
  await assertFails(setDoc(doc(ada(), 'members/eve'), { uid: 'eve', username: 'eve', name: 'Eve', role: 'admin', addedBy: 'ada', addedAt: 4 }))
  await assertFails(updateDoc(doc(ada(), 'members/bo'), { role: 'admin' }))
  await assertFails(deleteDoc(doc(ada(), 'members/bo')))
  await assertFails(updateDoc(doc(bo(), 'members/bo'), { role: 'admin' }))
  await assertSucceeds(updateDoc(doc(bo(), 'members/bo'), { mustChangePassword: false }))
  await assertFails(updateDoc(doc(bo(), 'members/bo'), { mustChangePassword: true }))
})

test('only the configured owner can claim a fresh workspace, once', async () => {
  const claim = (db, uid) => {
    const b = writeBatch(db)
    b.set(doc(db, `members/${uid}`), { uid, username: uid, name: uid, role: 'admin', addedBy: uid, addedAt: 9 })
    b.set(doc(db, 'meta/setup'), { at: 9 })
    return b.commit()
  }
  await assertFails(claim(ada(), 'ada')) // already set up
  await env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'meta/setup'))
    await deleteDoc(doc(ctx.firestore(), 'members/ada'))
  })
  await assertFails(claim(eve(), 'eve')) // a stranger can't take a fresh workspace
  const db = ada()
  const b = writeBatch(db)
  b.set(doc(db, 'members/ada'), { uid: 'ada', username: 'ada', name: 'Ada', role: 'admin', addedBy: 'ada', addedAt: 9 })
  b.set(doc(db, 'meta/setup'), { at: 9, owner: OWNER })
  await assertFails(b.commit()) // the setup flag may not carry personal data
  await assertSucceeds(claim(ada(), 'ada'))
})

test('comments: only the author edits, others toggle only their own like', async () => {
  await assertFails(setDoc(doc(bo(), 'update/u2'), { id: 'u2', authorId: 'ada', body: 'fake', likes: [], boardId: 'b1', readers: ['*'] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { body: 'edited' }))
  await assertSucceeds(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo'] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo', 'bo'] }))
  await assertFails(updateDoc(doc(bo(), 'update/u1'), { likes: ['bo', 'ada'] }))
  await assertSucceeds(updateDoc(doc(bo(), 'update/u1'), { likes: [] }))
  await assertFails(deleteDoc(doc(bo(), 'update/u1')))
  await assertSucceeds(deleteDoc(doc(ada(), 'update/u1')))
  await assertSucceeds(setDoc(doc(vi(), 'update/u3'), { id: 'u3', authorId: 'vi', body: 'viewer comment', likes: [], boardId: 'b1', readers: ['*'] }))
})

test('activity is append-only and signed', async () => {
  await assertFails(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'ada', text: 'x', at: 1, boardId: 'b1', readers: ['*'] }))
  await assertSucceeds(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'bo', text: 'x', at: 1, boardId: 'b1', readers: ['*'] }))
  await assertFails(setDoc(doc(bo(), 'activity/a1'), { id: 'a1', actorId: 'bo', text: 'changed', at: 1, boardId: 'b1', readers: ['*'] }))
})

test('notifications are private to recipient and sender', async () => {
  await assertSucceeds(getDocs(query(collection(bo(), 'notification'), where('userId', '==', 'bo'))))
  await assertFails(getDoc(doc(vi(), 'notification/n1')))
  await assertSucceeds(updateDoc(doc(bo(), 'notification/n1'), { read: true }))
  await assertFails(updateDoc(doc(bo(), 'notification/n1'), { userId: 'eve' }))
  await assertFails(setDoc(doc(bo(), 'notification/n2'), { id: 'n2', userId: 'ada', actorId: 'ada', read: false }))
})

test('profiles: your own or placeholders only', async () => {
  await assertSucceeds(setDoc(doc(bo(), 'user/bo'), { id: 'bo', name: 'Bo' }))
  await assertFails(setDoc(doc(bo(), 'user/ada'), { id: 'ada', name: 'Hacked' }))
  await assertSucceeds(setDoc(doc(bo(), 'user/u_guest'), { id: 'u_guest', name: 'Guest' }))
  await assertFails(setDoc(doc(vi(), 'user/u_guest2'), { id: 'u_guest2', name: 'Guest' }))
})

test('private boards: only their readers (and admins) see or touch them', async () => {
  // reads
  await assertSucceeds(getDoc(doc(bo(), 'item/ip')))
  await assertSucceeds(getDoc(doc(ada(), 'item/ip')))
  await assertFails(getDoc(doc(vi(), 'item/ip')))
  await assertFails(getDoc(doc(vi(), 'board/bp')))
  // the filtered query everyone uses is allowed and returns only what they may see
  const seen = await assertSucceeds(getDocs(query(collection(vi(), 'item'), where('readers', 'array-contains-any', ['*', 'vi']))))
  if (seen.docs.map((d) => d.id).join() !== 'i1') throw new Error('viewer saw ' + seen.docs.map((d) => d.id))
  await assertFails(getDocs(collection(vi(), 'item'))) // an unfiltered query would include private items
  await assertSucceeds(getDocs(collection(ada(), 'item'))) // admins load everything
  // writes must carry the board's readers, and you must be one of them
  await assertFails(setDoc(doc(bo(), 'item/leak'), { id: 'leak', name: 'x', createdBy: 'bo', values: {}, boardId: 'bp', readers: ['*'] }))
  await assertSucceeds(setDoc(doc(bo(), 'item/ok'), { id: 'ok', name: 'x', createdBy: 'bo', values: {}, boardId: 'bp', readers: ['bo'] }))
  await assertFails(setDoc(doc(vi(), 'update/sneak'), { id: 'sneak', authorId: 'vi', body: 'x', likes: [], boardId: 'bp', readers: ['bo'] }))
  // moving a public item onto the private board must restamp it
  await assertFails(updateDoc(doc(bo(), 'item/i1'), { boardId: 'bp' }))
  await assertSucceeds(updateDoc(doc(bo(), 'item/i1'), { boardId: 'bp', readers: ['bo'] }))
  // nobody changes access from the browser: the team server restamps the board's documents together
  await assertFails(updateDoc(doc(bo(), 'board/bp'), { readers: ['*'] }))
  await assertFails(updateDoc(doc(ada(), 'board/b1'), { readers: ['ada'] }))
  await assertFails(setDoc(doc(bo(), 'board/new'), { id: 'new', name: 'x', readers: ['bo'], createdBy: 'bo' }))
  await assertFails(setDoc(doc(bo(), 'board/new'), { id: 'new', name: 'x', readers: ['*'], createdBy: 'ada' })) // can't name someone else the owner
  await assertSucceeds(setDoc(doc(bo(), 'board/new'), { id: 'new', name: 'x', readers: ['*'], createdBy: 'bo' }))
  await assertFails(updateDoc(doc(bo(), 'board/new'), { createdBy: 'ada' }))
  await assertSucceeds(updateDoc(doc(bo(), 'board/bp'), { name: 'Still secret' }))
  await assertFails(updateDoc(doc(vi(), 'board/bp'), { name: 'x' }))
  // only the creator or an admin deletes a board for good, so nobody can delete and re-create it as theirs
  await assertFails(deleteDoc(doc(bo(), 'board/b1')))
  await assertSucceeds(deleteDoc(doc(bo(), 'board/new')))
  await assertSucceeds(deleteDoc(doc(ada(), 'board/b1')))
})

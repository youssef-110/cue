// Cue's team server, deployed as a Vercel serverless function. Callers send their Firebase ID token.
// Admins: create logins, reset passwords, change roles, remove people (browsers can't touch other accounts).
// Members: change who can see a board (restamps every document on it), send notification emails.
// Keyless: Vercel's per-request OIDC token is exchanged for Google credentials via
// workload identity federation (pool "vercel" -> service account cue-team-api). No key file exists.
// Env: ALLOWED_ORIGINS (comma list). Email (optional): SMTP_USER + SMTP_PASS (a Gmail address and an app
// password work), SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 465), APP_URL (link in emails).
import { writeFileSync } from 'node:fs'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import nodemailer from 'nodemailer'

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(k: string, v: string): void; end(): void }

const ROLES = ['admin', 'member', 'viewer'] as const
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/
const LOGIN_DOMAIN = 'cue.invalid'
const COLORS = ['#2F5BEA', '#0F9D6E', '#C2410C', '#7C3AED', '#BE185D', '#0E7490', '#A16207', '#4D7C0F']

const PROJECT_ID = 'tideline-97832'
const PROJECT_NUMBER = '1030913862428'
const SERVICE_ACCOUNT = 'cue-team-api@tideline-97832.iam.gserviceaccount.com'
const TOKEN_FILE = '/tmp/vercel-oidc.jwt'
const CRED_FILE = '/tmp/gcp-external-account.json'

/** Refresh the OIDC token file Google's credential loader reads, then init once. */
function app(oidcToken: string) {
  if (!oidcToken) throw new Error('Vercel OIDC token missing (enable OIDC on the project)')
  writeFileSync(TOKEN_FILE, oidcToken)
  if (!getApps().length) {
    writeFileSync(
      CRED_FILE,
      JSON.stringify({
        type: 'external_account',
        audience: `//iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/vercel/providers/vercel`,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SERVICE_ACCOUNT}:generateAccessToken`,
        credential_source: { file: TOKEN_FILE, format: { type: 'text' } },
      }),
    )
    process.env.GOOGLE_APPLICATION_CREDENTIALS = CRED_FILE
    process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  }
  return getApps()[0]
}

class HttpError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}
const fail = (code: number, msg: string): never => {
  throw new HttpError(code, msg)
}
const str = (v: unknown, name: string, max = 200) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : fail(400, `Invalid ${name}`))
const password = (v: unknown) => (typeof v === 'string' && v.length >= 8 && v.length <= 128 ? v : fail(400, 'Password must be 8 to 128 characters'))
const role = (v: unknown) => ((ROLES as readonly string[]).includes(v as string) ? (v as (typeof ROLES)[number]) : fail(400, 'Invalid role'))

// ---------- email ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APP_URL = process.env.APP_URL || 'https://youssef-110.github.io/tideline/app.html'
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
let mailer: nodemailer.Transporter | null = null
function mail() {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!user || !pass) fail(503, 'Email is not set up on the team server yet. Ask your admin.')
  mailer ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user, pass },
  })
  return { mailer, from: `"Cue" <${user}>` }
}
function render(headline: string, body: string, link: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f4f3ee;font-family:Helvetica,Arial,sans-serif;color:#121212">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e2db">
<tr><td style="background:#f6d11f;padding:14px 20px;font-weight:700;font-size:18px;letter-spacing:.08em">CUE</td></tr>
<tr><td style="padding:22px 20px 8px;font-size:17px;font-weight:700;line-height:1.35">${esc(headline)}</td></tr>
<tr><td style="padding:0 20px 18px;font-size:15px;line-height:1.5;color:#55554f">${esc(body)}</td></tr>
<tr><td style="padding:0 20px 24px"><a href="${esc(link)}" style="display:inline-block;background:#121212;color:#f4f3ee;text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:4px">Open in Cue</a></td></tr>
<tr><td style="border-top:1px solid #e3e2db;padding:12px 20px;font-size:12px;color:#74746e">You get these because email notifications are on in your Cue profile. Click your name in Cue to turn them off.</td></tr>
</table></td></tr></table></body></html>`
  return { html, text: `${headline}\n\n${body}\n\nOpen in Cue: ${link}\n\nTurn these off from your profile in Cue.` }
}
const canSeeBoard = (readers: unknown, uid: string, admin: boolean) => admin || !Array.isArray(readers) || readers.includes('*') || readers.includes(uid)

/** Restamp a board and every document on it with new readers. */
async function restamp(db: Firestore, boardId: string, readers: string[]) {
  // The board goes first: from then on the rules make every new write carry the new readers.
  await db.doc(`board/${boardId}`).update({ readers })
  const same = (v: unknown) => Array.isArray(v) && v.length === readers.length && v.every((x, i) => x === readers[i])
  // Two sweeps: the second catches anything written while the first was running.
  for (let pass = 0; pass < 2; pass++) {
    let batch = db.batch()
    let n = 0
    for (const kind of ['item', 'update', 'activity', 'doc']) {
      const snap = await db.collection(kind).where('boardId', '==', boardId).get()
      for (const d of snap.docs) {
        if (same(d.get('readers'))) continue
        batch.update(d.ref, { readers })
        if (++n >= 450) (await batch.commit(), (batch = db.batch()), (n = 0))
      }
    }
    if (n) await batch.commit()
  }
}

export default async function handler(req: Req, res: Res) {
  const origin = String(req.headers.origin ?? '')
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })

  try {
    const a = app(String(req.headers['x-vercel-oidc-token'] ?? process.env.VERCEL_OIDC_TOKEN ?? ''))
    const auth = getAuth(a)
    const db = getFirestore(a)

    // caller must be signed in and on the team; team management needs an admin
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
    if (!token) fail(401, 'Not signed in')
    const caller = await auth.verifyIdToken(token).catch(() => fail(401, 'Your session expired. Sign in again.'))
    const me = await db.doc(`members/${caller.uid}`).get()
    if (!me.exists) fail(403, 'You are not on this team')
    const callerRole = me.get('role') as string
    const isAdmin = callerRole === 'admin'

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as Record<string, unknown>
    if (['create', 'reset', 'role', 'remove'].includes(String(body.action)) && !isAdmin) fail(403, 'Only admins can manage the team')
    const target = () => {
      const uid = str(body.uid, 'person', 128)
      if (uid === caller.uid) fail(400, 'You cannot change your own access here')
      return uid
    }

    switch (body.action) {
      case 'create': {
        const username = str(body.username, 'username', 32).toLowerCase()
        if (!USERNAME_RE.test(username)) fail(400, 'Usernames use 2–32 lowercase letters, digits, dots, dashes or underscores')
        const name = str(body.name, 'name', 80)
        const r = role(body.role)
        const user = await auth
          .createUser({ email: `${username}@${LOGIN_DOMAIN}`, emailVerified: true, password: password(body.password), displayName: name })
          .catch((e: { code?: string }) => fail(e.code === 'auth/email-already-exists' ? 409 : 400, e.code === 'auth/email-already-exists' ? 'That username is taken' : 'Could not create the account'))
        const batch = db.batch()
        batch.set(db.doc(`members/${user.uid}`), { uid: user.uid, username, name, role: r, addedBy: caller.uid, addedAt: Date.now(), mustChangePassword: true })
        batch.set(db.doc(`user/${user.uid}`), { id: user.uid, name, color: COLORS[Math.floor(Math.random() * COLORS.length)], username }, { merge: true })
        await batch.commit()
        return res.status(200).json({ uid: user.uid })
      }
      case 'reset': {
        const uid = target()
        await auth.updateUser(uid, { password: password(body.password) })
        await auth.revokeRefreshTokens(uid) // sign them out everywhere
        await db.doc(`members/${uid}`).update({ mustChangePassword: true })
        return res.status(200).json({ ok: true })
      }
      case 'role': {
        const uid = target()
        await db.doc(`members/${uid}`).update({ role: role(body.role) })
        return res.status(200).json({ ok: true })
      }
      case 'remove': {
        const uid = target()
        await db.doc(`members/${uid}`).delete()
        await auth.deleteUser(uid).catch(() => undefined)
        // keep their profile so their name still shows on old items
        await db.doc(`user/${uid}`).set({ removedAt: FieldValue.serverTimestamp() }, { merge: true })
        return res.status(200).json({ ok: true })
      }
      case 'access': {
        if (callerRole === 'viewer') fail(403, 'Viewers cannot change boards')
        const boardId = str(body.boardId, 'board', 64)
        const board = await db.doc(`board/${boardId}`).get()
        if (!board.exists || !canSeeBoard(board.get('readers'), caller.uid, isAdmin)) fail(404, 'Board not found')
        const owner = board.get('createdBy') as string | undefined
        // createdBy is set to the creator by the rules and can't change; boards without it are admin-only
        if (!isAdmin && owner !== caller.uid) fail(403, 'Only the person who made this board, or an admin, can change who sees it')
        const list = Array.isArray(body.readers) ? (body.readers as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 100) : fail(400, 'Invalid people')
        let readers = ['*']
        if (!list.includes('*')) {
          const uids = [...new Set([caller.uid, ...list])]
          const found = await db.getAll(...uids.map((u) => db.doc(`members/${u}`)))
          readers = found.filter((d) => d.exists).map((d) => d.id)
        }
        await restamp(db, boardId, readers)
        return res.status(200).json({ readers })
      }
      case 'notify': {
        const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).filter((x): x is string => typeof x === 'string' && /^n_[\w-]{4,40}$/.test(x)).slice(0, 25) : []
        if (!ids.length) return res.status(200).json({ sent: 0 })
        const { mailer: m, from } = mail()
        const actor = (await db.doc(`user/${caller.uid}`).get()).get('name') ?? 'A teammate'
        let sent = 0
        for (const snap of await db.getAll(...ids.map((id) => db.doc(`notification/${id}`)))) {
          const n = snap.data()
          // only the sender may trigger, once, and only for something that just happened
          const age = Date.now() - Number(n?.at)
          if (!n || n.actorId !== caller.uid || n.emailedAt || !(age >= -60_000 && age <= 15 * 60_000)) continue
          if (typeof n.itemId !== 'string' || typeof n.boardId !== 'string') continue // email only about real items
          const [profile, member, item, b] = await db.getAll(db.doc(`user/${n.userId}`), db.doc(`members/${n.userId}`), db.doc(`item/${n.itemId}`), db.doc(`board/${n.boardId}`))
          const to = profile.get('email') as string | undefined
          if (!member.exists || !profile.get('emailNotify') || !to || !EMAIL_RE.test(to)) continue
          if (!item.exists || !b.exists || item.get('boardId') !== n.boardId) continue
          if (!canSeeBoard(b.get('readers'), n.userId, member.get('role') === 'admin')) continue
          // The wording comes from the server and the stored item, never from the client's notification text,
          // so the team's mailbox can't be used to send arbitrary messages.
          const itemName = String(item.get('name') ?? 'an item').slice(0, 120)
          const boardName = String(b.get('name') ?? 'a board').slice(0, 80)
          const link = `${APP_URL}#/board/${encodeURIComponent(n.boardId)}`
          const headline = `${actor} updated “${itemName}”`.slice(0, 160)
          const { html, text } = render(headline, `There is something new for you on “${itemName}” in ${boardName}. Open Cue to see it and reply.`, link)
          await m.sendMail({ from, to, subject: headline, html, text })
          await snap.ref.update({ emailedAt: Date.now() })
          sent++
        }
        return res.status(200).json({ sent })
      }
      case 'test': {
        const to = (await db.doc(`user/${caller.uid}`).get()).get('email') as string | undefined
        if (!to || !EMAIL_RE.test(to)) fail(400, 'Add your email to your profile first')
        const { mailer: m, from } = mail()
        const { html, text } = render('Email notifications are working', 'You will get an email when someone assigns you, mentions you or replies to you in Cue.', APP_URL)
        await m.sendMail({ from, to, subject: 'Cue: email notifications are on', html, text }).catch((e: Error) => fail(502, 'The mail server refused the message: ' + e.message.slice(0, 120)))
        return res.status(200).json({ to })
      }
      default:
        fail(400, 'Unknown action')
    }
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.code).json({ error: e.message })
    console.error(e)
    return res.status(500).json({ error: (e as Error).message.includes('OIDC') ? (e as Error).message : 'Server error' })
  }
}

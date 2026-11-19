// Admin-only team management for Cue, deployed as a Vercel serverless function.
// Browsers cannot create accounts or change another user's password, so the
// admin's Team screen calls this endpoint with their Firebase ID token.
// Keyless: Vercel's per-request OIDC token is exchanged for Google credentials via
// workload identity federation (pool "vercel" -> service account cue-team-api). No key file exists.
// Env: ALLOWED_ORIGINS (comma list).
import { writeFileSync } from 'node:fs'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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

    // caller must be a signed-in admin
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '')
    if (!token) fail(401, 'Not signed in')
    const caller = await auth.verifyIdToken(token).catch(() => fail(401, 'Your session expired. Sign in again.'))
    const me = await db.doc(`members/${caller.uid}`).get()
    if (!me.exists || me.get('role') !== 'admin') fail(403, 'Only admins can manage the team')

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}) as Record<string, unknown>
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
      default:
        fail(400, 'Unknown action')
    }
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.code).json({ error: e.message })
    console.error(e)
    return res.status(500).json({ error: (e as Error).message.includes('OIDC') ? (e as Error).message : 'Server error' })
  }
}

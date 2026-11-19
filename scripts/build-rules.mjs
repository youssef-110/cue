// Writes .rules-build/firestore.rules with the workspace owner's email filled in.
// Usage: node scripts/build-rules.mjs [email]   (or set TIDELINE_OWNER_EMAIL)
// The owner is the only account that can claim a fresh workspace and become admin.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const email = (process.argv[2] ?? process.env.TIDELINE_OWNER_EMAIL ?? '').trim().toLowerCase()
if (!/^[^\s@'\\]+@[^\s@'\\]+\.[^\s@'\\]+$/.test(email)) {
  console.error('Set the workspace owner: TIDELINE_OWNER_EMAIL=you@company.com npm run deploy:rules')
  process.exit(1)
}
const rules = readFileSync('firestore.rules', 'utf8')
if (!rules.includes('__OWNER_EMAIL__')) throw new Error('firestore.rules is missing the __OWNER_EMAIL__ placeholder')
mkdirSync('.rules-build', { recursive: true })
writeFileSync('.rules-build/firestore.rules', rules.replace('__OWNER_EMAIL__', email))
console.log(`Rules built for owner ${email}`)

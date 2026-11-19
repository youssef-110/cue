import { Check, Minus } from 'lucide-react'
import type { Role } from '../lib/team'

export const ROLES: Role[] = ['admin', 'member', 'viewer']
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', member: 'Member', viewer: 'Viewer' }
export const ROLE_HINT: Record<Role, string> = {
  admin: 'Everything a member can do, plus logins, passwords and roles',
  member: 'Creates and edits boards, items, docs and automations',
  viewer: 'Reads everything and can comment, but cannot edit',
}

// What the app and firestore.rules actually enforce for each role.
const CAN: [string, Role[]][] = [
  ['See every board, item, doc and dashboard', ['admin', 'member', 'viewer']],
  ['Write updates, reply and @mention people', ['admin', 'member', 'viewer']],
  ['Create and edit boards, items, columns and views', ['admin', 'member']],
  ['Set up automations, dashboards and docs', ['admin', 'member']],
  ['Import spreadsheets, archive and delete', ['admin', 'member']],
  ['Create logins and reset passwords', ['admin']],
  ['Change roles and remove people', ['admin']],
]

export function RoleMatrix() {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <table className="w-full min-w-[520px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b-2 border-fg">
            <th className="caps h-9 px-3 text-left text-[12px] font-semibold tracking-[0.14em]">Can…</th>
            {ROLES.map((r) => (
              <th key={r} className="caps h-9 w-24 px-3 text-center text-[12px] font-semibold tracking-[0.14em]">
                {ROLE_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAN.map(([what, who]) => (
            <tr key={what} className="border-b border-line last:border-0">
              <td className="px-3 py-2">{what}</td>
              {ROLES.map((r) => (
                <td key={r} className="px-3 py-2 text-center">
                  {who.includes(r) ? <Check aria-label="Yes" className="mx-auto size-4" /> : <Minus aria-label="No" className="mx-auto size-4 text-faint" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

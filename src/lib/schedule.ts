// Date maths for recurring rules, kept free of the store so it can be tested on its own.
import { addDays, format, startOfWeek } from 'date-fns'

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Mon-Fri still to come in the work week a rule fills: this week, or next week when run at the weekend. */
export function weekdaysToCreate(now = new Date()) {
  const weekend = now.getDay() === 0 || now.getDay() === 6
  const monday = startOfWeek(weekend ? addDays(now, 7) : now, { weekStartsOn: 1 })
  const days = [0, 1, 2, 3, 4].map((i) => iso(addDays(monday, i))).filter((d) => d >= iso(now))
  return { period: 'wd:' + iso(monday), days } // 'wd:' keeps weekday periods apart from the weekly rule's
}

/**
 * The item a recurring rule makes for one slot (a day, or a week's Monday). The id is fixed, so open tabs that
 * disagree about the rule's lastPeriod (two people at once, or an old app version) still can't make it twice.
 */
export const scheduledItemId = (ruleId: string, slot: string) => `i_${ruleId}_${slot}`

/** Slots whose item doesn't exist yet. A trashed item still exists, so deleting one doesn't bring it back. */
export const slotsToCreate = (ruleId: string, slots: string[], exists: (itemId: string) => boolean) =>
  slots.filter((s) => !exists(scheduledItemId(ruleId, s)))

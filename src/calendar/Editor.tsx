import { useState, type ReactNode } from 'react'
import { MapPin, Pencil, Repeat, Text, Trash2, X } from 'lucide-react'
import { addDays, dayDiff, repeatText, wallDiff, weekday, shiftWall, type Occ } from '../lib/calendar'
import type { CalEvent, User } from '../lib/types'
import { Modal } from '../components/TemplateModal'
import { Avatar, Button, Popover, cx } from '../components/ui'
import { whenText } from './parts'

const FIELD = 'h-8 rounded-md border border-line-strong bg-panel px-2.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-faint focus:border-accent'
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Read-only card for an event: when, how it repeats, where, notes, whose. Owners get Edit and Delete. */
export function EventDetails({
  occ,
  anchor,
  color,
  owner,
  editable,
  zoneNote,
  onClose,
  onEdit,
  onDelete,
}: {
  occ: Occ | null
  anchor: HTMLElement | null
  color: string
  owner?: User
  editable: boolean
  zoneNote?: string
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const ev = occ?.ev
  return (
    <Popover anchor={anchor} open={!!occ} onClose={onClose} width={340} align="center" className="!p-0">
      {ev && occ && (
        <div
          className="p-4"
          onKeyDown={(e) => {
            if (!editable || (e.target as HTMLElement).tagName === 'INPUT') return
            const run = e.key === 'Delete' || e.key === 'Backspace' ? onDelete : e.key.toLowerCase() === 'e' ? onEdit : null
            if (!run) return
            e.preventDefault()
            run()
          }}
        >
          <div className="-mr-2 -mt-2 flex items-center justify-end gap-0.5">
            {editable && (
              <>
                <IconBtn label="Edit event (E)" onClick={onEdit} autoFocus>
                  <Pencil />
                </IconBtn>
                <IconBtn label="Delete event (Delete)" onClick={onDelete} danger>
                  <Trash2 />
                </IconBtn>
              </>
            )}
            <IconBtn label="Close" onClick={onClose} autoFocus={!editable}>
              <X />
            </IconBtn>
          </div>
          <div className="flex gap-3">
            <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-[3px]" style={{ background: color }} />
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-[18px] font-semibold leading-snug">{ev.title}</h3>
              <p className="mt-1 font-mono text-[12.5px] font-medium uppercase text-muted">{whenText(occ, ev.allDay)}</p>
              {zoneNote && <p className="mt-0.5 font-mono text-[11px] text-faint">{zoneNote}</p>}
            </div>
          </div>
          <div className="mt-3 space-y-2 pl-6 text-[13.5px]">
            {!!ev.repeat?.days.length && <Line icon={<Repeat />}>{repeatText(ev.repeat)}</Line>}
            {ev.location && <Line icon={<MapPin />}>{ev.location}</Line>}
            {ev.notes && (
              <Line icon={<Text />}>
                <span className="whitespace-pre-wrap break-words">{ev.notes}</span>
              </Line>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[13px] text-muted">
            <Avatar user={owner} size={22} />
            <span className="min-w-0 flex-1 truncate">{editable ? 'Your calendar' : `${owner?.name ?? 'Someone'}’s calendar`}</span>
            {!editable && <span className="caps shrink-0 text-[11px] font-semibold tracking-[0.1em] text-faint">View only</span>}
          </div>
        </div>
      )}
    </Popover>
  )
}

const Line = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <p className="-ml-6 flex gap-2 text-fg [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-faint">
    {icon}
    <span className="min-w-0 flex-1">{children}</span>
  </p>
)

function IconBtn({ label, onClick, children, danger, autoFocus }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean; autoFocus?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      autoFocus={autoFocus}
      className={cx('grid size-8 place-items-center rounded-md text-muted transition-colors [&>svg]:size-4', danger ? 'hover:bg-alert-soft hover:text-alert' : 'hover:bg-hover hover:text-fg')}
    >
      {children}
    </button>
  )
}

/** Create or edit: title, when (or all day), weekly repeat, place and notes. Works in the viewer's wall time. */
export function EventEditor({ draft, isNew, onSave, onClose }: { draft: CalEvent; isNew: boolean; onSave: (e: CalEvent) => void; onClose: () => void }) {
  const [e, setE] = useState(draft)
  const set = (patch: Partial<CalEvent>) => setE({ ...e, ...patch })
  const date = (w: string) => w.slice(0, 10)
  const time = (w: string) => w.slice(11, 16)
  const days = e.repeat?.days ?? []
  const tooLong = dayDiff(e.end, e.start) > 62 // the rules cap an event at 62 days
  const bad = e.end < e.start || tooLong
  const save = () => !bad && onSave(e)

  // moving the start keeps the length, like a calendar should
  const setStart = (start: string) => set({ start, end: e.allDay ? addDays(start, dayDiff(e.end, e.start)) + 'T23:59' : shiftWall(start, wallDiff(e.end, e.start)) })
  const toggleAllDay = (allDay: boolean) =>
    set(allDay ? { allDay, start: date(e.start) + 'T00:00', end: date(e.end) + 'T23:59' } : { allDay: undefined, start: date(e.start) + 'T09:00', end: date(e.start) + 'T10:00' })

  return (
    <Modal open onClose={onClose} width={520} title={isNew ? 'New event' : 'Edit event'}>
      <form
        className="space-y-4 p-6"
        onSubmit={(ev) => (ev.preventDefault(), save())}
        onKeyDown={(ev) => ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && (ev.preventDefault(), save())}
      >
        <input
          autoFocus
          value={e.title}
          onChange={(ev) => set({ title: ev.target.value })}
          placeholder="Add title"
          aria-label="Title"
          maxLength={200}
          className="h-11 w-full border-b-2 border-line-strong bg-transparent text-[20px] font-semibold text-fg outline-none transition-colors placeholder:font-normal placeholder:text-faint focus:border-accent"
        />

        <fieldset className="space-y-2">
          <legend className="sr-only">When</legend>
          <Row label="Starts">
            <input type="date" required aria-label="Start date" value={date(e.start)} onChange={(ev) => ev.target.value && setStart(ev.target.value + e.start.slice(10))} className={cx(FIELD, 'font-mono')} />
            {!e.allDay && (
              <input type="time" required step={900} aria-label="Start time" value={time(e.start)} onChange={(ev) => ev.target.value && setStart(date(e.start) + 'T' + ev.target.value)} className={cx(FIELD, 'font-mono')} />
            )}
          </Row>
          <Row label="Ends">
            <input
              type="date"
              required
              aria-label="End date"
              value={date(e.end)}
              onChange={(ev) => ev.target.value && set({ end: ev.target.value + e.end.slice(10) })}
              className={cx(FIELD, 'font-mono', bad && '!border-alert')}
            />
            {!e.allDay && (
              <input
                type="time"
                required
                step={900}
                aria-label="End time"
                value={time(e.end)}
                onChange={(ev) => ev.target.value && set({ end: date(e.end) + 'T' + ev.target.value })}
                className={cx(FIELD, 'font-mono', bad && '!border-alert')}
              />
            )}
          </Row>
          {bad && <p className="pl-[76px] text-[12.5px] text-alert">{tooLong ? 'An event can last up to 62 days.' : 'The event ends before it starts.'}</p>}
          <Row label="">
            <label className="flex h-8 items-center gap-2 text-[13.5px]">
              <input type="checkbox" checked={!!e.allDay} onChange={(ev) => toggleAllDay(ev.target.checked)} className="size-4" />
              All day
            </label>
          </Row>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="sr-only">Repeat</legend>
          <Row label="Repeat">
            <select
              aria-label="Repeat"
              value={days.length ? 'weekly' : 'none'}
              onChange={(ev) => set({ repeat: ev.target.value === 'weekly' ? { days: [weekday(e.start)] } : undefined })}
              className={cx(FIELD, 'pr-7')}
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly</option>
            </select>
          </Row>
          {!!days.length && (
            <>
              <Row label="On">
                <div role="group" aria-label="Repeat on" className="flex gap-1">
                  {WEEK.map((d) => {
                    const on = days.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={NAME[d]}
                        title={NAME[d]}
                        onClick={() => {
                          const next = on ? days.filter((x) => x !== d) : [...days, d].sort()
                          if (next.length) set({ repeat: { ...e.repeat, days: next } })
                        }}
                        className={cx(
                          'grid size-8 place-items-center rounded-md border font-mono text-[12px] font-semibold transition-colors',
                          on ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-panel text-muted hover:bg-hover',
                        )}
                      >
                        {LETTER[d]}
                      </button>
                    )
                  })}
                </div>
              </Row>
              <Row label="Until">
                <input
                  type="date"
                  aria-label="Repeat until (optional)"
                  value={e.repeat?.until ?? ''}
                  min={date(e.start)}
                  onChange={(ev) => set({ repeat: { days, until: ev.target.value || undefined } })}
                  className={cx(FIELD, 'font-mono')}
                />
                <span className="text-[12.5px] text-faint">{e.repeat?.until ? '' : 'No end date'}</span>
              </Row>
            </>
          )}
        </fieldset>

        <Row label="Where">
          <input value={e.location ?? ''} onChange={(ev) => set({ location: ev.target.value || undefined })} placeholder="Add a place or a meeting link" aria-label="Location" className={cx(FIELD, 'flex-1')} />
        </Row>
        <Row label="Notes" top>
          <textarea
            value={e.notes ?? ''}
            onChange={(ev) => set({ notes: ev.target.value || undefined })}
            placeholder="Add notes"
            aria-label="Notes"
            rows={3}
            className={cx(FIELD, 'h-auto flex-1 resize-y py-1.5 leading-relaxed')}
          />
        </Row>

        <div className="flex items-center gap-2 border-t border-line pt-4">
          <span className="mr-auto font-mono text-[11px] text-faint">Ctrl Enter to save</span>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={bad}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Row({ label, children, top }: { label: string; children: ReactNode; top?: boolean }) {
  return (
    <div className={cx('flex gap-2', top ? 'items-start' : 'items-center')}>
      <span className={cx('caps w-[68px] shrink-0 text-[12px] font-semibold tracking-[0.1em] text-muted', top && 'pt-2')}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** "This event or all events?" for changes to a repeating event. */
export function AskSeries({ ask, onAnswer }: { ask: { verb: string } | null; onAnswer: (choice: 'this' | 'all' | null) => void }) {
  return (
    <Modal open={!!ask} onClose={() => onAnswer(null)} width={380} title={ask ? `${ask.verb} repeating event` : undefined}>
      <div className="p-6">
        <p className="text-[14px] text-muted">This event repeats. {ask?.verb} only this date, or every date in the series?</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" autoFocus onClick={() => onAnswer('this')}>
            This event
          </Button>
          <Button variant="outline" onClick={() => onAnswer('all')}>
            All events
          </Button>
          <Button variant="ghost" onClick={() => onAnswer(null)}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}

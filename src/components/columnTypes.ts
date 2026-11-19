import { AlignLeft, Calendar, ChartGantt, CircleDot, Flag, Gauge, Hash, Link, SquareCheck, Star, Tags, Type, Users, type LucideIcon } from 'lucide-react'
import type { Column } from '../lib/types'

export const COLUMN_TYPES: { type: Column['type']; label: string; icon: LucideIcon; color: string }[] = [
  { type: 'status', label: 'Status', icon: CircleDot, color: '#00b884' },
  { type: 'people', label: 'People', icon: Users, color: '#3b9bff' },
  { type: 'date', label: 'Date', icon: Calendar, color: '#9a5cf5' },
  { type: 'timeline', label: 'Timeline', icon: ChartGantt, color: '#5b5bf0' },
  { type: 'priority', label: 'Priority', icon: Flag, color: '#f0475a' },
  { type: 'text', label: 'Text', icon: Type, color: '#8a93a6' },
  { type: 'longtext', label: 'Long text', icon: AlignLeft, color: '#3d4458' },
  { type: 'number', label: 'Numbers', icon: Hash, color: '#f7b500' },
  { type: 'tags', label: 'Tags', icon: Tags, color: '#ec4f9a' },
  { type: 'checkbox', label: 'Checkbox', icon: SquareCheck, color: '#00b884' },
  { type: 'link', label: 'Link', icon: Link, color: '#14b8c4' },
  { type: 'rating', label: 'Rating', icon: Star, color: '#ff8a3d' },
  { type: 'progress', label: 'Progress', icon: Gauge, color: '#8ac926' },
]

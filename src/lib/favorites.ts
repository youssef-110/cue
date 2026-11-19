import { useSyncExternalStore } from 'react'

// Favorites are personal, so they live in this browser only.
const KEY = 'tideline:favorites'
const listeners = new Set<() => void>()
let cache: string[] = read()
function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
function toggle(id: string) {
  cache = cache.includes(id) ? cache.filter((x) => x !== id) : [...cache, id]
  localStorage.setItem(KEY, JSON.stringify(cache))
  listeners.forEach((l) => l())
}
export function useFavorites(): [string[], (id: string) => void] {
  const favs = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => cache,
  )
  return [favs, toggle]
}

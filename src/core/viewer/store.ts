/** Minimal observable value. Each `set` produces a new object and notifies synchronously. */
export interface Store<T extends object> {
  get(): T
  set(patch: Partial<T> | ((prev: T) => Partial<T>)): T
  subscribe(listener: (value: T) => void): () => void
}

export function createStore<T extends object>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<(value: T) => void>()
  return {
    get: () => value,
    set(patch) {
      const p = typeof patch === 'function' ? patch(value) : patch
      value = { ...value, ...p }
      for (const l of [...listeners]) l(value)
      return value
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

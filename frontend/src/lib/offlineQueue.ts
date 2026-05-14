const QUEUE_KEY = 'pulsesync:pending-patients'

export interface PendingPatient {
  id: string
  payload: Record<string, unknown>
  label: string
  registrationType: 'newborn' | 'existing'
  queuedAt: string
  attempts: number
}

function load(): PendingPatient[] {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as PendingPatient[]
    // Back-compat: older queued items may not have attempts
    return raw.map((item) => ({ ...item, attempts: item.attempts ?? 0 }))
  } catch {
    return []
  }
}

function save(items: PendingPatient[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

export function enqueue(payload: Record<string, unknown>): void {
  const id = crypto.randomUUID()
  const label = (payload.full_name as string | undefined) ?? 'Unknown patient'
  const registrationType =
    (payload.registration_type as 'newborn' | 'existing' | undefined) ?? 'existing'
  const items = load()
  items.push({ id, payload, label, registrationType, queuedAt: new Date().toISOString(), attempts: 0 })
  save(items)
  window.dispatchEvent(new CustomEvent('pwa:patient-enqueued'))
}

export function incrementAttempts(id: string): void {
  const items = load().map((item) =>
    item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
  )
  save(items)
}

export function removePending(id: string): void {
  save(load().filter((item) => item.id !== id))
}

export function removePendingAndNotify(id: string): void {
  removePending(id)
  window.dispatchEvent(new CustomEvent('pwa:patient-enqueued'))
}

export function getPending(): PendingPatient[] {
  return load()
}

export function pendingCount(): number {
  return load().length
}

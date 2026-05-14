const QUEUE_KEY = 'pulsesync:pending-patients'

export interface PendingPatient {
  id: string
  payload: Record<string, unknown>
  label: string
  registrationType: 'newborn' | 'existing'
  queuedAt: string
}

function load(): PendingPatient[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
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
  items.push({ id, payload, label, registrationType, queuedAt: new Date().toISOString() })
  save(items)
}

export function getPending(): PendingPatient[] {
  return load()
}

export function removePending(id: string): void {
  save(load().filter((item) => item.id !== id))
}

export function pendingCount(): number {
  return load().length
}

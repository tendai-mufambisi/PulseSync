/**
 * Tests for the offline patient queue (lib/offlineQueue.ts).
 *
 * The queue is the backbone of PulseSync's offline write support.
 * When a nurse registers a patient without internet, the payload is
 * saved here and auto-synced when connectivity is restored.
 *
 * All state lives in localStorage under the key 'pulsesync:pending-patients'.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  enqueue,
  getPending,
  pendingCount,
  incrementAttempts,
  removePending,
  removePendingAndNotify,
} from './offlineQueue'

const SAMPLE_PAYLOAD = {
  full_name: 'Tawana Mabaya',
  national_id: '63-2400679R42',
  date_of_birth: '1990-05-15',
  gender: 'male',
  blood_type: 'O+',
  registration_type: 'existing',
}

const NEWBORN_PAYLOAD = {
  full_name: 'Baby Moyo',
  date_of_birth: '2026-05-15',
  gender: 'female',
  blood_type: 'unknown',
  registration_type: 'newborn',
}

// Clear localStorage before each test so tests are fully isolated.
beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

describe('enqueue', () => {
  it('adds a patient to the queue', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(getPending()).toHaveLength(1)
  })

  it('assigns a unique UUID to each queued item', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue({ ...NEWBORN_PAYLOAD })
    const ids = getPending().map((p) => p.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('uses the full_name field as the display label', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(getPending()[0].label).toBe('Tawana Mabaya')
  })

  it('falls back to "Unknown patient" when full_name is missing', () => {
    enqueue({ date_of_birth: '2026-01-01', gender: 'female' })
    expect(getPending()[0].label).toBe('Unknown patient')
  })

  it('stores the registrationType correctly for existing patients', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(getPending()[0].registrationType).toBe('existing')
  })

  it('stores the registrationType correctly for newborns', () => {
    enqueue(NEWBORN_PAYLOAD)
    expect(getPending()[0].registrationType).toBe('newborn')
  })

  it('initialises the attempt counter at zero', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(getPending()[0].attempts).toBe(0)
  })

  it('records a queuedAt ISO timestamp', () => {
    const before = new Date().toISOString()
    enqueue(SAMPLE_PAYLOAD)
    const after = new Date().toISOString()
    const { queuedAt } = getPending()[0]
    expect(queuedAt >= before).toBe(true)
    expect(queuedAt <= after).toBe(true)
  })

  it('stores the full payload so the sync can POST it verbatim', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(getPending()[0].payload).toMatchObject(SAMPLE_PAYLOAD)
  })

  it('dispatches a pwa:patient-enqueued DOM event', () => {
    const handler = vi.fn()
    window.addEventListener('pwa:patient-enqueued', handler)
    enqueue(SAMPLE_PAYLOAD)
    window.removeEventListener('pwa:patient-enqueued', handler)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('persists across a simulated page reload (re-read from localStorage)', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue(NEWBORN_PAYLOAD)
    // Simulate reading from storage as if the page was refreshed
    const fromStorage = JSON.parse(
      localStorage.getItem('pulsesync:pending-patients') ?? '[]',
    )
    expect(fromStorage).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// getPending
// ---------------------------------------------------------------------------

describe('getPending', () => {
  it('returns an empty array when the queue is empty', () => {
    expect(getPending()).toEqual([])
  })

  it('returns all queued items in insertion order', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue(NEWBORN_PAYLOAD)
    const labels = getPending().map((p) => p.label)
    expect(labels).toEqual(['Tawana Mabaya', 'Baby Moyo'])
  })

  it('back-fills attempts to 0 for legacy items that lack the field', () => {
    // Simulate an old queue entry without the attempts field
    const legacyItem = {
      id: 'legacy-uuid',
      payload: SAMPLE_PAYLOAD,
      label: 'Legacy Patient',
      registrationType: 'existing',
      queuedAt: new Date().toISOString(),
      // deliberately omit attempts
    }
    localStorage.setItem(
      'pulsesync:pending-patients',
      JSON.stringify([legacyItem]),
    )
    expect(getPending()[0].attempts).toBe(0)
  })

  it('returns an empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem('pulsesync:pending-patients', '{broken json}')
    expect(getPending()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// pendingCount
// ---------------------------------------------------------------------------

describe('pendingCount', () => {
  it('returns 0 when the queue is empty', () => {
    expect(pendingCount()).toBe(0)
  })

  it('returns the correct count after enqueueing multiple patients', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue(NEWBORN_PAYLOAD)
    expect(pendingCount()).toBe(2)
  })

  it('decrements after a patient is removed', () => {
    enqueue(SAMPLE_PAYLOAD)
    const id = getPending()[0].id
    removePending(id)
    expect(pendingCount()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// incrementAttempts
// ---------------------------------------------------------------------------

describe('incrementAttempts', () => {
  it('increments the attempt counter by 1 each call', () => {
    enqueue(SAMPLE_PAYLOAD)
    const id = getPending()[0].id

    incrementAttempts(id)
    expect(getPending()[0].attempts).toBe(1)

    incrementAttempts(id)
    expect(getPending()[0].attempts).toBe(2)
  })

  it('only affects the targeted item when multiple are queued', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue(NEWBORN_PAYLOAD)
    const [first, second] = getPending()

    incrementAttempts(first.id)
    const updated = getPending()
    expect(updated.find((p) => p.id === first.id)!.attempts).toBe(1)
    expect(updated.find((p) => p.id === second.id)!.attempts).toBe(0)
  })

  it('is a no-op for an id that does not exist', () => {
    enqueue(SAMPLE_PAYLOAD)
    expect(() => incrementAttempts('non-existent-id')).not.toThrow()
    expect(getPending()[0].attempts).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// removePending
// ---------------------------------------------------------------------------

describe('removePending', () => {
  it('removes the item with the given id', () => {
    enqueue(SAMPLE_PAYLOAD)
    const id = getPending()[0].id
    removePending(id)
    expect(getPending()).toHaveLength(0)
  })

  it('leaves other items intact when one is removed', () => {
    enqueue(SAMPLE_PAYLOAD)
    enqueue(NEWBORN_PAYLOAD)
    const [first] = getPending()
    removePending(first.id)
    expect(getPending()).toHaveLength(1)
    expect(getPending()[0].label).toBe('Baby Moyo')
  })

  it('is a no-op when given a non-existent id', () => {
    enqueue(SAMPLE_PAYLOAD)
    removePending('ghost-id')
    expect(getPending()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// removePendingAndNotify
// ---------------------------------------------------------------------------

describe('removePendingAndNotify', () => {
  it('removes the item from the queue', () => {
    enqueue(SAMPLE_PAYLOAD)
    const id = getPending()[0].id
    removePendingAndNotify(id)
    expect(getPending()).toHaveLength(0)
  })

  it('dispatches a pwa:patient-enqueued event after removal', () => {
    enqueue(SAMPLE_PAYLOAD)
    const id = getPending()[0].id

    const handler = vi.fn()
    window.addEventListener('pwa:patient-enqueued', handler)
    removePendingAndNotify(id)
    window.removeEventListener('pwa:patient-enqueued', handler)

    expect(handler).toHaveBeenCalledOnce()
  })
})

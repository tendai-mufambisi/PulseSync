import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react'
import { authedRoute } from './_authed'
import { useAuth } from '../hooks/useAuth'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Baby, UserRound, WifiOff } from 'lucide-react'
import api from '../lib/api'
import { enqueue } from '../lib/offlineQueue'
import { Spinner } from '../components/States'

export const registerRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/register',
  component: RegisterPatientPage,
})

// ── Constants ─────────────────────────────────────────────────────────────────

const ZIM_ID_RE = /^\d{2}-\d{7}[A-Za-z]\d{2}$/
const ZIM_ID_ERROR = 'Format must be DD-NNNNNNNLCC (e.g. 63-2400679R42)'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'select' | 'newborn' | 'existing'

interface EmergencyContactFields {
  next_of_kin_name: string
  next_of_kin_relationship: string
  next_of_kin_phone: string
  next_of_kin_alt_phone: string
  emergency_contact_2_name: string
  emergency_contact_2_phone: string
  emergency_contact_3_name: string
  emergency_contact_3_phone: string
}

interface NewbornFormData extends EmergencyContactFields {
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  // Guardian (required for newborns)
  guardian_name: string
  guardian_relationship: string
  guardian_national_id: string
  guardian_contact: string
  // Birth event fields — sent flat, backend creates HealthEvent automatically
  birth_weight_kg: string
  delivery_type: string
  gestational_age_weeks: string
  birth_complications: string
  apgar_score: string
  initial_observations: string
  // Medical baseline
  allergies: string
  notes: string
}

interface ExistingFormData extends EmergencyContactFields {
  national_id: string
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  hiv_status: string
  // Historical baseline
  allergies: string
  critical_conditions: string
  chronic_conditions: string
  past_surgeries: string
  existing_medications: string
  notes: string
  emergency_contact: string
}

const EMPTY_NEWBORN: NewbornFormData = {
  full_name: '',
  date_of_birth: '',
  gender: 'female',
  blood_type: 'unknown',
  guardian_name: '',
  guardian_relationship: '',
  guardian_national_id: '',
  guardian_contact: '',
  birth_weight_kg: '',
  delivery_type: '',
  gestational_age_weeks: '',
  birth_complications: '',
  apgar_score: '',
  initial_observations: '',
  allergies: '',
  notes: '',
  next_of_kin_name: '',
  next_of_kin_relationship: '',
  next_of_kin_phone: '',
  next_of_kin_alt_phone: '',
  emergency_contact_2_name: '',
  emergency_contact_2_phone: '',
  emergency_contact_3_name: '',
  emergency_contact_3_phone: '',
}

const EMPTY_EXISTING: ExistingFormData = {
  national_id: '',
  full_name: '',
  date_of_birth: '',
  gender: 'female',
  blood_type: 'unknown',
  hiv_status: '',
  allergies: '',
  critical_conditions: '',
  chronic_conditions: '',
  past_surgeries: '',
  existing_medications: '',
  notes: '',
  emergency_contact: '',
  next_of_kin_name: '',
  next_of_kin_relationship: '',
  next_of_kin_phone: '',
  next_of_kin_alt_phone: '',
  emergency_contact_2_name: '',
  emergency_contact_2_phone: '',
  emergency_contact_3_name: '',
  emergency_contact_3_phone: '',
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function toNum(s: string): number | null {
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function toInt(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

function extractApiError(err: unknown): string {
  const d = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!d) return 'Failed to register patient.'
  const candidates = [
    d.detail,
    (d.non_field_errors as string[] | undefined)?.[0],
    (d.national_id as string[] | undefined)?.[0],
    (d.guardian_name as string[] | undefined)?.[0],
    (d.next_of_kin_name as string[] | undefined)?.[0],
    (d.full_name as string[] | undefined)?.[0],
    (d.date_of_birth as string[] | undefined)?.[0],
  ]
  for (const c of candidates) {
    if (c) return String(c)
  }
  for (const val of Object.values(d)) {
    if (val) return Array.isArray(val) ? String(val[0]) : String(val)
  }
  return 'Failed to register patient.'
}

// ── Shared field components ───────────────────────────────────────────────────

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  )
}

function EmergencyContactsSection({
  data,
  onChange,
  requireNextOfKin = true,
}: {
  data: EmergencyContactFields
  onChange: (field: keyof EmergencyContactFields, value: string) => void
  requireNextOfKin?: boolean
}) {
  const ch = (field: keyof EmergencyContactFields) =>
    (e: ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value)

  return (
    <SectionCard title="Next of Kin &amp; Emergency Contacts">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <p className="text-xs text-slate-500 sm:col-span-2">
          Primary next of kin (required for emergency response)
        </p>
        <Field label={requireNextOfKin ? 'Full Name *' : 'Full Name'}>
          <input
            type="text"
            required={requireNextOfKin}
            value={data.next_of_kin_name}
            onChange={ch('next_of_kin_name')}
            className="input"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label={requireNextOfKin ? 'Relationship *' : 'Relationship'}>
          <input
            type="text"
            required={requireNextOfKin}
            value={data.next_of_kin_relationship}
            onChange={ch('next_of_kin_relationship')}
            className="input"
            placeholder="Spouse, Parent, Sibling…"
          />
        </Field>
        <Field label={requireNextOfKin ? 'Phone *' : 'Phone'}>
          <input
            type="tel"
            required={requireNextOfKin}
            value={data.next_of_kin_phone}
            onChange={ch('next_of_kin_phone')}
            className="input"
            placeholder="+263 7X XXX XXXX"
          />
        </Field>
        <Field label="Alternate Phone">
          <input
            type="tel"
            value={data.next_of_kin_alt_phone}
            onChange={ch('next_of_kin_alt_phone')}
            className="input"
            placeholder="+263 7X XXX XXXX"
          />
        </Field>

        <div className="mt-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <p className="text-xs text-slate-500">Additional emergency contacts (optional)</p>
        </div>
        <Field label="Contact 2 — Name">
          <input type="text" value={data.emergency_contact_2_name} onChange={ch('emergency_contact_2_name')} className="input" />
        </Field>
        <Field label="Contact 2 — Phone">
          <input type="tel" value={data.emergency_contact_2_phone} onChange={ch('emergency_contact_2_phone')} className="input" />
        </Field>
        <Field label="Contact 3 — Name">
          <input type="text" value={data.emergency_contact_3_name} onChange={ch('emergency_contact_3_name')} className="input" />
        </Field>
        <Field label="Contact 3 — Phone">
          <input type="tel" value={data.emergency_contact_3_phone} onChange={ch('emergency_contact_3_phone')} className="input" />
        </Field>
      </div>
    </SectionCard>
  )
}

function FormActions({
  isPending,
  label,
  onCancel,
}: {
  isPending: boolean
  label: string
  onCancel: () => void
}) {
  return (
    <div className="flex justify-end gap-3 pb-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {isPending && <Spinner size={16} />}
        {label}
      </button>
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

function RegisterPatientPage() {
  const { hasRole } = useAuth()
  const [step, setStep] = useState<Step>('select')

  if (!hasRole('system_admin', 'hospital_admin', 'nurse', 'doctor')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        You do not have permission to register patients.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step === 'select' && <TypeSelector onSelect={setStep} />}
      {step === 'newborn' && <NewbornForm onBack={() => setStep('select')} />}
      {step === 'existing' && <ExistingPersonForm onBack={() => setStep('select')} />}
    </div>
  )
}

// ── Offline saved confirmation ────────────────────────────────────────────────

function OfflineSavedConfirmation({
  patientName,
  onRegisterAnother,
}: {
  patientName: string
  onRegisterAnother: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
        <WifiOff size={28} className="text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">Saved for sync</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        <strong className="text-slate-700">{patientName || 'This patient'}</strong> has been saved
        locally. Their record will be registered automatically the moment you reconnect to the
        internet.
      </p>
      <p className="mt-2 text-xs text-slate-400">
        You can safely close the app — the record won't be lost.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onRegisterAnother}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Register another
        </button>
        <button
          onClick={() => navigate({ to: '/patients' })}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Go to patients
        </button>
      </div>
    </div>
  )
}

// ── Step 1: Type selector ─────────────────────────────────────────────────────

function TypeSelector({ onSelect }: { onSelect: (step: Step) => void }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900">Register New Patient</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select how this patient is entering the system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Newborn card */}
        <button
          onClick={() => onSelect('newborn')}
          className="card group flex flex-col items-start gap-4 p-6 text-left transition hover:border-sky-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-100">
            <Baby size={24} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Register Newborn</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              For patients entering the system at birth. Captures birth details, guardian
              information, and automatically creates the first health timeline event.
            </p>
          </div>
          <span className="mt-auto text-sm font-medium text-sky-600 group-hover:underline">
            Select →
          </span>
        </button>

        {/* Existing person card */}
        <button
          onClick={() => onSelect('existing')}
          className="card group flex flex-col items-start gap-4 p-6 text-left transition hover:border-sky-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-100">
            <UserRound size={24} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Register Existing Individual</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              For patients already existing who are joining PulseSync for the first time.
              Establishes their identity and records a medical history baseline.
            </p>
          </div>
          <span className="mt-auto text-sm font-medium text-sky-600 group-hover:underline">
            Select →
          </span>
        </button>
      </div>
    </div>
  )
}

// ── Step 2a: Newborn form ─────────────────────────────────────────────────────

function NewbornForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<NewbornFormData>(EMPTY_NEWBORN)
  const [apiError, setApiError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)

  const set = useCallback(
    (field: keyof NewbornFormData) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  )

  const setContact = (field: keyof EmergencyContactFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const mutation = useMutation({
    mutationFn: (data: object) => api.post('/patients/', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate({ to: '/patients/$patientId', params: { patientId: res.data.id } })
    },
    onError: (err, variables) => {
      const isNetworkError = !(err as { response?: unknown }).response
      if (isNetworkError) {
        enqueue(variables as Record<string, unknown>)
        setSavedOffline(true)
      } else {
        setApiError(extractApiError(err))
      }
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setApiError('')
    const payload: Record<string, unknown> = {
      registration_type: 'newborn',
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      blood_type: form.blood_type,
      allergies: form.allergies,
      notes: form.notes,
      guardian_name: form.guardian_name,
      guardian_relationship: form.guardian_relationship,
      guardian_national_id: form.guardian_national_id,
      guardian_contact: form.guardian_contact,
      birth_weight_kg: toNum(form.birth_weight_kg),
      delivery_type: form.delivery_type || undefined,
      gestational_age_weeks: toInt(form.gestational_age_weeks),
      birth_complications: form.birth_complications,
      apgar_score: toInt(form.apgar_score),
      initial_observations: form.initial_observations,
      next_of_kin_name: form.next_of_kin_name,
      next_of_kin_relationship: form.next_of_kin_relationship,
      next_of_kin_phone: form.next_of_kin_phone,
      next_of_kin_alt_phone: form.next_of_kin_alt_phone,
      emergency_contact_2_name: form.emergency_contact_2_name,
      emergency_contact_2_phone: form.emergency_contact_2_phone,
      emergency_contact_3_name: form.emergency_contact_3_name,
      emergency_contact_3_phone: form.emergency_contact_3_phone,
    }
    if (!navigator.onLine) {
      enqueue(payload)
      setSavedOffline(true)
      return
    }
    mutation.mutate(payload)
  }

  if (savedOffline) {
    return (
      <OfflineSavedConfirmation
        patientName={form.full_name}
        onRegisterAnother={() => { setSavedOffline(false); setForm(EMPTY_NEWBORN) }}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Back to registration type"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Register Newborn</h1>
          <p className="text-sm text-slate-500">
            A birth health event will be created automatically from the birth details below.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Baby Information ──────────────────────────────────────── */}
        <SectionCard title="Baby Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full Name *" span>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={set('full_name')}
                className="input"
                placeholder="e.g. Baby Moyo (can be updated later)"
              />
            </Field>
            <Field label="Date of Birth *">
              <input
                type="date"
                required
                value={form.date_of_birth}
                onChange={set('date_of_birth')}
                className="input"
              />
            </Field>
            <Field label="Gender *">
              <select required value={form.gender} onChange={set('gender')} className="input">
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other / Undetermined</option>
              </select>
            </Field>
            <Field label="Blood Type">
              <select value={form.blood_type} onChange={set('blood_type')} className="input">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'].map((t) => (
                  <option key={t} value={t}>{t === 'unknown' ? 'Unknown' : t}</option>
                ))}
              </select>
            </Field>
          </div>
        </SectionCard>

        {/* ── Birth Details ─────────────────────────────────────────── */}
        <SectionCard title="Birth Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Birth Weight (kg)">
              <input
                type="number"
                step="0.001"
                min="0.3"
                max="8"
                value={form.birth_weight_kg}
                onChange={set('birth_weight_kg')}
                className="input"
                placeholder="e.g. 3.200"
              />
            </Field>
            <Field label="Delivery Type">
              <select value={form.delivery_type} onChange={set('delivery_type')} className="input">
                <option value="">— Select —</option>
                <option value="normal">Normal Vaginal Delivery</option>
                <option value="cesarean">Cesarean Section</option>
                <option value="assisted">Assisted Delivery</option>
              </select>
            </Field>
            <Field label="Gestational Age (weeks)">
              <input
                type="number"
                min="20"
                max="45"
                value={form.gestational_age_weeks}
                onChange={set('gestational_age_weeks')}
                className="input"
                placeholder="e.g. 39"
              />
            </Field>
            <Field label="APGAR Score (0–10)">
              <input
                type="number"
                min="0"
                max="10"
                value={form.apgar_score}
                onChange={set('apgar_score')}
                className="input"
                placeholder="e.g. 8"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Birth Notes ───────────────────────────────────────────── */}
        <SectionCard title="Birth Notes">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Birth Complications">
              <textarea
                rows={3}
                value={form.birth_complications}
                onChange={set('birth_complications')}
                className="input resize-none"
                placeholder="Any complications during labour or delivery…"
              />
            </Field>
            <Field label="Initial Observations">
              <textarea
                rows={3}
                value={form.initial_observations}
                onChange={set('initial_observations')}
                className="input resize-none"
                placeholder="Clinician's initial observations at birth…"
              />
            </Field>
            <Field label="Known Allergies">
              <textarea
                rows={2}
                value={form.allergies}
                onChange={set('allergies')}
                className="input resize-none"
                placeholder="Any known allergies or sensitivities…"
              />
            </Field>
            <Field label="Additional Notes">
              <textarea
                rows={2}
                value={form.notes}
                onChange={set('notes')}
                className="input resize-none"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Guardian Information ──────────────────────────────────── */}
        <SectionCard title="Guardian Information">
          <p className="mb-4 text-xs text-slate-500">
            The guardian is the responsible party for this newborn's care and will act as the
            primary emergency contact.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Guardian Full Name *">
              <input
                type="text"
                required
                value={form.guardian_name}
                onChange={set('guardian_name')}
                className="input"
                placeholder="Full name of mother, father, or legal guardian"
              />
            </Field>
            <Field label="Relationship to Baby *">
              <input
                type="text"
                required
                value={form.guardian_relationship}
                onChange={set('guardian_relationship')}
                className="input"
                placeholder="Mother, Father, Legal Guardian…"
              />
            </Field>
            <Field label="Guardian Contact Number *">
              <input
                type="tel"
                required
                value={form.guardian_contact}
                onChange={set('guardian_contact')}
                className="input"
                placeholder="+263 7X XXX XXXX"
              />
            </Field>
            <Field label="Guardian National ID">
              <input
                type="text"
                value={form.guardian_national_id}
                onChange={set('guardian_national_id')}
                className="input"
                placeholder="63-2400679R42"
                maxLength={13}
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Emergency Contacts ────────────────────────────────────── */}
        <EmergencyContactsSection
          data={form}
          onChange={setContact}
          requireNextOfKin={false}
        />

        {apiError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
        )}

        <FormActions
          isPending={mutation.isPending}
          label="Register Newborn"
          onCancel={() => navigate({ to: '/patients' })}
        />
      </form>
    </div>
  )
}

// ── Step 2b: Existing person form ─────────────────────────────────────────────

function ExistingPersonForm({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ExistingFormData>(EMPTY_EXISTING)
  const [idError, setIdError] = useState('')
  const [apiError, setApiError] = useState('')
  const [savedOffline, setSavedOffline] = useState(false)

  const set = useCallback(
    (field: keyof ExistingFormData) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  )

  const setContact = (field: keyof EmergencyContactFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleNationalIdChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^0-9A-Za-z-]/g, '')
      if (raw.length === 2 && !raw.includes('-')) {
        raw = raw + '-'
      }
      setForm((prev) => ({ ...prev, national_id: raw }))
      if (raw.length >= 13) {
        setIdError(ZIM_ID_RE.test(raw) ? '' : ZIM_ID_ERROR)
      } else {
        setIdError('')
      }
    },
    [],
  )

  const mutation = useMutation({
    mutationFn: (data: object) => api.post('/patients/', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate({ to: '/patients/$patientId', params: { patientId: res.data.id } })
    },
    onError: (err, variables) => {
      const isNetworkError = !(err as { response?: unknown }).response
      if (isNetworkError) {
        enqueue(variables as Record<string, unknown>)
        setSavedOffline(true)
      } else {
        setApiError(extractApiError(err))
      }
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setApiError('')
    if (!ZIM_ID_RE.test(form.national_id)) {
      setIdError(ZIM_ID_ERROR)
      return
    }
    const payload = { registration_type: 'existing', ...form } as Record<string, unknown>
    if (!navigator.onLine) {
      enqueue(payload)
      setSavedOffline(true)
      return
    }
    mutation.mutate(payload)
  }

  if (savedOffline) {
    return (
      <OfflineSavedConfirmation
        patientName={form.full_name}
        onRegisterAnother={() => { setSavedOffline(false); setForm(EMPTY_EXISTING) }}
      />
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Back to registration type"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Register Existing Individual</h1>
          <p className="text-sm text-slate-500">
            Establishes this person's identity and records a medical history baseline.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Personal Information ──────────────────────────────────── */}
        <SectionCard title="Personal Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="National ID *" span>
              <input
                type="text"
                required
                value={form.national_id}
                onChange={handleNationalIdChange}
                className={`input ${idError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
                placeholder="63-2400679R42"
                maxLength={13}
              />
              {idError && (
                <p className="mt-1 text-xs text-red-600">{idError}</p>
              )}
            </Field>
            <Field label="Full Name *">
              <input
                type="text"
                required
                value={form.full_name}
                onChange={set('full_name')}
                className="input"
              />
            </Field>
            <Field label="Date of Birth *">
              <input
                type="date"
                required
                value={form.date_of_birth}
                onChange={set('date_of_birth')}
                className="input"
              />
            </Field>
            <Field label="Gender *">
              <select required value={form.gender} onChange={set('gender')} className="input">
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Blood Type">
              <select value={form.blood_type} onChange={set('blood_type')} className="input">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'].map((t) => (
                  <option key={t} value={t}>{t === 'unknown' ? 'Unknown' : t}</option>
                ))}
              </select>
            </Field>
            <Field label="HIV Status">
              <input
                type="text"
                value={form.hiv_status}
                onChange={set('hiv_status')}
                className="input"
                placeholder="positive / negative / unknown"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Medical History Baseline ──────────────────────────────── */}
        <SectionCard title="Medical History Baseline">
          <div className="mb-4 rounded-md bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-700">
            These fields capture known conditions at the time of first registration.
            They are a <strong>starting point</strong> — not a complete history.
            Future diagnoses, medications, and visits will be recorded as structured health events.
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Known Allergies" span>
              <textarea
                rows={2}
                value={form.allergies}
                onChange={set('allergies')}
                className="input resize-none"
                placeholder="Penicillin, Shellfish, Latex…"
              />
            </Field>
            <Field label="Chronic Conditions" span>
              <textarea
                rows={2}
                value={form.chronic_conditions}
                onChange={set('chronic_conditions')}
                className="input resize-none"
                placeholder="Diabetes Type 2, Hypertension…"
              />
            </Field>
            <Field label="Critical / Acute Conditions" span>
              <textarea
                rows={2}
                value={form.critical_conditions}
                onChange={set('critical_conditions')}
                className="input resize-none"
                placeholder="Any acute or critical conditions…"
              />
            </Field>
            <Field label="Past Surgeries" span>
              <textarea
                rows={2}
                value={form.past_surgeries}
                onChange={set('past_surgeries')}
                className="input resize-none"
                placeholder="Appendectomy (2018), Knee replacement (2022)…"
              />
            </Field>
            <Field label="Current / Existing Medications" span>
              <textarea
                rows={2}
                value={form.existing_medications}
                onChange={set('existing_medications')}
                className="input resize-none"
                placeholder="Metformin 500mg daily, Amlodipine 5mg…"
              />
            </Field>
            <Field label="Additional Notes" span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={set('notes')}
                className="input resize-none"
              />
            </Field>
          </div>
        </SectionCard>

        {/* ── Emergency Contacts ────────────────────────────────────── */}
        <EmergencyContactsSection
          data={form}
          onChange={setContact}
          requireNextOfKin
        />

        {/* Legacy free-text field */}
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Emergency Contact (Free Text)
          </h2>
          <Field label="Emergency Contact" span>
            <input
              type="text"
              value={form.emergency_contact}
              onChange={set('emergency_contact')}
              className="input"
              placeholder="Name and phone in any format"
            />
          </Field>
        </section>

        {apiError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
        )}

        <FormActions
          isPending={mutation.isPending}
          label="Register Patient"
          onCancel={() => navigate({ to: '/patients' })}
        />
      </form>
    </div>
  )
}

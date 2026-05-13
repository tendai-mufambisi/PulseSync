import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, type FormEvent } from 'react'
import { authedRoute } from './_authed'
import { useAuth } from '../hooks/useAuth'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Spinner } from '../components/States'

export const registerRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/register',
  component: RegisterPatientPage,
})

const ZIM_ID_RE = /^\d{2}-\d{7}[A-Za-z]\d{2}$/
const ZIM_ID_ERROR = 'Format must be DD-NNNNNNNLCC (e.g. 63-2400679R42)'

interface PatientFormData {
  national_id: string
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  allergies: string
  critical_conditions: string
  chronic_conditions: string
  emergency_contact: string
  hiv_status: string
  notes: string
  // next of kin
  next_of_kin_name: string
  next_of_kin_relationship: string
  next_of_kin_phone: string
  next_of_kin_alt_phone: string
  // additional emergency contacts
  emergency_contact_2_name: string
  emergency_contact_2_phone: string
  emergency_contact_3_name: string
  emergency_contact_3_phone: string
}

const EMPTY: PatientFormData = {
  national_id: '',
  full_name: '',
  date_of_birth: '',
  gender: 'female',
  blood_type: 'unknown',
  allergies: '',
  critical_conditions: '',
  chronic_conditions: '',
  emergency_contact: '',
  hiv_status: '',
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

function RegisterPatientPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PatientFormData>(EMPTY)
  const [idError, setIdError] = useState('')
  const [apiError, setApiError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: PatientFormData) => api.post('/patients/', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate({ to: '/patients/$patientId', params: { patientId: res.data.id } })
    },
    onError: (err: unknown) => {
      const d = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data
      const msg =
        d?.detail ??
        d?.national_id?.[0] ??
        d?.next_of_kin_name?.[0] ??
        'Failed to register patient.'
      setApiError(Array.isArray(msg) ? msg[0] : String(msg))
    },
  })

  if (!hasRole('system_admin', 'hospital_admin', 'nurse', 'doctor')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        You do not have permission to register patients.
      </div>
    )
  }

  const set = (field: keyof PatientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleNationalIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^0-9A-Za-z-]/g, '')
      // Auto-insert dash after 2nd digit
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setApiError('')
    if (!ZIM_ID_RE.test(form.national_id)) {
      setIdError(ZIM_ID_ERROR)
      return
    }
    mutation.mutate(form)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Register New Patient</h1>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Section 1: Personal Info ─────────────────────────────── */}
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Personal Information
          </h2>
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
        </section>

        {/* ── Section 2: Medical Information ───────────────────────── */}
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Medical Information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Allergies (especially medication/treatment)" span>
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
            <Field label="Critical Conditions / Acute Problems" span>
              <textarea
                rows={2}
                value={form.critical_conditions}
                onChange={set('critical_conditions')}
                className="input resize-none"
                placeholder="Any acute or critical conditions…"
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
        </section>

        {/* ── Section 3: Next of Kin & Emergency Contacts ──────────── */}
        <section className="card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Next of Kin &amp; Emergency Contacts
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="text-xs text-slate-500 sm:col-span-2">
              Primary next of kin (required for emergency response)
            </p>
            <Field label="Next of Kin — Full Name *">
              <input
                type="text"
                required
                value={form.next_of_kin_name}
                onChange={set('next_of_kin_name')}
                className="input"
                placeholder="Jane Doe"
              />
            </Field>
            <Field label="Relationship *">
              <input
                type="text"
                required
                value={form.next_of_kin_relationship}
                onChange={set('next_of_kin_relationship')}
                className="input"
                placeholder="Spouse, Parent, Sibling…"
              />
            </Field>
            <Field label="Phone *">
              <input
                type="tel"
                required
                value={form.next_of_kin_phone}
                onChange={set('next_of_kin_phone')}
                className="input"
                placeholder="+263 7X XXX XXXX"
              />
            </Field>
            <Field label="Alternate Phone">
              <input
                type="tel"
                value={form.next_of_kin_alt_phone}
                onChange={set('next_of_kin_alt_phone')}
                className="input"
                placeholder="+263 7X XXX XXXX"
              />
            </Field>

            <div className="mt-2 sm:col-span-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">Additional emergency contacts (optional)</p>
            </div>
            <Field label="Emergency Contact 2 — Name">
              <input
                type="text"
                value={form.emergency_contact_2_name}
                onChange={set('emergency_contact_2_name')}
                className="input"
              />
            </Field>
            <Field label="Emergency Contact 2 — Phone">
              <input
                type="tel"
                value={form.emergency_contact_2_phone}
                onChange={set('emergency_contact_2_phone')}
                className="input"
              />
            </Field>
            <Field label="Emergency Contact 3 — Name">
              <input
                type="text"
                value={form.emergency_contact_3_name}
                onChange={set('emergency_contact_3_name')}
                className="input"
              />
            </Field>
            <Field label="Emergency Contact 3 — Phone">
              <input
                type="tel"
                value={form.emergency_contact_3_phone}
                onChange={set('emergency_contact_3_phone')}
                className="input"
              />
            </Field>

            <div className="mt-2 sm:col-span-2 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">Legacy emergency contact field</p>
            </div>
            <Field label="Emergency Contact (free text)" span>
              <input
                type="text"
                value={form.emergency_contact}
                onChange={set('emergency_contact')}
                className="input"
                placeholder="Name: +263 7X XXX XXXX"
              />
            </Field>
          </div>
        </section>

        {apiError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
        )}

        <div className="flex justify-end gap-3 pb-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/patients' })}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {mutation.isPending && <Spinner size={16} />}
            Register Patient
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  children,
  span,
}: {
  label: string
  children: React.ReactNode
  span?: boolean
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

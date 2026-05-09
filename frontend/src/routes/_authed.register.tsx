import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
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

interface PatientFormData {
  national_id: string
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  allergies: string
  critical_conditions: string
  emergency_contact: string
  hiv_status: string
  notes: string
}

const EMPTY: PatientFormData = {
  national_id: '',
  full_name: '',
  date_of_birth: '',
  gender: 'female',
  blood_type: 'unknown',
  allergies: '',
  critical_conditions: '',
  emergency_contact: '',
  hiv_status: '',
  notes: '',
}

function RegisterPatientPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PatientFormData>(EMPTY)
  const [apiError, setApiError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: PatientFormData) => api.post('/patients/', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate({ to: '/patients/$patientId', params: { patientId: res.data.id } })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string; national_id?: string[] } } })?.response
          ?.data?.detail ??
        (err as { response?: { data?: { national_id?: string[] } } })?.response?.data
          ?.national_id?.[0] ??
        'Failed to register patient.'
      setApiError(msg)
    },
  })

  if (!hasRole('admin', 'nurse')) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center text-sm text-slate-500">
        You do not have permission to register patients.
      </div>
    )
  }

  const set = (field: keyof PatientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setApiError('')
    mutation.mutate(form)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Register New Patient</h1>
      <form onSubmit={handleSubmit} className="card p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="National ID *" required>
            <input
              type="text"
              required
              value={form.national_id}
              onChange={set('national_id')}
              className="input"
              placeholder="63-2400679R42"
              pattern="\d{2}-\d{7}[A-Z]\d{2}"
              title="Zimbabwe national ID format: 63-2400679R42"
            />
          </Field>
          <Field label="Full Name *" required>
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
              {['A+','A-','B+','B-','AB+','AB-','O+','O-','unknown'].map((t) => (
                <option key={t} value={t}>{t}</option>
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
          <Field label="Allergies" span>
            <textarea
              rows={2}
              value={form.allergies}
              onChange={set('allergies')}
              className="input resize-none"
              placeholder="Penicillin, Shellfish…"
            />
          </Field>
          <Field label="Critical Conditions" span>
            <textarea
              rows={2}
              value={form.critical_conditions}
              onChange={set('critical_conditions')}
              className="input resize-none"
              placeholder="Diabetes Type 2, Hypertension…"
            />
          </Field>
          <Field label="Emergency Contact" span>
            <input
              type="text"
              value={form.emergency_contact}
              onChange={set('emergency_contact')}
              className="input"
              placeholder="Name: +1-555-0000"
            />
          </Field>
          <Field label="Notes" span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={set('notes')}
              className="input resize-none"
            />
          </Field>
        </div>

        {apiError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
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
  required: _req,
}: {
  label: string
  children: React.ReactNode
  span?: boolean
  required?: boolean
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

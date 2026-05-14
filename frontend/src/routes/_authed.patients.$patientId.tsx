import { createRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { authedRoute } from './_authed'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Patient, ClinicalRecord } from '../types'
import { useAuth } from '../hooks/useAuth'
import { RoleGate } from '../components/RoleGate'
import { PageSpinner, ErrorState, EmptyState, Spinner } from '../components/States'
import { ArrowLeft, Trash2, Plus, Pencil, X, AlertTriangle, Phone, ShieldAlert } from 'lucide-react'

export const patientDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/patients/$patientId',
  component: PatientDetailPage,
})

interface EditableFields {
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  allergies: string
  critical_conditions: string
  chronic_conditions: string
  emergency_contact: string
  next_of_kin_name: string
  next_of_kin_relationship: string
  next_of_kin_phone: string
  next_of_kin_alt_phone: string
  emergency_contact_2_name: string
  emergency_contact_2_phone: string
  emergency_contact_3_name: string
  emergency_contact_3_phone: string
  hiv_status: string
  notes: string
}

function PatientDetailPage() {
  const { patientId } = patientDetailRoute.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasRole, isSystemAdmin } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState('')

  const { data: patient, isLoading, isError } = useQuery<Patient>({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/patients/${patientId}/`)
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/patients/${patientId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      navigate({ to: '/patients' })
    },
  })

  const editMutation = useMutation({
    mutationFn: (data: Partial<EditableFields>) =>
      api.patch(`/patients/${patientId}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      setEditing(false)
      setEditError('')
    },
    onError: () => setEditError('Failed to update patient.'),
  })

  if (isLoading) return <PageSpinner />
  if (isError || !patient) return <ErrorState message="Patient not found or failed to load." />

  // Paramedics see a stripped-down emergency view — backend already returns safe fields only
  if (hasRole('paramedic')) {
    return <ParamedicView patient={patient} onBack={() => navigate({ to: '/patients' })} />
  }

  const handleEdit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries()) as Partial<EditableFields>
    editMutation.mutate(payload)
  }

  const openEmergency = () => {
    window.open(`/emergency/${patient.id}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back + title row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/patients' })}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{patient.full_name}</h1>
            <p className="text-sm text-slate-500">
              {patient.national_id
                ? `National ID: ${patient.national_id}`
                : patient.registration_type === 'newborn'
                ? 'Newborn — no National ID assigned yet'
                : 'No National ID on record'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* SOS Emergency button */}
          <button
            onClick={openEmergency}
            className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100"
            title="Open emergency profile in new tab"
          >
            <AlertTriangle size={14} />
            SOS
          </button>
          <button
            onClick={() => { setEditing((v) => !v); setEditError('') }}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            {editing ? <X size={14} /> : <Pencil size={14} />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
          {isSystemAdmin && (
            <button
              onClick={() => {
                if (confirm('Delete this patient permanently?')) deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleEdit} className="card mb-5 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Edit Patient Details
          </h2>
          <div className="space-y-6">
            {/* Personal */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Personal</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EF label="Full Name" name="full_name" defaultValue={patient.full_name} required />
                <EF label="Date of Birth" name="date_of_birth" type="date" defaultValue={patient.date_of_birth} required />
                <EFSelect label="Gender" name="gender" defaultValue={patient.gender}
                  options={['female', 'male', 'other']} />
                <EFSelect label="Blood Type" name="blood_type" defaultValue={patient.blood_type}
                  options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']} />
                <RoleGate roles={['system_admin', 'hospital_admin', 'doctor']}>
                  <EF label="HIV Status" name="hiv_status" defaultValue={patient.hiv_status} />
                </RoleGate>
              </div>
            </div>
            {/* Medical */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Medical</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EFTextarea label="Allergies" name="allergies" defaultValue={patient.allergies} span />
                <EFTextarea label="Chronic Conditions" name="chronic_conditions" defaultValue={patient.chronic_conditions} span />
                <EFTextarea label="Critical Conditions" name="critical_conditions" defaultValue={patient.critical_conditions} span />
                <EFTextarea label="Notes" name="notes" defaultValue={patient.notes} span />
              </div>
            </div>
            {/* Next of kin */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Next of Kin &amp; Emergency Contacts</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <EF label="Next of Kin — Name" name="next_of_kin_name" defaultValue={patient.next_of_kin_name} />
                <EF label="Relationship" name="next_of_kin_relationship" defaultValue={patient.next_of_kin_relationship} />
                <EF label="Phone" name="next_of_kin_phone" defaultValue={patient.next_of_kin_phone} />
                <EF label="Alt Phone" name="next_of_kin_alt_phone" defaultValue={patient.next_of_kin_alt_phone} />
                <EF label="Emergency Contact" name="emergency_contact" defaultValue={patient.emergency_contact} span />
                <EF label="Contact 2 — Name" name="emergency_contact_2_name" defaultValue={patient.emergency_contact_2_name} />
                <EF label="Contact 2 — Phone" name="emergency_contact_2_phone" defaultValue={patient.emergency_contact_2_phone} />
                <EF label="Contact 3 — Name" name="emergency_contact_3_name" defaultValue={patient.emergency_contact_3_name} />
                <EF label="Contact 3 — Phone" name="emergency_contact_3_phone" defaultValue={patient.emergency_contact_3_phone} />
              </div>
            </div>
          </div>
          {editError && (
            <p className="mt-3 text-sm text-red-600">{editError}</p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {editMutation.isPending && <Spinner size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Demographics card */}
          <div className="card mb-5 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Demographics</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              <Info label="Date of Birth" value={patient.date_of_birth} />
              <Info label="Gender" value={patient.gender} capitalize />
              <Info label="Blood Type" value={patient.blood_type} />
              <RoleGate roles={['system_admin', 'hospital_admin', 'doctor']}>
                <Info label="HIV Status" value={patient.hiv_status || '—'} />
              </RoleGate>
              <RoleGate roles={['nurse']}>
                <Info label="HIV Status" value="[REDACTED]" />
              </RoleGate>
            </div>
          </div>

          {/* Clinical info card */}
          <div className="card mb-5 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Clinical Info</h2>
            <div className="flex flex-col gap-3">
              <Info label="Allergies" value={patient.allergies || 'None reported'} block />
              <Info label="Chronic Conditions" value={patient.chronic_conditions || 'None reported'} block />
              <Info label="Critical Conditions" value={patient.critical_conditions || 'None reported'} block />
              <Info label="Notes" value={patient.notes || '—'} block />
            </div>
          </div>

          {/* Next of kin card */}
          <div className="card mb-5 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Next of Kin &amp; Emergency Contacts
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              {patient.next_of_kin_name ? (
                <>
                  <Info label="Next of Kin" value={patient.next_of_kin_name} />
                  <Info label="Relationship" value={patient.next_of_kin_relationship || '—'} />
                  <Info label="Phone" value={patient.next_of_kin_phone || '—'} />
                  {patient.next_of_kin_alt_phone && (
                    <Info label="Alt Phone" value={patient.next_of_kin_alt_phone} />
                  )}
                </>
              ) : (
                <p className="col-span-3 text-sm text-slate-400">No next of kin recorded.</p>
              )}
              {patient.emergency_contact && (
                <Info label="Emergency Contact" value={patient.emergency_contact} span />
              )}
              {patient.emergency_contact_2_name && (
                <>
                  <Info label="Contact 2" value={patient.emergency_contact_2_name} />
                  <Info label="Phone 2" value={patient.emergency_contact_2_phone || '—'} />
                </>
              )}
              {patient.emergency_contact_3_name && (
                <>
                  <Info label="Contact 3" value={patient.emergency_contact_3_name} />
                  <Info label="Phone 3" value={patient.emergency_contact_3_phone || '—'} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Clinical Records */}
      <ClinicalRecordsSection patientId={patient.id} records={patient.records ?? []} />
    </div>
  )
}

function EF({
  label, name, defaultValue = '', type = 'text', required, span,
}: {
  label: string; name: string; defaultValue?: string; type?: string;
  required?: boolean; span?: boolean;
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      <input type={type} name={name} defaultValue={defaultValue} required={required}
        className="input" />
    </div>
  )
}

function EFSelect({
  label, name, defaultValue, options, span,
}: {
  label: string; name: string; defaultValue: string; options: string[]; span?: boolean;
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      <select name={name} defaultValue={defaultValue} className="input">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function EFTextarea({
  label, name, defaultValue = '', span,
}: {
  label: string; name: string; defaultValue?: string; span?: boolean;
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-slate-700">{label}</label>
      <textarea name={name} defaultValue={defaultValue} rows={2}
        className="input resize-none" />
    </div>
  )
}

function ClinicalRecordsSection({
  patientId,
  records,
}: {
  patientId: string
  records: ClinicalRecord[]
}) {
  const queryClient = useQueryClient()
  const { hasRole } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [diagnosis, setDiagnosis] = useState('')
  const [medications, setMedications] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const addMutation = useMutation({
    mutationFn: (data: { diagnosis: string; medications: string; notes: string }) =>
      api.post(`/patients/${patientId}/records/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
      setShowForm(false)
      setDiagnosis('')
      setMedications('')
      setNotes('')
    },
    onError: () => setError('Failed to add record.'),
  })

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    addMutation.mutate({ diagnosis, medications, notes })
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Clinical Records
        </h2>
        {hasRole('doctor', 'system_admin', 'hospital_admin') && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            <Plus size={14} />
            Add Record
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-5 rounded-lg border border-sky-100 bg-sky-50 p-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Diagnosis *</label>
              <textarea
                required
                rows={2}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Medications</label>
              <textarea
                rows={2}
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input resize-none"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {addMutation.isPending && <Spinner size={12} />}
              Save
            </button>
          </div>
        </form>
      )}

      {records.length === 0 && (
        <EmptyState message="No clinical records yet. Add the first one!" />
      )}
      <div className="flex flex-col divide-y divide-slate-100">
        {records.map((r) => (
          <div key={r.id} className="py-4 first:pt-0 last:pb-0">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{r.date}</span>
              <span className="text-xs text-slate-400">by {r.author_name ?? 'unknown'}</span>
            </div>
            <p className="text-sm font-medium text-slate-900">{r.diagnosis}</p>
            {r.medications && (
              <p className="mt-1 text-sm text-slate-600">
                <span className="text-xs font-medium text-slate-400">Medications: </span>
                {r.medications}
              </p>
            )}
            {r.notes && <p className="mt-1 text-sm text-slate-500">{r.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Info({
  label,
  value,
  capitalize,
  block,
  span,
}: {
  label: string
  value: string
  capitalize?: boolean
  block?: boolean
  span?: boolean
}) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p
        className={`mt-0.5 text-sm text-slate-800 ${capitalize ? 'capitalize' : ''} ${
          block ? 'whitespace-pre-wrap' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

// ── Paramedic-only view ───────────────────────────────────────────────────────
function ParamedicView({ patient, onBack }: { patient: Patient; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-red-600" />
          <span className="text-sm font-semibold uppercase tracking-wide text-red-600">
            Paramedic View — Emergency Data Only
          </span>
        </div>
      </div>

      {/* Identity */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
        <div className="mt-2 flex flex-wrap gap-5 text-sm">
          <span className="text-slate-500">
            DOB: <strong className="text-slate-800">{patient.date_of_birth}</strong>
          </span>
          <span className="text-slate-500">
            Blood Type:{' '}
            <strong className="text-2xl font-extrabold text-red-600">{patient.blood_type}</strong>
          </span>
        </div>
      </div>

      {/* Critical medical */}
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-red-700">
          ⚠ Critical Medical Information
        </h2>
        <ERow
          label="Allergies"
          value={patient.allergies || 'None reported'}
          danger={!!patient.allergies}
        />
        <ERow
          label="Chronic Conditions"
          value={patient.chronic_conditions || 'None reported'}
        />
        <ERow
          label="Critical Conditions"
          value={patient.critical_conditions || 'None reported'}
        />
      </div>

      {/* Next of kin */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Next of Kin
        </h2>
        {patient.next_of_kin_name ? (
          <>
            <ERow
              label="Name"
              value={`${patient.next_of_kin_name}${patient.next_of_kin_relationship ? ' (' + patient.next_of_kin_relationship + ')' : ''}`}
            />
            <ERow label="Phone" value={patient.next_of_kin_phone || '—'} phone={!!patient.next_of_kin_phone} />
            {patient.next_of_kin_alt_phone && (
              <ERow label="Alt Phone" value={patient.next_of_kin_alt_phone} phone />
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">No next of kin recorded.</p>
        )}
      </div>

      {/* Additional emergency contacts */}
      {(patient.emergency_contact || patient.emergency_contact_2_name || patient.emergency_contact_3_name) && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Additional Emergency Contacts
          </h2>
          {patient.emergency_contact && (
            <ERow label="Contact" value={patient.emergency_contact} />
          )}
          {patient.emergency_contact_2_name && (
            <ERow
              label="Contact 2"
              value={`${patient.emergency_contact_2_name}${patient.emergency_contact_2_phone ? ' — ' + patient.emergency_contact_2_phone : ''}`}
              phone={!!patient.emergency_contact_2_phone}
            />
          )}
          {patient.emergency_contact_3_name && (
            <ERow
              label="Contact 3"
              value={`${patient.emergency_contact_3_name}${patient.emergency_contact_3_phone ? ' — ' + patient.emergency_contact_3_phone : ''}`}
              phone={!!patient.emergency_contact_3_phone}
            />
          )}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        This access has been logged. Paramedic read-only view.
      </p>
    </div>
  )
}

function ERow({
  label,
  value,
  danger,
  phone,
}: {
  label: string
  value: string
  danger?: boolean
  phone?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        {phone && <Phone size={13} className="shrink-0 text-green-600" />}
        <p className={`text-sm font-medium ${danger ? 'font-bold text-red-700' : 'text-slate-800'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

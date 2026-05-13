import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { EmergencyPatient } from '../types'
import { PageSpinner, ErrorState } from '../components/States'
import { AlertTriangle, Activity, Phone } from 'lucide-react'

export const emergencyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/emergency/$patientId',
  component: EmergencyPage,
})

function EmergencyPage() {
  const { patientId } = emergencyRoute.useParams()

  const { data, isLoading, isError } = useQuery<EmergencyPatient>({
    queryKey: ['emergency', patientId],
    queryFn: async () => {
      const { data } = await api.get(`/emergency/${patientId}/`)
      return data
    },
    retry: false,
  })

  if (isLoading) return <PageSpinner />
  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <ErrorState message="Patient not found or emergency data unavailable." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-red-50 px-4 py-10">
      {/* Header */}
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-3">
          <Activity size={30} className="text-red-600" />
          <h1 className="text-3xl font-bold tracking-tight text-red-700">EMERGENCY ACCESS</h1>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>This access is logged. For authorised emergency use only.</span>
        </div>

        {/* Patient header */}
        <div className="mb-4 rounded-xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">{data.full_name}</h2>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
            <span>DOB: <strong className="text-slate-800">{data.date_of_birth}</strong></span>
            <span>
              Blood Type:{' '}
              <strong className="text-2xl font-extrabold text-red-600">{data.blood_type}</strong>
            </span>
          </div>
        </div>

        {/* Critical medical info */}
        <div className="mb-4 rounded-xl border border-red-300 bg-red-100 p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-red-700">
            ⚠ Critical Medical Information
          </h3>
          <InfoRow label="Allergies" value={data.allergies || 'None reported'} danger={!!data.allergies} />
          <InfoRow label="Chronic Conditions" value={data.chronic_conditions || 'None reported'} />
          <InfoRow label="Critical Conditions" value={data.critical_conditions || 'None reported'} />
        </div>

        {/* Next of kin */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Next of Kin
          </h3>
          {data.next_of_kin_name ? (
            <>
              <InfoRow label="Name" value={`${data.next_of_kin_name} (${data.next_of_kin_relationship || 'relationship unknown'})`} />
              <InfoRow label="Phone" value={data.next_of_kin_phone || '—'} phone={!!data.next_of_kin_phone} />
              {data.next_of_kin_alt_phone && (
                <InfoRow label="Alt Phone" value={data.next_of_kin_alt_phone} phone />
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">No next of kin recorded.</p>
          )}
        </div>

        {/* Additional emergency contacts */}
        {(data.emergency_contact_2_name || data.emergency_contact || data.emergency_contact_3_name) && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
              Additional Emergency Contacts
            </h3>
            {data.emergency_contact && (
              <InfoRow label="Contact" value={data.emergency_contact} />
            )}
            {data.emergency_contact_2_name && (
              <InfoRow
                label="Contact 2"
                value={`${data.emergency_contact_2_name}${data.emergency_contact_2_phone ? ' — ' + data.emergency_contact_2_phone : ''}`}
                phone={!!data.emergency_contact_2_phone}
              />
            )}
            {data.emergency_contact_3_name && (
              <InfoRow
                label="Contact 3"
                value={`${data.emergency_contact_3_name}${data.emergency_contact_3_phone ? ' — ' + data.emergency_contact_3_phone : ''}`}
                phone={!!data.emergency_contact_3_phone}
              />
            )}
          </div>
        )}

        <p className="text-center text-xs text-slate-400">Patient ID: {data.id}</p>
      </div>
    </div>
  )
}

function InfoRow({
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
    <div className="flex flex-col gap-0.5 py-2 border-b border-slate-100 last:border-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        {phone && <Phone size={14} className="shrink-0 text-green-600" />}
        <p className={`text-sm font-medium ${danger ? 'text-red-700 font-bold' : 'text-slate-800'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

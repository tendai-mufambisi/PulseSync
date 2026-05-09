import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import type { EmergencyPatient } from '../types'
import { PageSpinner, ErrorState } from '../components/States'
import { AlertTriangle, Activity } from 'lucide-react'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-red-50 px-4 py-12">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Activity size={28} className="text-red-600" />
        <h1 className="text-2xl font-bold text-red-700">EMERGENCY ACCESS</h1>
      </div>

      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-100 px-4 py-2 text-sm text-red-700">
          <AlertTriangle size={16} />
          <span>This access is logged. For authorised emergency use only.</span>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="text-lg font-semibold text-slate-900">{data.full_name}</h2>
            <p className="text-sm text-slate-500">Patient ID: {data.id}</p>
          </div>

          <div className="flex flex-col divide-y divide-slate-100">
            <Row label="Blood Type" value={data.blood_type} highlight />
            <Row label="Allergies" value={data.allergies || 'None reported'} />
            <Row label="Critical Conditions" value={data.critical_conditions || 'None reported'} />
            <Row label="Emergency Contact" value={data.emergency_contact || 'Not provided'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`text-sm ${
          highlight ? 'text-lg font-bold text-red-700' : 'text-slate-800'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

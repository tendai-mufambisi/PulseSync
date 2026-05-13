import { createRoute, Link } from '@tanstack/react-router'
import { authedRoute } from './_authed'
import { useAuth } from '../hooks/useAuth'
import { Search, UserPlus, Users, ClipboardList, Activity, UsersRound } from 'lucide-react'
import type { UserRole } from '../types'

export const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/dashboard',
  component: DashboardPage,
})

interface QuickLink {
  to: string
  label: string
  description: string
  icon: React.ReactNode
  color: string
  roles?: UserRole[]
}

const LINKS: QuickLink[] = [
  {
    to: '/search',
    label: 'Search Patient',
    description: 'Look up by National ID nationwide',
    icon: <Search size={24} />,
    color: 'text-sky-600 bg-sky-50',
  },
  {
    to: '/patients',
    label: 'All Patients',
    description: 'Browse all patients — Zimbabwe',
    icon: <Users size={24} />,
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    to: '/register',
    label: 'Register Patient',
    description: 'Add a new patient record',
    icon: <UserPlus size={24} />,
    color: 'text-violet-600 bg-violet-50',
    roles: ['system_admin', 'hospital_admin', 'nurse', 'doctor'],
  },
  {
    to: '/audit-logs',
    label: 'Audit Logs',
    description: 'View all system access events',
    icon: <ClipboardList size={24} />,
    color: 'text-orange-600 bg-orange-50',
    roles: ['system_admin', 'hospital_admin'],
  },
  {
    to: '/staff',
    label: 'Staff Management',
    description: 'Manage hospital staff accounts',
    icon: <UsersRound size={24} />,
    color: 'text-indigo-600 bg-indigo-50',
    roles: ['system_admin', 'hospital_admin'],
  },
]

function DashboardPage() {
  const { user, hasRole, isSystemAdmin, isHospitalAdmin } = useAuth()

  const visibleLinks = LINKS.filter(
    (l) => !l.roles || l.roles.some((r) => hasRole(r)),
  )

  const ROLE_LABELS: Record<string, string> = {
    system_admin: 'System Administrator',
    hospital_admin: `Hospital Administrator${user?.hospital_name ? ' — ' + user.hospital_name : ''}`,
    doctor: 'Doctor',
    nurse: 'Nurse',
    paramedic: 'Paramedic',
  }
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : ''

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Activity size={28} className="text-sky-600" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Welcome back, {user?.full_name}
          </h1>
          <p className="text-sm capitalize text-slate-500">{roleLabel} · PulseSync EHR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-md"
          >
            <div className={`rounded-lg p-2.5 ${link.color}`}>{link.icon}</div>
            <div>
              <p className="font-medium text-slate-900">{link.label}</p>
              <p className="mt-0.5 text-sm text-slate-500">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

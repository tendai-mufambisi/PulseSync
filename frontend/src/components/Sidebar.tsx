import { Link, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Search,
  UserPlus,
  Users,
  ClipboardList,
  LogOut,
  Activity,
  ShieldCheck,
  Building2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles?: UserRole[]
  systemAdminOnly?: boolean
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/search', label: 'Search Patient', icon: <Search size={18} /> },
  { to: '/patients', label: 'All Patients', icon: <Users size={18} /> },
  { to: '/register', label: 'Register Patient', icon: <UserPlus size={18} />, roles: ['admin', 'nurse'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: <ClipboardList size={18} />, roles: ['admin'] },
  { to: '/hospitals', label: 'Hospitals', icon: <Building2 size={18} />, systemAdminOnly: true },
  { to: '/users', label: 'User Management', icon: <ShieldCheck size={18} />, roles: ['admin'] },
]

export function Sidebar() {
  const { user, signOut, hasRole, isSystemAdmin } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate({ to: '/login' })
  }

  const visibleNav = NAV.filter((item) => {
    if (item.systemAdminOnly) return isSystemAdmin
    if (item.roles) return item.roles.some((r) => hasRole(r))
    return true
  })

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <Activity size={22} className="text-sky-600" />
        <span className="text-lg font-semibold tracking-tight text-slate-900">PulseSync</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {visibleNav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 [&.active]:bg-sky-50 [&.active]:font-medium [&.active]:text-sky-700"
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-3 py-3">
        {user && (
          <div className="mb-2 px-2">
            <p className="truncate text-xs font-medium text-slate-800">{user.full_name}</p>
            <p className="truncate text-xs capitalize text-slate-400">
              {isSystemAdmin ? 'System Admin' : user.role}
            </p>
            {user.hospital_name && (
              <p className="truncate text-xs text-slate-400">{user.hospital_name}</p>
            )}
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

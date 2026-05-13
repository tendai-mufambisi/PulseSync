import { rootRoute } from './routes/__root'
import { indexRoute } from './routes/index'
import { loginRoute } from './routes/login'
import { changePasswordRoute } from './routes/change-password'
import { authedRoute } from './routes/_authed'
import { dashboardRoute } from './routes/_authed.dashboard'
import { searchRoute } from './routes/_authed.search'
import { registerRoute } from './routes/_authed.register'
import { patientListRoute } from './routes/_authed.patients.index'
import { patientDetailRoute } from './routes/_authed.patients.$patientId'
import { auditLogsRoute } from './routes/_authed.audit-logs'
import { hospitalsRoute } from './routes/_authed.hospitals'
import { usersRoute } from './routes/_authed.users'
import { staffRoute } from './routes/_authed.staff'
import { emergencyRoute } from './routes/emergency.$patientId'

export const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  changePasswordRoute,
  emergencyRoute,
  authedRoute.addChildren([
    dashboardRoute,
    searchRoute,
    registerRoute,
    patientListRoute,
    patientDetailRoute,
    auditLogsRoute,
    hospitalsRoute,
    usersRoute,
    staffRoute,
  ]),
])

export type UserRole = 'admin' | 'doctor' | 'nurse'

export interface Hospital {
  id: string
  name: string
  location: string
  phone: string
  staff_count: number
  created_at: string
}

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  hospital: string | null
  hospital_name: string | null
  must_change_password: boolean
  created_at: string
}

export interface Patient {
  id: string
  national_id: string
  full_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'
  blood_type: string
  allergies: string
  critical_conditions: string
  emergency_contact: string
  hiv_status: string
  notes: string
  created_by: string | null
  created_by_name: string | null
  records: ClinicalRecord[]
  created_at: string
  updated_at: string
}

export interface PatientListItem {
  id: string
  national_id: string
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  created_at: string
}

export interface ClinicalRecord {
  id: string
  patient: string
  diagnosis: string
  medications: string
  notes: string
  author: string | null
  author_name: string | null
  date: string
  created_at: string
}

export interface AuditLog {
  id: string
  user: string | null
  user_email: string | null
  patient: string | null
  patient_name: string | null
  action: string
  timestamp: string
  ip_address: string | null
}

export interface EmergencyPatient {
  id: string
  full_name: string
  blood_type: string
  allergies: string
  critical_conditions: string
  emergency_contact: string
}

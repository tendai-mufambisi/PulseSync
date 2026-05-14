export type UserRole = 'system_admin' | 'hospital_admin' | 'doctor' | 'nurse' | 'paramedic'

export type FacilityType = 'hospital' | 'clinic' | 'health_center' | 'pharmacy' | 'laboratory' | 'other'

export type RegistrationType = 'newborn' | 'existing'

export type HealthEventType = 'birth' | 'consultation' | 'diagnosis' | 'medication' | 'emergency' | 'sensitive'

export interface Hospital {
  id: string
  name: string
  facility_type: FacilityType
  facility_type_other: string
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
  is_active: boolean
  created_at: string
}

export interface HealthEvent {
  id: string
  patient: string
  event_type: HealthEventType
  event_date: string
  hospital: string | null
  hospital_name: string | null
  clinician: string | null
  clinician_name: string | null
  summary: string
  is_sensitive: boolean
  sensitive_category: string
  // Birth-specific
  birth_weight_kg: string | null
  delivery_type: string
  gestational_age_weeks: number | null
  birth_complications: string
  apgar_score: number | null
  initial_observations: string
  // Clinical
  diagnosis: string
  medications: string
  notes: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  registration_type: RegistrationType
  national_id: string | null
  full_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'
  blood_type: string
  // Medical baseline
  allergies: string
  critical_conditions: string
  chronic_conditions: string
  past_surgeries: string
  existing_medications: string
  hiv_status: string
  notes: string
  // Guardian
  guardian_name: string
  guardian_relationship: string
  guardian_national_id: string
  guardian_contact: string
  // Emergency contacts
  emergency_contact: string
  next_of_kin_name: string
  next_of_kin_relationship: string
  next_of_kin_phone: string
  next_of_kin_alt_phone: string
  emergency_contact_2_name: string
  emergency_contact_2_phone: string
  emergency_contact_3_name: string
  emergency_contact_3_phone: string
  created_by: string | null
  created_by_name: string | null
  health_events: HealthEvent[]
  records?: ClinicalRecord[]
  created_at: string
  updated_at: string
}

export interface PatientListItem {
  id: string
  registration_type: RegistrationType
  national_id: string | null
  full_name: string
  date_of_birth: string
  gender: string
  blood_type: string
  created_at: string
  _pending?: boolean
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
  user_role: string | null
  patient: string | null
  patient_name: string | null
  hospital: string | null
  hospital_name: string | null
  action: string
  category: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
  ip_address: string | null
}

export interface EmergencyPatient {
  id: string
  full_name: string
  date_of_birth: string
  blood_type: string
  allergies: string
  critical_conditions: string
  chronic_conditions: string
  next_of_kin_name: string
  next_of_kin_relationship: string
  next_of_kin_phone: string
  next_of_kin_alt_phone: string
  emergency_contact: string
  emergency_contact_2_name: string
  emergency_contact_2_phone: string
  emergency_contact_3_name: string
  emergency_contact_3_phone: string
}

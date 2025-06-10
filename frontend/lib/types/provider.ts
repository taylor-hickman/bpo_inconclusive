export interface Provider {
  id: number
  npi: string
  gnpi: string
  provider_name: string
  specialty: string
  provider_group: string
}

export interface ProviderAddress {
  id: number
  provider_id: number
  address_category: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
  is_correct?: boolean
  corrected_address1?: string
  corrected_address2?: string
  corrected_city?: string
  corrected_state?: string
  corrected_zip?: string
  link_id?: string
}

export interface ProviderPhone {
  id: number
  provider_id: number
  phone: string
  is_correct?: boolean
  corrected_phone?: string
  link_id?: string
}

export interface ValidationSession {
  id: number
  provider_id: number
  user_id: number
  call_attempt_1?: string
  call_attempt_2?: string
  closed_date?: string
  status: string
}

export interface AddressPhoneRecord {
  id: string  // composite identifier: "addr_id-phone_id"
  address: ProviderAddress
  phone: ProviderPhone
}

export interface ProviderValidationData {
  provider: Provider
  address_phone_records: AddressPhoneRecord[]
  addresses?: ProviderAddress[]
  phones?: ProviderPhone[]
  validation_session?: ValidationSession
}

export interface ProviderStats {
  total_pending: number
  completed_today: number
  in_progress: number
  total_inconclusive: number
  currently_locked: number
}
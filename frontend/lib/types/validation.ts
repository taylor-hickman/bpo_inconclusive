export interface AddressValidation {
  address_id: number
  is_correct: boolean
  corrected_address1?: string
  corrected_address2?: string
  corrected_city?: string
  corrected_state?: string
  corrected_zip?: string
}

export interface PhoneValidation {
  phone_id: number
  is_correct: boolean
  corrected_phone?: string
}

export interface NewAddress {
  address_category: string
  address1: string
  address2?: string
  city: string
  state: string
  zip: string
}

export interface ValidationUpdate {
  address_validations: AddressValidation[]
  phone_validations: PhoneValidation[]
  new_addresses: NewAddress[]
}

export interface CallAttemptRequest {
  attempt_number: number
}

export interface ValidationState {
  addressValidations: Record<number, AddressValidation>
  phoneValidations: Record<number, PhoneValidation>
  newAddresses: NewAddress[]
}

export type ValidationStatus = 'pending' | 'in_progress' | 'completed' | 'abandoned'
// Form validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePassword = (password: string): {
  isValid: boolean
  errors: string[]
} => {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Valid phone numbers: 10 digits or 11 digits starting with 1
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

export const validateZipCode = (zip: string): boolean => {
  // US zip codes: 5 digits or 5+4 format
  const zipRegex = /^\d{5}(-\d{4})?$/
  return zipRegex.test(zip)
}

export const validateState = (state: string): boolean => {
  // US state abbreviations (2 characters)
  const stateRegex = /^[A-Z]{2}$/
  return stateRegex.test(state.toUpperCase())
}

export const validateAddress = (address: {
  address1: string
  city: string
  state: string
  zip: string
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (!address.address1.trim()) {
    errors.push('Address line 1 is required')
  }
  
  if (!address.city.trim()) {
    errors.push('City is required')
  }
  
  if (!validateState(address.state)) {
    errors.push('Valid state abbreviation is required')
  }
  
  if (!validateZipCode(address.zip)) {
    errors.push('Valid ZIP code is required')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/\s+/g, ' ')
}
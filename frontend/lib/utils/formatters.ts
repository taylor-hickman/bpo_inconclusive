export const formatPhoneNumber = (phone: string | null | undefined): string => {
  // Handle null, undefined
  if (!phone) {
    return 'N/A'
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Handle different phone number lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  } else {
    // Return original if it doesn't match expected patterns
    return phone
  }
}

export const formatAddress = (address: {
  address1: string
  address2?: string | null
  city: string
  state: string
  zip: string
}): string => {
  const parts = [
    address.address1,
    address.address2 || '',
    `${address.city}, ${address.state} ${address.zip}`
  ].filter(Boolean)
  
  return parts.join(', ')
}

export const formatDateTime = (timestamp: string | null): string => {
  if (!timestamp) return 'N/A'
  
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString(),
    dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' })
  }
}

export const getSqlString = (sqlValue: any): string => {
  if (sqlValue === null || sqlValue === undefined) return ''
  return String(sqlValue)
}

export const getSqlBool = (sqlValue: any): boolean | null => {
  if (sqlValue === null || sqlValue === undefined) return null
  return Boolean(sqlValue)
}

export const getSqlTime = (sqlValue: any): string | null => {
  if (sqlValue === null || sqlValue === undefined) return null
  return String(sqlValue)
}
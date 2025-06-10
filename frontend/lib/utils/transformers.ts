import type { AddressPhoneRecord, ProviderAddress, ProviderPhone } from '@/lib/types'
import { getSqlString } from './formatters'

// Group address-phone records by unique address content
export const groupRecordsByAddress = (records: AddressPhoneRecord[]) => {
  const groups = new Map<string, AddressPhoneRecord[]>()
  
  records.forEach(record => {
    // Create a unique key based on address content (not ID)
    const addressKey = [
      getSqlString(record.address.address_category),
      record.address.address1,
      getSqlString(record.address.address2),
      record.address.city,
      record.address.state,
      record.address.zip
    ].join('|').toLowerCase()
    
    if (!groups.has(addressKey)) {
      groups.set(addressKey, [])
    }
    
    // Check if this exact phone is already in the group to avoid duplicates
    const existingGroup = groups.get(addressKey)!
    const phoneExists = existingGroup.some(existingRecord => 
      existingRecord.phone.id === record.phone.id
    )
    
    if (!phoneExists) {
      existingGroup.push(record)
    }
  })
  
  return Array.from(groups.values())
}

// Group addresses and phones by link_id for legacy structure
export const groupAddressesAndPhones = (addresses: ProviderAddress[], phones: ProviderPhone[]) => {
  // If no link_id, deduplicate phones by unique phone number
  const uniquePhones = phones.reduce((acc: ProviderPhone[], phone) => {
    const phoneNumber = phone.phone.replace(/\D/g, '') // Remove non-digits for comparison
    const exists = acc.some(p => p.phone.replace(/\D/g, '') === phoneNumber)
    if (!exists) {
      acc.push(phone)
    }
    return acc
  }, [])

  // If we have link_id, group by it
  if (addresses.some(a => a.link_id) && phones.some(p => p.link_id)) {
    return addresses.map(address => {
      const linkedPhones = phones.filter(phone => phone.link_id === address.link_id)
      return {
        address,
        phones: linkedPhones.length > 0 ? linkedPhones : [{ id: 0, phone: '', provider_id: address.provider_id }]
      }
    })
  }

  // Fallback: pair each address with all phones
  return addresses.map(address => ({
    address,
    phones: uniquePhones.length > 0 ? uniquePhones : [{ id: 0, phone: '', provider_id: address.provider_id }]
  }))
}

// Convert validation state to API format
export const transformValidationForApi = (validationState: {
  addressValidations: Record<number, any>
  phoneValidations: Record<number, any>
  newAddresses: any[]
}) => {
  return {
    address_validations: Object.values(validationState.addressValidations),
    phone_validations: Object.values(validationState.phoneValidations),
    new_addresses: validationState.newAddresses
  }
}

// Normalize phone number for comparison
export const normalizePhoneNumber = (phone: string): string => {
  return phone.replace(/\D/g, '')
}

// Extract unique values from array of objects
export const extractUniqueValues = <T, K extends keyof T>(
  array: T[],
  key: K,
  filter?: (value: T[K]) => boolean
): T[K][] => {
  const unique = new Set<T[K]>()
  
  array.forEach(item => {
    const value = item[key]
    if (!filter || filter(value)) {
      unique.add(value)
    }
  })
  
  return Array.from(unique)
}
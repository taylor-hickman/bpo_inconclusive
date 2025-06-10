import { useState, useCallback, useMemo } from 'react'
import { useApi } from './useApi'
import { validationService } from '@/services'
import type { 
  AddressValidation, 
  PhoneValidation, 
  NewAddress,
  ValidationState,
  ProviderValidationData
} from '@/lib/types'

interface UseValidationProps {
  providerData: ProviderValidationData | null
}

export function useValidation({ providerData }: UseValidationProps) {
  const [validationState, setValidationState] = useState<ValidationState>({
    addressValidations: {},
    phoneValidations: {},
    newAddresses: []
  })
  
  const updateValidationApi = useApi(validationService.updateValidation)
  const recordCallAttemptApi = useApi(validationService.recordCallAttempt)
  const completeValidationApi = useApi(validationService.completeValidation)
  
  const setAddressValidation = useCallback((addressId: number, validation: AddressValidation) => {
    setValidationState(prev => ({
      ...prev,
      addressValidations: {
        ...prev.addressValidations,
        [addressId]: validation
      }
    }))
  }, [])
  
  const setPhoneValidation = useCallback((phoneId: number, validation: PhoneValidation) => {
    setValidationState(prev => ({
      ...prev,
      phoneValidations: {
        ...prev.phoneValidations,
        [phoneId]: validation
      }
    }))
  }, [])
  
  const addNewAddress = useCallback((address: NewAddress) => {
    setValidationState(prev => ({
      ...prev,
      newAddresses: [...prev.newAddresses, address]
    }))
  }, [])
  
  const removeNewAddress = useCallback((index: number) => {
    setValidationState(prev => ({
      ...prev,
      newAddresses: prev.newAddresses.filter((_, i) => i !== index)
    }))
  }, [])
  
  const clearValidations = useCallback(() => {
    setValidationState({
      addressValidations: {},
      phoneValidations: {},
      newAddresses: []
    })
  }, [])
  
  const saveProgress = useCallback(async () => {
    if (!providerData?.validation_session) return
    
    const updateData = {
      address_validations: Object.values(validationState.addressValidations),
      phone_validations: Object.values(validationState.phoneValidations),
      new_addresses: validationState.newAddresses
    }
    
    return updateValidationApi.execute(providerData.validation_session.id, updateData)
  }, [providerData, validationState, updateValidationApi])
  
  const recordCallAttempt = useCallback(async (attemptNumber: number) => {
    if (!providerData?.validation_session) return
    
    return recordCallAttemptApi.execute(providerData.validation_session.id, {
      attempt_number: attemptNumber
    })
  }, [providerData, recordCallAttemptApi])
  
  const completeValidation = useCallback(async () => {
    if (!providerData?.validation_session) return
    
    // First save progress, then complete
    await saveProgress()
    return completeValidationApi.execute(providerData.validation_session.id)
  }, [providerData, saveProgress, completeValidationApi])
  
  const isValidationComplete = useMemo(() => {
    if (!providerData?.address_phone_records) return false
    
    // Check if all addresses and phones have been validated
    return providerData.address_phone_records.every(record => {
      const addressValidated = validationState.addressValidations[record.address.id]
      const phoneValidated = record.phone.id === 0 || validationState.phoneValidations[record.phone.id]
      return addressValidated && phoneValidated
    })
  }, [providerData, validationState])
  
  const validationProgress = useMemo(() => {
    if (!providerData?.address_phone_records) return { completed: 0, total: 0, percentage: 0 }
    
    const total = providerData.address_phone_records.length * 2 // address + phone
    let completed = 0
    
    providerData.address_phone_records.forEach(record => {
      if (validationState.addressValidations[record.address.id]) completed++
      if (record.phone.id === 0 || validationState.phoneValidations[record.phone.id]) completed++
    })
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }, [providerData, validationState])
  
  return {
    validationState,
    setAddressValidation,
    setPhoneValidation,
    addNewAddress,
    removeNewAddress,
    clearValidations,
    saveProgress,
    recordCallAttempt,
    completeValidation,
    isValidationComplete,
    validationProgress,
    isLoading: updateValidationApi.loading || recordCallAttemptApi.loading || completeValidationApi.loading,
    error: updateValidationApi.error || recordCallAttemptApi.error || completeValidationApi.error
  }
}
import { useState, useCallback, useMemo } from 'react'
import { useApi } from './useApi'
import { validationService } from '@/services'
import type { 
  AddressValidation, 
  PhoneValidation, 
  NewAddress,
  ValidationState,
  ProviderValidationData,
  ValidationPreview,
  ApiError
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
  const getValidationPreviewApi = useApi(validationService.getValidationPreview)
  
  const setAddressValidation = useCallback((validation: AddressValidation) => {
    setValidationState(prev => ({
      ...prev,
      addressValidations: {
        ...prev.addressValidations,
        [validation.address_id]: validation
      }
    }))
  }, [])
  
  const setPhoneValidation = useCallback((validation: PhoneValidation) => {
    setValidationState(prev => ({
      ...prev,
      phoneValidations: {
        ...prev.phoneValidations,
        [validation.phone_id]: validation
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
  
  const getValidationPreview = useCallback(async (): Promise<ValidationPreview | null> => {
    if (!providerData?.validation_session) return null
    return getValidationPreviewApi.execute(providerData.validation_session.id)
  }, [providerData, getValidationPreviewApi])

  const completeValidation = useCallback(async () => {
    if (!providerData?.validation_session) return
    
    // First save progress, then complete
    await saveProgress()
    return completeValidationApi.execute(providerData.validation_session.id)
  }, [providerData, saveProgress, completeValidationApi])
  
  
  const getErrorMessage = (error: string | ApiError | null): string | null => {
    if (!error) return null
    return typeof error === 'string' ? error : error.message
  }

  return {
    validationState,
    setAddressValidation,
    setPhoneValidation,
    addNewAddress,
    removeNewAddress,
    clearValidations,
    saveProgress,
    recordCallAttempt,
    getValidationPreview,
    completeValidation,
    isLoading: updateValidationApi.loading || recordCallAttemptApi.loading || completeValidationApi.loading || getValidationPreviewApi.loading,
    error: getErrorMessage(updateValidationApi.error || recordCallAttemptApi.error || completeValidationApi.error || getValidationPreviewApi.error)
  }
}
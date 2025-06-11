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
    if (!providerData?.validation_session) {
      console.log('Save progress skipped: no active session')
      return
    }
    
    const updateData = {
      address_validations: Object.values(validationState.addressValidations),
      phone_validations: Object.values(validationState.phoneValidations),
      new_addresses: validationState.newAddresses
    }
    
    try {
      return await updateValidationApi.execute(providerData.validation_session.id, updateData)
    } catch (error: any) {
      // Transform session-related errors
      if (error.message?.includes('session not found') || 
          error.message?.includes('already completed')) {
        throw new Error('Session expired or invalid. Please fetch a new provider.')
      }
      throw error
    }
  }, [providerData, validationState, updateValidationApi])
  
  const recordCallAttempt = useCallback(async (attemptNumber: number) => {
    if (!providerData?.validation_session) {
      throw new Error('No validation session available')
    }
    
    try {
      return await recordCallAttemptApi.execute(providerData.validation_session.id, {
        attempt_number: attemptNumber
      })
    } catch (error: any) {
      // Transform backend SQL errors into user-friendly messages
      if (error.message?.includes('no rows in result set')) {
        throw new Error('Session expired or invalid. Please fetch a new provider.')
      }
      throw error
    }
  }, [providerData, recordCallAttemptApi])
  
  const getValidationPreview = useCallback(async (): Promise<ValidationPreview | null> => {
    if (!providerData?.validation_session) {
      console.log('Preview fetch skipped: no active session')
      return null
    }
    
    try {
      return await getValidationPreviewApi.execute(providerData.validation_session.id)
    } catch (error: any) {
      // Transform session-related errors
      if (error.message?.includes('session not found') || 
          error.message?.includes('already completed')) {
        console.log('Preview fetch failed: session no longer valid')
        return null
      }
      throw error
    }
  }, [providerData, getValidationPreviewApi])

  const completeValidation = useCallback(async () => {
    if (!providerData?.validation_session) {
      throw new Error('No validation session available')
    }
    
    // First save progress, then complete
    try {
      await saveProgress()
    } catch (saveError) {
      // Log but don't fail completely - let user decide
      console.warn('Failed to save progress before completion:', saveError)
      // Re-throw to let the UI handle this appropriately
      throw new Error(`Failed to save progress: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`)
    }
    
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
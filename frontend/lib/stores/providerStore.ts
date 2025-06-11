import { create } from 'zustand'
import { providerService, validationService } from '@/services'
import type { 
  ProviderValidationData, 
  ProviderStats, 
  AddressValidation, 
  PhoneValidation, 
  NewAddress 
} from '@/lib/types'

interface ProviderStoreState {
  currentData: ProviderValidationData | null
  stats: ProviderStats | null
  isLoading: boolean
  error: string | null
  addressValidations: Record<number, AddressValidation>
  phoneValidations: Record<number, PhoneValidation>
  newAddresses: NewAddress[]
  
  // Actions
  fetchNextProvider: () => Promise<void>
  updateValidations: () => Promise<void>
  recordCallAttempt: (attemptNumber: number) => Promise<void>
  completeValidation: () => Promise<void>
  fetchStats: () => Promise<void>
  
  setAddressValidation: (addressId: number, validation: AddressValidation) => void
  setPhoneValidation: (phoneId: number, validation: PhoneValidation) => void
  addNewAddress: (address: NewAddress) => void
  removeNewAddress: (index: number) => void
  clearValidations: () => void
  clearError: () => void
}

export const useProviderStore = create<ProviderStoreState>((set, get) => ({
  currentData: null,
  stats: null,
  isLoading: false,
  error: null,
  addressValidations: {},
  phoneValidations: {},
  newAddresses: [],

  fetchNextProvider: async () => {
    set({ isLoading: true, error: null })
    try {
      const provider = await providerService.getNextProvider()
      set({ 
        currentData: provider, 
        isLoading: false,
        addressValidations: {},
        phoneValidations: {},
        newAddresses: [] 
      })
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        set({ 
          error: 'Authentication required. Please login again.', 
          currentData: null,
          isLoading: false 
        })
      } else if (error.message?.includes('404') || error.message?.includes('No providers')) {
        set({ 
          error: 'No providers available for validation', 
          currentData: null,
          isLoading: false 
        })
      } else {
        set({ 
          error: error.message || 'Failed to fetch provider', 
          isLoading: false 
        })
      }
    }
  },

  updateValidations: async () => {
    const { currentData, addressValidations, phoneValidations, newAddresses } = get()
    if (!currentData?.validation_session) return
    
    set({ isLoading: true, error: null })
    try {
      await validationService.updateValidation(currentData.validation_session.id, {
        address_validations: Object.values(addressValidations),
        phone_validations: Object.values(phoneValidations),
        new_addresses: newAddresses
      })
      set({ isLoading: false })
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to update validation'
      
      // Handle session-related errors
      if (errorMessage.includes('no rows in result set') || errorMessage.includes('session not found')) {
        errorMessage = 'Session expired or invalid. Please fetch a new provider.'
        set({ 
          currentData: null,
          error: errorMessage, 
          isLoading: false 
        })
      } else {
        set({ 
          error: errorMessage, 
          isLoading: false 
        })
      }
      throw new Error(errorMessage)
    }
  },

  recordCallAttempt: async (attemptNumber: number) => {
    const { currentData } = get()
    if (!currentData?.validation_session) {
      throw new Error('No validation session available')
    }
    
    set({ isLoading: true, error: null })
    try {
      await validationService.recordCallAttempt(currentData.validation_session.id, {
        attempt_number: attemptNumber
      })
      
      // Immediately update the local state with the current timestamp
      const now = new Date().toISOString()
      const updatedSession = { ...currentData.validation_session }
      
      if (attemptNumber === 1) {
        updatedSession.call_attempt_1 = now
      } else if (attemptNumber === 2) {
        updatedSession.call_attempt_2 = now
      }
      
      set({ 
        currentData: {
          ...currentData,
          validation_session: updatedSession
        },
        isLoading: false 
      })
      
      // Also refresh from server to ensure consistency
      await get().fetchNextProvider()
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to record call attempt'
      
      // Handle specific error cases
      if (errorMessage.includes('no rows in result set') || errorMessage.includes('session not found')) {
        errorMessage = 'Session expired or invalid. Please fetch a new provider.'
        // Clear current data since session is invalid
        set({ 
          currentData: null,
          error: errorMessage, 
          isLoading: false 
        })
      } else if (errorMessage.includes('session is not in progress')) {
        errorMessage = 'This validation session is no longer active. Please fetch a new provider.'
        // Clear current data since session is not active
        set({ 
          currentData: null,
          error: errorMessage, 
          isLoading: false 
        })
      } else {
        set({ 
          error: errorMessage, 
          isLoading: false 
        })
      }
      throw new Error(errorMessage)
    }
  },

  completeValidation: async () => {
    const { currentData } = get()
    if (!currentData?.validation_session) {
      throw new Error('No validation session found')
    }
    
    const sessionId = currentData.validation_session.id
    set({ isLoading: true, error: null })
    
    try {
      // First save any pending validations, but don't fail completion if this fails
      try {
        await get().updateValidations()
      } catch (updateError: any) {
        console.warn('Failed to update validations before completion:', updateError)
        // Continue with completion even if update fails
      }
      
      // Then complete the session
      await validationService.completeValidation(sessionId)
      
      // Immediately clear current data to prevent further operations on completed session
      set({ 
        currentData: null,
        addressValidations: {},
        phoneValidations: {},
        newAddresses: [],
        isLoading: false,
        error: null
      })
      
      // Fetch next provider and refresh stats
      await get().fetchNextProvider()
      await get().fetchStats()
    } catch (error: any) {
      // If completion fails, don't clear the session data yet
      set({ 
        error: error.message || 'Failed to complete validation', 
        isLoading: false 
      })
      throw error
    }
  },

  fetchStats: async () => {
    try {
      const stats = await providerService.getStats()
      set({ stats })
    } catch (error) {
      // Don't set error for stats fetch failure, it's not critical
      console.error('Failed to fetch stats:', error)
    }
  },

  setAddressValidation: (addressId, validation) => {
    set((state) => ({
      addressValidations: {
        ...state.addressValidations,
        [addressId]: validation
      }
    }))
  },

  setPhoneValidation: (phoneId, validation) => {
    set((state) => ({
      phoneValidations: {
        ...state.phoneValidations,
        [phoneId]: validation
      }
    }))
  },

  addNewAddress: (address) => {
    set((state) => ({
      newAddresses: [...state.newAddresses, address]
    }))
  },

  removeNewAddress: (index) => {
    set((state) => ({
      newAddresses: state.newAddresses.filter((_, i) => i !== index)
    }))
  },

  clearValidations: () => {
    set({ 
      addressValidations: {},
      phoneValidations: {},
      newAddresses: []
    })
  },

  clearError: () => {
    set({ error: null })
  }
}))
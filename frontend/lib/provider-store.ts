import { create } from 'zustand'
import axios from 'axios'
import Cookies from 'js-cookie'
import { useAuthStore } from './auth-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_URL,
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Let individual components handle 401 errors
    return Promise.reject(error)
  }
)

interface ProviderAddress {
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

interface ProviderPhone {
  id: number
  provider_id: number
  phone: string
  is_correct?: boolean
  corrected_phone?: string
  link_id?: string
}

interface Provider {
  id: number
  npi: string
  gnpi: string
  provider_name: string
  specialty: string
  provider_group: string
}

interface ValidationSession {
  id: number
  provider_id: number
  user_id: number
  call_attempt_1?: string
  call_attempt_2?: string
  closed_date?: string
  status: string
}

interface AddressPhoneRecord {
  id: string  // composite identifier: "addr_id-phone_id"
  address: ProviderAddress
  phone: ProviderPhone
}

interface ProviderValidationData {
  provider: Provider
  address_phone_records: AddressPhoneRecord[]
  addresses?: ProviderAddress[]
  phones?: ProviderPhone[]
  validation_session?: ValidationSession
}

interface AddressValidation {
  address_id: number
  is_correct: boolean
  corrected_address1?: string
  corrected_address2?: string
  corrected_city?: string
  corrected_state?: string
  corrected_zip?: string
}

interface PhoneValidation {
  phone_id: number
  is_correct: boolean
  corrected_phone?: string
}

interface ProviderStats {
  total_pending: number
  completed_today: number
  in_progress: number
  total_inconclusive: number
  currently_locked: number
}

interface ProviderState {
  currentData: ProviderValidationData | null
  stats: ProviderStats | null
  isLoading: boolean
  error: string | null
  addressValidations: Record<number, AddressValidation>
  phoneValidations: Record<number, PhoneValidation>
  newAddresses: Array<{
    address_category: string
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
  }>
  
  fetchNextProvider: () => Promise<void>
  updateValidations: () => Promise<void>
  recordCallAttempt: (attemptNumber: number) => Promise<void>
  completeValidation: () => Promise<void>
  fetchStats: () => Promise<void>
  
  setAddressValidation: (addressId: number, validation: AddressValidation) => void
  setPhoneValidation: (phoneId: number, validation: PhoneValidation) => void
  addNewAddress: (address: any) => void
  removeNewAddress: (index: number) => void
  clearValidations: () => void
}

export const useProviderStore = create<ProviderState>((set, get) => ({
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
      console.log('Fetching next provider...')
      const token = Cookies.get('token')
      console.log('Token exists:', !!token)
      
      const response = await api.get('/providers/next')
      console.log('Provider response:', response.data)
      
      set({ 
        currentData: response.data, 
        isLoading: false,
        addressValidations: {},
        phoneValidations: {},
        newAddresses: [] 
      })
    } catch (error: any) {
      console.error('Failed to fetch provider:', error)
      console.error('Error response:', error.response)
      
      if (error.response?.status === 401) {
        // Unauthorized - token might be invalid
        set({ 
          error: 'Authentication required. Please login again.', 
          currentData: null,
          isLoading: false 
        })
        // Clear the token and redirect to login
        const authStore = useAuthStore.getState()
        authStore.logout()
        window.location.href = '/login'
      } else if (error.response?.status === 404) {
        set({ 
          error: 'No providers available for validation', 
          currentData: null,
          isLoading: false 
        })
      } else {
        const errorMessage = typeof error.response?.data === 'string' 
          ? error.response.data 
          : error.response?.data?.message || error.message || 'Failed to fetch provider'
        set({ 
          error: errorMessage, 
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
      await api.put(`/sessions/${currentData.validation_session.id}/validate`, {
        address_validations: Object.values(addressValidations),
        phone_validations: Object.values(phoneValidations),
        new_addresses: newAddresses
      })
      
      set({ isLoading: false })
    } catch (error: any) {
      set({ 
        error: error.response?.data || 'Failed to update validation', 
        isLoading: false 
      })
      throw error
    }
  },

  recordCallAttempt: async (attemptNumber: number) => {
    const { currentData } = get()
    if (!currentData?.validation_session) return
    
    set({ isLoading: true, error: null })
    try {
      await api.post(`/sessions/${currentData.validation_session.id}/call-attempt`, {
        attempt_number: attemptNumber
      })
      
      // Refresh current provider to get updated call attempt times
      await get().fetchNextProvider()
    } catch (error: any) {
      set({ 
        error: error.response?.data || 'Failed to record call attempt', 
        isLoading: false 
      })
      throw error
    }
  },

  completeValidation: async () => {
    const { currentData } = get()
    if (!currentData?.validation_session) return
    
    set({ isLoading: true, error: null })
    try {
      // First save any pending validations
      await get().updateValidations()
      
      // Then complete the session
      await api.post(`/sessions/${currentData.validation_session.id}/complete`)
      
      // Fetch next provider
      await get().fetchNextProvider()
      await get().fetchStats()
    } catch (error: any) {
      set({ 
        error: error.response?.data || 'Failed to complete validation', 
        isLoading: false 
      })
      throw error
    }
  },

  fetchStats: async () => {
    try {
      const response = await api.get('/providers/stats')
      set({ stats: response.data })
    } catch (error) {
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
  }
}))
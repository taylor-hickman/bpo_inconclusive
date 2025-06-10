import { create } from 'zustand'
import { providerService } from '@/services'
import type { ProviderValidationData, ProviderStats } from '@/lib/types'

interface ProviderStoreState {
  currentProvider: ProviderValidationData | null
  stats: ProviderStats | null
  isLoading: boolean
  isStatsLoading: boolean
  error: string | null
  
  // Actions
  fetchNextProvider: () => Promise<ProviderValidationData>
  fetchStats: () => Promise<ProviderStats | null>
  refreshData: () => Promise<void>
  clearProvider: () => void
  clearError: () => void
}

export const useProviderStore = create<ProviderStoreState>((set, get) => ({
  currentProvider: null,
  stats: null,
  isLoading: false,
  isStatsLoading: false,
  error: null,

  fetchNextProvider: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const provider = await providerService.getNextProvider()
      set({ currentProvider: provider, isLoading: false })
      return provider
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch provider'
      set({ error: errorMessage, isLoading: false, currentProvider: null })
      throw error
    }
  },

  fetchStats: async () => {
    set({ isStatsLoading: true })
    
    try {
      const stats = await providerService.getStats()
      set({ stats, isStatsLoading: false })
      return stats
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      set({ isStatsLoading: false })
      return null
    }
  },

  refreshData: async () => {
    const promises = [
      get().fetchNextProvider(),
      get().fetchStats()
    ]
    
    await Promise.allSettled(promises)
  },

  clearProvider: () => {
    set({ currentProvider: null, error: null })
  },

  clearError: () => {
    set({ error: null })
  }
}))
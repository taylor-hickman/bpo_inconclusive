import { useState, useCallback } from 'react'
import { providerService } from '@/services'
import type { ProviderValidationData, ProviderStats } from '@/lib/types'

export function useProviderData() {
  const [currentProvider, setCurrentProvider] = useState<ProviderValidationData | null>(null)
  const [stats, setStats] = useState<ProviderStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isStatsLoading, setIsStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const fetchNextProvider = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const provider = await providerService.getNextProvider()
      setCurrentProvider(provider)
      setIsLoading(false)
      return provider
    } catch (error: any) {
      setCurrentProvider(null)
      setError(error.message || 'Failed to fetch provider')
      setIsLoading(false)
      throw error
    }
  }, [])
  
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true)
    
    try {
      const statsData = await providerService.getStats()
      setStats(statsData)
      setIsStatsLoading(false)
      return statsData
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setIsStatsLoading(false)
      // Don't throw stats errors - they're not critical
      return null
    }
  }, [])
  
  const refreshData = useCallback(async () => {
    const promises = [fetchNextProvider(), fetchStats()]
    await Promise.allSettled(promises)
  }, [fetchNextProvider, fetchStats])
  
  return {
    currentProvider,
    stats,
    fetchNextProvider,
    fetchStats,
    refreshData,
    isLoading,
    isStatsLoading,
    error
  }
}
import { useState, useCallback } from 'react'
import type { ApiError } from '@/lib/types'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T>
  reset: () => void
}

export function useApi<T>(
  apiFunction: (...args: any[]) => Promise<T>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null
  })
  
  const execute = useCallback(async (...args: any[]): Promise<T> => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await apiFunction(...args)
      setState({ data: result, loading: false, error: null })
      return result
    } catch (error) {
      const apiError = error as ApiError
      setState(prev => ({ ...prev, loading: false, error: apiError }))
      throw error
    }
  }, [apiFunction])
  
  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])
  
  return {
    ...state,
    execute,
    reset
  }
}
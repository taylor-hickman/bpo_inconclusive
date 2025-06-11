'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { checkAuth, token } = useAuthStore()

  useEffect(() => {
    // Only check auth if we have a token
    if (token) {
      checkAuth().catch(() => {
        // Silently handle auth check failures
        // The store will clear the token if it's invalid
      })
    }
  }, []) // Remove dependencies to only run once on mount

  return <>{children}</>
}
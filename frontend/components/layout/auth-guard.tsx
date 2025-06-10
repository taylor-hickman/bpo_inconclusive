'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores'
import { Loader2 } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Give the auth store time to initialize from cookies
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isInitialized && !token) {
      router.push('/login')
    }
  }, [isInitialized, token, router])

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If no token after initialization, will redirect via useEffect
  if (!token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
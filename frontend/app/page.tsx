'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Small delay to ensure auth state is initialized
    const timer = setTimeout(() => {
      if (token) {
        router.push('/validation')
      } else {
        router.push('/login')
      }
      setIsChecking(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [token, router])

  if (!isChecking) {
    return null // Don't render anything while redirecting
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
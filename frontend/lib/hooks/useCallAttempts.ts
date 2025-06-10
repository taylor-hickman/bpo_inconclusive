import { useMemo } from 'react'
import type { ValidationSession } from '@/lib/types'

interface UseCallAttemptsProps {
  session: ValidationSession | null
}

export function useCallAttempts({ session }: UseCallAttemptsProps) {
  const callAttempts = useMemo(() => {
    if (!session) return []
    
    const attempts = []
    if (session.call_attempt_1) {
      attempts.push({
        number: 1,
        timestamp: session.call_attempt_1,
        date: new Date(session.call_attempt_1)
      })
    }
    if (session.call_attempt_2) {
      attempts.push({
        number: 2,
        timestamp: session.call_attempt_2,
        date: new Date(session.call_attempt_2)
      })
    }
    
    return attempts
  }, [session])
  
  const canMakeCallAttempt = useMemo(() => {
    if (!session) return false
    if (callAttempts.length >= 2) return false
    
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    // Can't call on weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) return false
    
    // If there's a previous attempt, check if it was on a different business day
    if (callAttempts.length > 0) {
      const lastAttempt = callAttempts[callAttempts.length - 1].date
      const lastAttemptDay = lastAttempt.toDateString()
      const todayString = today.toDateString()
      
      // Can't make multiple attempts on the same day
      if (lastAttemptDay === todayString) return false
      
      // Check if there's at least one business day between attempts
      const diffTime = today.getTime() - lastAttempt.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays < 1) return false
    }
    
    return true
  }, [session, callAttempts])
  
  const nextAttemptNumber = useMemo(() => {
    return callAttempts.length + 1
  }, [callAttempts])
  
  const formatCallAttempt = (timestamp: string) => {
    const date = new Date(timestamp)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' })
    }
  }
  
  return {
    callAttempts,
    canMakeCallAttempt,
    nextAttemptNumber,
    formatCallAttempt,
    maxAttemptsReached: callAttempts.length >= 2
  }
}
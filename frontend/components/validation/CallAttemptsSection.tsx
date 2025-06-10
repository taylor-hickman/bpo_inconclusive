'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Phone, AlertCircle } from 'lucide-react'
import { useCallAttempts } from '@/lib/hooks'
import type { ValidationSession } from '@/lib/types'

interface CallAttemptsSectionProps {
  session: ValidationSession | null
  onRecordAttempt: (attemptNumber: number) => Promise<void>
  isLoading: boolean
}

export function CallAttemptsSection({
  session,
  onRecordAttempt,
  isLoading
}: CallAttemptsSectionProps) {
  const {
    callAttempts,
    canMakeCallAttempt,
    nextAttemptNumber,
    formatCallAttempt,
    maxAttemptsReached
  } = useCallAttempts({ session })
  
  const handleRecordAttempt = async () => {
    if (canMakeCallAttempt) {
      await onRecordAttempt(nextAttemptNumber)
    }
  }
  
  const getAttemptStatusColor = (attemptNumber: number) => {
    if (attemptNumber <= callAttempts.length) {
      return 'bg-green-100 text-green-800'
    }
    return 'bg-gray-100 text-gray-800'
  }
  
  const getCallRestrictionMessage = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 'Call attempts are only allowed on business days (Monday-Friday)'
    }
    
    if (maxAttemptsReached) {
      return 'Maximum of 2 call attempts have been reached'
    }
    
    if (callAttempts.length > 0) {
      const lastAttempt = callAttempts[callAttempts.length - 1]
      const lastAttemptDate = lastAttempt.date.toDateString()
      const todayString = today.toDateString()
      
      if (lastAttemptDate === todayString) {
        return 'Only one call attempt per business day is allowed'
      }
    }
    
    return null
  }
  
  const restrictionMessage = getCallRestrictionMessage()
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Call Attempts
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Attempt History */}
        <div className="space-y-3">
          {[1, 2].map((attemptNum) => {
            const attempt = callAttempts.find(a => a.number === attemptNum)
            const isCompleted = !!attempt
            
            return (
              <div
                key={attemptNum}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={getAttemptStatusColor(attemptNum)}
                  >
                    Attempt {attemptNum}
                  </Badge>
                  
                  {isCompleted && attempt ? (
                    <div className="text-sm">
                      <p className="font-medium">
                        {formatCallAttempt(attempt.timestamp).date} at{' '}
                        {formatCallAttempt(attempt.timestamp).time}
                      </p>
                      <p className="text-muted-foreground">
                        {formatCallAttempt(attempt.timestamp).dayOfWeek}
                      </p>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Not attempted
                    </div>
                  )}
                </div>
                
                {attemptNum === nextAttemptNumber && canMakeCallAttempt && (
                  <Button
                    size="sm"
                    onClick={handleRecordAttempt}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Record Now
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Restriction Message */}
        {restrictionMessage && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Call Restriction</p>
              <p className="text-sm text-amber-700">{restrictionMessage}</p>
            </div>
          </div>
        )}
        
        {/* Instructions */}
        <div className="text-xs text-muted-foreground">
          <p>• Maximum 2 call attempts per provider</p>
          <p>• Call attempts must be on different business days</p>
          <p>• No calls on weekends or holidays</p>
        </div>
      </CardContent>
    </Card>
  )
}
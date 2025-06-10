'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorDisplayProps {
  error: string | Error | null
  onRetry?: () => void
  onDismiss?: () => void
  variant?: 'card' | 'banner' | 'inline'
  className?: string
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  variant = 'card',
  className
}: ErrorDisplayProps) {
  if (!error) return null
  
  const errorMessage = typeof error === 'string' ? error : error.message
  
  const content = (
    <div className="flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-red-900">Error</h4>
        <p className="text-sm text-red-700 mt-1 break-words">{errorMessage}</p>
        
        {(onRetry || onDismiss) && (
          <div className="flex items-center gap-2 mt-3">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-50"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8 px-2 text-xs text-red-600 hover:bg-red-50"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
  
  if (variant === 'card') {
    return (
      <Card className={cn("border-red-200 bg-red-50", className)}>
        <CardContent className="pt-6">
          {content}
        </CardContent>
      </Card>
    )
  }
  
  if (variant === 'banner') {
    return (
      <div className={cn(
        "p-4 border border-red-200 bg-red-50 rounded-lg",
        className
      )}>
        {content}
      </div>
    )
  }
  
  // Inline variant
  return (
    <div className={cn(
      "flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded",
      className
    )}>
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 min-w-0">{errorMessage}</span>
      
      {onDismiss && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
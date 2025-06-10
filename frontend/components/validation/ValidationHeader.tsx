'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2, AlertCircle } from 'lucide-react'

interface ValidationHeaderProps {
  isLoading: boolean
  error: string | null
  progress: {
    completed: number
    total: number
    percentage: number
  }
  onGrabNext: () => void
  onSaveProgress: () => void
  onComplete: () => void
  canComplete: boolean
  hasProvider: boolean
}

export function ValidationHeader({
  isLoading,
  error,
  progress,
  onGrabNext,
  onSaveProgress,
  onComplete,
  canComplete,
  hasProvider
}: ValidationHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button 
          onClick={onGrabNext}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Grab Next Provider
        </Button>
        
        {hasProvider && (
          <>
            <Button 
              variant="outline" 
              onClick={onSaveProgress}
              disabled={isLoading}
            >
              Save Progress
            </Button>
            
            <Button 
              onClick={onComplete}
              disabled={isLoading || !canComplete}
              className="bg-green-600 hover:bg-green-700"
            >
              Complete Validation
            </Button>
          </>
        )}
      </div>

      {/* Progress indicator */}
      {hasProvider && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Validation Progress</span>
                <span>{progress.completed}/{progress.total} items</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {progress.percentage}% complete
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-900">Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
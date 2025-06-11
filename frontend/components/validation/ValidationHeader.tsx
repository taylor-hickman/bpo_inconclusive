'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import type { ValidationPreview } from '@/lib/types'

interface ValidationHeaderProps {
  isLoading: boolean
  error: string | null
  onGrabNext: () => void
  onSaveProgress: () => void
  onComplete: () => void
  hasProvider: boolean
  getValidationPreview: () => Promise<ValidationPreview | null>
  onPreviewUpdate?: (preview: ValidationPreview | null) => void
}

export function ValidationHeader({
  isLoading,
  error,
  onGrabNext,
  onSaveProgress,
  onComplete,
  hasProvider,
  getValidationPreview,
  onPreviewUpdate
}: ValidationHeaderProps) {
  const [preview, setPreview] = useState<ValidationPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const fetchPreview = async () => {
    if (!hasProvider) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const result = await getValidationPreview()
      setPreview(result)
      onPreviewUpdate?.(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get validation status'
      // If session is not found, silently clear preview instead of showing error
      if (errorMessage.includes('session not found') || 
          errorMessage.includes('already completed') ||
          errorMessage.includes('Session expired')) {
        setPreview(null)
        setPreviewError(null)
        onPreviewUpdate?.(null)
        console.log('Preview fetch skipped: session no longer valid')
      } else {
        setPreviewError(errorMessage)
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  useEffect(() => {
    fetchPreview()
  }, [hasProvider])

  const handleSaveProgress = async () => {
    try {
      await onSaveProgress()
      // Only fetch preview if we still have a provider (session might be completed)
      if (hasProvider) {
        await fetchPreview()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save progress'
      if (errorMessage.includes('session not found') || 
          errorMessage.includes('already completed') ||
          errorMessage.includes('Session expired')) {
        // Clear preview state instead of showing error
        setPreview(null)
        setPreviewError(null)
        onPreviewUpdate?.(null)
        console.log('Save progress failed: session no longer valid')
      }
      // Let the parent component handle other errors
      throw err
    }
  }

  const handleComplete = async () => {
    if (!preview?.can_complete) {
      await fetchPreview()
      return
    }
    
    try {
      await onComplete()
      // Clear preview after successful completion
      setPreview(null)
      setPreviewError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete validation'
      if (errorMessage.includes('session not found') || errorMessage.includes('already completed')) {
        setPreviewError('Session expired. Please fetch a new provider.')
        setPreview(null)
      } else {
        // Refresh preview to get current state after error
        await fetchPreview()
      }
      throw err
    }
  }

  const progress = preview ? {
    completed: preview.total_validated,
    total: preview.total_required,
    percentage: preview.total_required > 0 ? Math.round((preview.total_validated / preview.total_required) * 100) : 0
  } : { completed: 0, total: 0, percentage: 0 }

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
              onClick={handleSaveProgress}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {previewLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : null}
              Save Progress
            </Button>
            
            <Button 
              onClick={handleComplete}
              disabled={isLoading || previewLoading || !preview?.can_complete || 
                       (preview && (preview.unvalidated_addresses.length > 0 || preview.unvalidated_phones.length > 0))}
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
            >
              {preview?.can_complete && preview.unvalidated_addresses.length === 0 && preview.unvalidated_phones.length === 0 ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Complete Validation
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchPreview}
              disabled={previewLoading}
              title="Refresh validation status"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${previewLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        )}
      </div>

      {/* Progress indicator with validation status */}
      {hasProvider && preview && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Validation Progress</span>
                <Badge 
                  variant={preview.can_complete && preview.unvalidated_addresses.length === 0 && preview.unvalidated_phones.length === 0 ? "default" : "secondary"}
                  className={preview.can_complete && preview.unvalidated_addresses.length === 0 && preview.unvalidated_phones.length === 0 ? "bg-green-100 text-green-800" : ""}
                >
                  {preview.can_complete && preview.unvalidated_addresses.length === 0 && preview.unvalidated_phones.length === 0 ? "Ready to Complete" : "In Progress"}
                </Badge>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Items Validated</span>
                <span>{progress.completed}/{progress.total}</span>
              </div>
              
              <Progress value={progress.percentage} className="h-2" />
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{progress.percentage}% complete</p>
                {preview.message && (
                  <p className={preview.can_complete && preview.unvalidated_addresses.length === 0 && preview.unvalidated_phones.length === 0 ? "text-green-600" : "text-amber-600"}>
                    {preview.message}
                  </p>
                )}
                
                {/* Enhanced completion requirement message */}
                {preview.can_complete && (preview.unvalidated_addresses.length > 0 || preview.unvalidated_phones.length > 0) && (
                  <p className="text-amber-600">
                    Cannot complete: Both addresses and phones must be validated
                  </p>
                )}
              </div>

              {/* Show remaining items if any */}
              {!preview.can_complete && ((preview.unvalidated_addresses?.length || 0) > 0 || (preview.unvalidated_phones?.length || 0) > 0) && (
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <h5 className="text-sm font-medium text-amber-900 mb-2">Remaining Items:</h5>
                  <div className="text-xs text-amber-800 space-y-1">
                    {(preview.unvalidated_addresses?.length || 0) > 0 && (
                      <p>• {preview.unvalidated_addresses?.length || 0} address(es) need validation</p>
                    )}
                    {(preview.unvalidated_phones?.length || 0) > 0 && (
                      <p>• {preview.unvalidated_phones?.length || 0} phone(s) need validation</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {(error || previewError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-900">Error</h4>
                <p className="text-sm text-red-700">{error || previewError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
import { useEffect, useCallback, useRef } from 'react'

interface UseAutoSaveProps {
  data: any
  onSave: () => Promise<void>
  delay?: number
  enabled?: boolean
}

export function useAutoSave({ 
  data, 
  onSave, 
  delay = 2000, 
  enabled = true 
}: UseAutoSaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const previousDataRef = useRef(data)
  const isSavingRef = useRef(false)

  const debouncedSave = useCallback(async () => {
    if (!enabled || isSavingRef.current) return

    try {
      isSavingRef.current = true
      await onSave()
    } catch (error: any) {
      // Silently ignore session-related errors for auto-save
      if (error?.message?.includes('session not found') || 
          error?.message?.includes('already completed') ||
          error?.message?.includes('Session expired')) {
        console.log('Auto-save skipped: session no longer valid')
      } else {
        console.error('Auto-save failed:', error)
      }
    } finally {
      isSavingRef.current = false
    }
  }, [onSave, enabled])

  useEffect(() => {
    if (!enabled) return

    // Check if data has actually changed
    const hasChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    
    if (hasChanged) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set new timeout
      timeoutRef.current = setTimeout(debouncedSave, delay)
      
      // Update previous data
      previousDataRef.current = data
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, debouncedSave, delay, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    await debouncedSave()
  }, [debouncedSave])

  return { saveNow, isSaving: isSavingRef.current }
}
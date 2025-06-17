'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NewPhone } from '@/lib/types'
import { validatePhoneNumber, sanitizeInput, formatPhoneNumber } from '@/lib/utils'

interface AddNewPhoneDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (phone: NewPhone) => void
}

export function AddNewPhoneDialog({
  isOpen,
  onClose,
  onSubmit
}: AddNewPhoneDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState<string>('')
  
  const handlePhoneChange = (value: string) => {
    // Allow only digits, spaces, hyphens, parentheses, and plus sign
    const cleaned = value.replace(/[^\d\s\-\(\)\+]/g, '')
    setPhoneNumber(cleaned)
    
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const cleanedPhone = sanitizeInput(phoneNumber)
    
    if (!validatePhoneNumber(cleanedPhone)) {
      setError('Please enter a valid 10-digit phone number')
      return
    }
    
    onSubmit({
      phone: cleanedPhone
    })
    
    // Reset form and close
    setPhoneNumber('')
    setError('')
    onClose()
  }
  
  const handleCancel = () => {
    setPhoneNumber('')
    setError('')
    onClose()
  }
  
  const formattedPreview = phoneNumber ? formatPhoneNumber(phoneNumber) : ''
  
  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Phone Number</DialogTitle>
          <DialogDescription>
            Add a new phone number that was discovered during validation.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              required
              autoFocus
            />
            {formattedPreview && formattedPreview !== phoneNumber && (
              <p className="text-sm text-muted-foreground">
                Preview: {formattedPreview}
              </p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Add Phone
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
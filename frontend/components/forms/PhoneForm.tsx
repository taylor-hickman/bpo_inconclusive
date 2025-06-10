'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProviderPhone, PhoneValidation } from '@/lib/types'
import { validatePhoneNumber, sanitizeInput, formatPhoneNumber } from '@/lib/utils'

interface PhoneFormProps {
  phone: ProviderPhone
  validation?: PhoneValidation
  onSubmit: (data: PhoneValidation) => void
  onCancel: () => void
}

export function PhoneForm({
  phone,
  validation,
  onSubmit,
  onCancel
}: PhoneFormProps) {
  const [phoneNumber, setPhoneNumber] = useState(
    validation?.corrected_phone || phone.phone || ''
  )
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
      phone_id: phone.id,
      is_correct: false,
      corrected_phone: cleanedPhone
    })
  }
  
  const formattedPreview = phoneNumber ? formatPhoneNumber(phoneNumber) : ''
  
  return (
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
        />
        {formattedPreview && formattedPreview !== phoneNumber && (
          <p className="text-sm text-muted-foreground">
            Preview: {formattedPreview}
          </p>
        )}
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Save Correction
        </Button>
      </div>
    </form>
  )
}
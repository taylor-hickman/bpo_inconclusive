'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ProviderAddress, AddressValidation } from '@/lib/types'
import { validateAddress, sanitizeInput } from '@/lib/utils'

interface AddressFormProps {
  address?: ProviderAddress
  validation?: AddressValidation
  onSubmit: (data: Partial<AddressValidation>) => void
  onCancel: () => void
  isNew?: boolean
}

export function AddressForm({
  address,
  validation,
  onSubmit,
  onCancel,
  isNew = false
}: AddressFormProps) {
  const [formData, setFormData] = useState({
    address_category: address?.address_category || validation?.corrected_address1 ? 'practice' : '',
    address1: validation?.corrected_address1 || address?.address1 || '',
    address2: validation?.corrected_address2 || address?.address2 || '',
    city: validation?.corrected_city || address?.city || '',
    state: validation?.corrected_state || address?.state || '',
    zip: validation?.corrected_zip || address?.zip || ''
  })
  
  const [errors, setErrors] = useState<string[]>([])
  
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: sanitizeInput(value)
    }))
    
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([])
    }
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const addressValidation = validateAddress({
      address1: formData.address1,
      city: formData.city,
      state: formData.state,
      zip: formData.zip
    })
    
    if (!addressValidation.isValid) {
      setErrors(addressValidation.errors)
      return
    }
    
    if (isNew) {
      onSubmit({
        address_category: formData.address_category,
        corrected_address1: formData.address1,
        corrected_address2: formData.address2,
        corrected_city: formData.city,
        corrected_state: formData.state.toUpperCase(),
        corrected_zip: formData.zip
      })
    } else {
      onSubmit({
        address_id: address?.id,
        is_correct: false,
        corrected_address1: formData.address1,
        corrected_address2: formData.address2,
        corrected_city: formData.city,
        corrected_state: formData.state.toUpperCase(),
        corrected_zip: formData.zip
      })
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-900 mb-1">Please fix the following errors:</p>
          <ul className="text-sm text-red-700 list-disc list-inside">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {isNew && (
        <div className="space-y-2">
          <Label htmlFor="address_category">Address Category</Label>
          <Select
            value={formData.address_category}
            onValueChange={(value) => handleInputChange('address_category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="practice">Practice</SelectItem>
              <SelectItem value="mailing">Mailing</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="address1">Address Line 1</Label>
        <Input
          id="address1"
          value={formData.address1}
          onChange={(e) => handleInputChange('address1', e.target.value)}
          placeholder="123 Main Street"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="address2">Address Line 2 (Optional)</Label>
        <Input
          id="address2"
          value={formData.address2}
          onChange={(e) => handleInputChange('address2', e.target.value)}
          placeholder="Suite 100"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder="City"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            value={formData.state}
            onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
            placeholder="CA"
            maxLength={2}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="zip">ZIP Code</Label>
        <Input
          id="zip"
          value={formData.zip}
          onChange={(e) => handleInputChange('zip', e.target.value)}
          placeholder="12345"
          required
        />
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isNew ? 'Add Address' : 'Save Correction'}
        </Button>
      </div>
    </form>
  )
}
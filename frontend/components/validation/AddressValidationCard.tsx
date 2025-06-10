'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Edit, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProviderAddress, AddressValidation } from '@/lib/types'
import { formatAddress, getSqlString } from '@/lib/utils/index'

interface AddressValidationCardProps {
  address: ProviderAddress
  validation?: AddressValidation
  onValidationChange: (validation: AddressValidation) => void
  onEdit: () => void
}

export function AddressValidationCard({
  address,
  validation,
  onValidationChange,
  onEdit
}: AddressValidationCardProps) {
  const [isCorrect, setIsCorrect] = useState<boolean | null>(validation?.is_correct ?? null)
  
  const handleValidationChange = (correct: boolean) => {
    setIsCorrect(correct)
    onValidationChange({
      address_id: address.id,
      is_correct: correct,
      ...(validation || {})
    })
  }
  
  const getValidationStatus = () => {
    if (isCorrect === true) return { label: 'Correct', color: 'bg-green-100 text-green-800', icon: Check }
    if (isCorrect === false) return { label: 'Incorrect', color: 'bg-red-100 text-red-800', icon: X }
    return { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: null }
  }
  
  const status = getValidationStatus()
  const StatusIcon = status.icon
  
  return (
    <Card className={cn(
      "transition-all",
      isCorrect === true && "border-green-200 bg-green-50",
      isCorrect === false && "border-red-200 bg-red-50"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address {getSqlString(address.address_category) && `(${address.address_category})`}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={status.color}>
              {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
              {status.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="text-sm">
          <p className="font-medium">{address.address1}</p>
          {address.address2 && (
            <p className="text-muted-foreground">{address.address2}</p>
          )}
          <p className="text-muted-foreground">
            {address.city}, {address.state} {address.zip}
          </p>
        </div>
        
        {validation?.is_correct === false && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-2">Corrected Address:</p>
            <div className="text-sm text-blue-800">
              <p>{validation.corrected_address1}</p>
              {validation.corrected_address2 && <p>{validation.corrected_address2}</p>}
              <p>
                {validation.corrected_city}, {validation.corrected_state} {validation.corrected_zip}
              </p>
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`address-correct-${address.id}`}
              checked={isCorrect === true}
              onCheckedChange={() => handleValidationChange(true)}
            />
            <label
              htmlFor={`address-correct-${address.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Correct
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`address-incorrect-${address.id}`}
              checked={isCorrect === false}
              onCheckedChange={() => handleValidationChange(false)}
            />
            <label
              htmlFor={`address-incorrect-${address.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incorrect
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
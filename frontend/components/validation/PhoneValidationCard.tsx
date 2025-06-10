'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, Edit, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProviderPhone, PhoneValidation } from '@/lib/types'
import { formatPhoneNumber } from '@/lib/utils/index'

interface PhoneValidationCardProps {
  phone: ProviderPhone
  validation?: PhoneValidation
  onValidationChange: (validation: PhoneValidation) => void
  onEdit: () => void
  isNullPhone?: boolean
}

export function PhoneValidationCard({
  phone,
  validation,
  onValidationChange,
  onEdit,
  isNullPhone = false
}: PhoneValidationCardProps) {
  const [isCorrect, setIsCorrect] = useState<boolean | null>(validation?.is_correct ?? null)
  
  const handleValidationChange = (correct: boolean) => {
    setIsCorrect(correct)
    onValidationChange({
      phone_id: phone.id,
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
  
  if (isNullPhone) {
    return (
      <Card className="border-dashed bg-gray-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="text-sm">No phone number</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={cn(
      "transition-all",
      isCorrect === true && "border-green-200 bg-green-50",
      isCorrect === false && "border-red-200 bg-red-50"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone
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
          <p className="font-medium">{formatPhoneNumber(phone.phone)}</p>
        </div>
        
        {validation?.is_correct === false && validation.corrected_phone && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-900 mb-1">Corrected Phone:</p>
            <p className="text-sm text-blue-800">
              {formatPhoneNumber(validation.corrected_phone)}
            </p>
          </div>
        )}
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`phone-correct-${phone.id}`}
              checked={isCorrect === true}
              onCheckedChange={() => handleValidationChange(true)}
            />
            <label
              htmlFor={`phone-correct-${phone.id}`}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Correct
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`phone-incorrect-${phone.id}`}
              checked={isCorrect === false}
              onCheckedChange={() => handleValidationChange(false)}
            />
            <label
              htmlFor={`phone-incorrect-${phone.id}`}
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
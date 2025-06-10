'use client'

import { Phone } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { BaseValidationCard } from './BaseValidationCard'
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
  const handleValidationChange = (correct: boolean) => {
    onValidationChange({
      phone_id: phone.id,
      is_correct: correct,
      ...(validation || {})
    })
  }

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

  const phoneContent = (
    <div className="text-sm">
      <p className="font-medium">{formatPhoneNumber(phone.phone)}</p>
    </div>
  )

  const correctedContent = validation?.is_correct === false && validation.corrected_phone ? (
    <>
      <p className="text-sm font-medium text-blue-900 mb-1">Corrected Phone:</p>
      <p className="text-sm text-blue-800">
        {formatPhoneNumber(validation.corrected_phone)}
      </p>
    </>
  ) : null

  return (
    <BaseValidationCard
      title="Phone"
      icon={Phone}
      isCorrect={validation?.is_correct ?? null}
      onValidationChange={handleValidationChange}
      onEdit={onEdit}
      id={phone.id}
      correctedContent={correctedContent}
      helpText="Verify the phone number is valid, properly formatted (10 digits for US), and currently active for the provider."
    >
      {phoneContent}
    </BaseValidationCard>
  )
}
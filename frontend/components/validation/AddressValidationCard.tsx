'use client'

import { MapPin } from 'lucide-react'
import { BaseValidationCard } from './BaseValidationCard'
import type { ProviderAddress, AddressValidation } from '@/lib/types'
import { getSqlString } from '@/lib/utils/index'

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
  const handleValidationChange = (correct: boolean) => {
    onValidationChange({
      address_id: address.id,
      is_correct: correct,
      ...(validation || {})
    })
  }

  const title = `Address ${getSqlString(address.address_category) ? `(${address.address_category})` : ''}`

  const addressContent = (
    <div className="text-sm">
      <p className="font-medium">{address.address1}</p>
      {address.address2 && (
        <p className="text-muted-foreground">{address.address2}</p>
      )}
      <p className="text-muted-foreground">
        {address.city}, {address.state} {address.zip}
      </p>
    </div>
  )

  const correctedContent = validation?.is_correct === false ? (
    <>
      <p className="text-sm font-medium text-blue-900 mb-2">Corrected Address:</p>
      <div className="text-sm text-blue-800">
        <p>{validation.corrected_address1}</p>
        {validation.corrected_address2 && <p>{validation.corrected_address2}</p>}
        <p>
          {validation.corrected_city}, {validation.corrected_state} {validation.corrected_zip}
        </p>
      </div>
    </>
  ) : null

  return (
    <BaseValidationCard
      title={title}
      icon={MapPin}
      isCorrect={validation?.is_correct ?? null}
      onValidationChange={handleValidationChange}
      onEdit={onEdit}
      id={address.id}
      correctedContent={correctedContent}
      helpText="Verify the address is complete, accurate, and properly formatted. Check spelling, abbreviations, and postal codes."
    >
      {addressContent}
    </BaseValidationCard>
  )
}
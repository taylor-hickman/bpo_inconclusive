'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PhoneForm } from '@/components/forms/PhoneForm'
import type { ProviderPhone, PhoneValidation } from '@/lib/types'

interface PhoneEditDialogProps {
  isOpen: boolean
  onClose: () => void
  phone: ProviderPhone
  validation?: PhoneValidation
  onSubmit: (data: PhoneValidation) => void
}

export function PhoneEditDialog({
  isOpen,
  onClose,
  phone,
  validation,
  onSubmit
}: PhoneEditDialogProps) {
  const handleSubmit = (data: PhoneValidation) => {
    onSubmit(data)
    onClose()
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Phone Number</DialogTitle>
          <DialogDescription>
            Make corrections to the phone number below.
          </DialogDescription>
        </DialogHeader>
        
        <PhoneForm
          phone={phone}
          validation={validation}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
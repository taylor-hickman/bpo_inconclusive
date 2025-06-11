'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddressForm } from '@/components/forms/AddressForm'
import type { ProviderAddress, AddressValidation, NewAddress } from '@/lib/types'

interface AddressEditDialogProps {
  isOpen: boolean
  onClose: () => void
  address: ProviderAddress
  validation?: AddressValidation
  onSubmit: (data: Partial<AddressValidation>) => void
}

export function AddressEditDialog({
  isOpen,
  onClose,
  address,
  validation,
  onSubmit
}: AddressEditDialogProps) {
  const handleSubmit = (data: Partial<AddressValidation> | NewAddress) => {
    // For address editing, we only expect AddressValidation, not NewAddress
    onSubmit(data as Partial<AddressValidation>)
    onClose()
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Address</DialogTitle>
          <DialogDescription>
            Make corrections to the address information below.
          </DialogDescription>
        </DialogHeader>
        
        <AddressForm
          address={address}
          validation={validation}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
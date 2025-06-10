'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddressForm } from '@/components/forms/AddressForm'
import type { NewAddress } from '@/lib/types'

interface AddNewAddressDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (address: NewAddress) => void
}

export function AddNewAddressDialog({
  isOpen,
  onClose,
  onSubmit
}: AddNewAddressDialogProps) {
  const handleSubmit = (data: any) => {
    onSubmit({
      address_category: data.address_category,
      address1: data.corrected_address1,
      address2: data.corrected_address2,
      city: data.corrected_city,
      state: data.corrected_state,
      zip: data.corrected_zip
    })
    onClose()
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Address</DialogTitle>
          <DialogDescription>
            Add a new address that was discovered during validation.
          </DialogDescription>
        </DialogHeader>
        
        <AddressForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          isNew={true}
        />
      </DialogContent>
    </Dialog>
  )
}
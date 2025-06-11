'use client'

import { useState, useEffect } from 'react'
import { AuthGuard } from '@/components/layout/auth-guard'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// Validation components
import { ValidationHeader } from '@/components/validation/ValidationHeader'
import { ValidationSteps } from '@/components/validation/ValidationSteps'
import { ProviderCard } from '@/components/validation/ProviderCard'
import { AddressValidationCard } from '@/components/validation/AddressValidationCard'
import { PhoneValidationCard } from '@/components/validation/PhoneValidationCard'
import { CallAttemptsSection } from '@/components/validation/CallAttemptsSection'

// Dialog components
import { AddressEditDialog } from '@/components/dialogs/AddressEditDialog'
import { PhoneEditDialog } from '@/components/dialogs/PhoneEditDialog'
import { AddNewAddressDialog } from '@/components/dialogs/AddNewAddressDialog'

// Hooks and stores
import { useProviderData, useValidation, useAutoSave } from '@/lib/hooks'
import { useProviderStore } from '@/lib/stores'

// Utilities
import { groupRecordsByAddress } from '@/lib/utils'
import type { AddressValidation, PhoneValidation, ValidationPreview } from '@/lib/types'

// Dialog state management
interface DialogState {
  addressEdit: { isOpen: boolean; addressId?: number }
  phoneEdit: { isOpen: boolean; phoneId?: number }
  addAddress: { isOpen: boolean }
}

export default function ValidationPage() {
  const { 
    currentData: currentProvider, 
    fetchNextProvider, 
    clearValidations,
    recordCallAttempt: recordCallAttemptFromStore
  } = useProviderStore()
  
  const {
    validationState,
    setAddressValidation,
    setPhoneValidation,
    addNewAddress,
    saveProgress,
    recordCallAttempt,
    getValidationPreview,
    completeValidation,
    isLoading: validationLoading,
    error: validationError
  } = useValidation({ providerData: currentProvider })
  
  const {
    fetchStats,
    isLoading: providerLoading,
    error: providerError
  } = useProviderData()
  
  const [dialogs, setDialogs] = useState<DialogState>({
    addressEdit: { isOpen: false },
    phoneEdit: { isOpen: false },
    addAddress: { isOpen: false }
  })

  const [validationPreview, setValidationPreview] = useState<ValidationPreview | null>(null)

  // Auto-save validation state changes
  const { saveNow: autoSaveNow } = useAutoSave({
    data: validationState,
    onSave: saveProgress,
    delay: 3000, // Save after 3 seconds of inactivity
    enabled: !!currentProvider?.validation_session // Only auto-save when there's an active session
  })
  
  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, []) // Remove fetchStats from dependency array to prevent infinite loop
  
  // Group address-phone records for display
  const groupedRecords = currentProvider?.address_phone_records 
    ? groupRecordsByAddress(currentProvider.address_phone_records)
    : []
  
  // Event handlers
  const handleGrabNext = async () => {
    try {
      await fetchNextProvider()
      await fetchStats()
    } catch (error) {
      console.error('Failed to fetch next provider:', error)
    }
  }
  
  const handleSaveProgress = async () => {
    try {
      await saveProgress()
      await fetchStats()
    } catch (error) {
      console.error('Failed to save progress:', error)
    }
  }
  
  const handleComplete = async () => {
    try {
      await completeValidation()
      await fetchStats()
      clearValidations()
      // Clear validation preview after successful completion
      setValidationPreview(null)
    } catch (error) {
      console.error('Failed to complete validation:', error)
      // Don't clear validations on error - let user try again
    }
  }
  
  const handleRecordCallAttempt = async (attemptNumber: number) => {
    try {
      await recordCallAttemptFromStore(attemptNumber)
      await fetchStats()
    } catch (error) {
      console.error('Failed to record call attempt:', error)
      // If session is invalid, refresh the page state
      if (error instanceof Error && 
          (error.message.includes('Session expired') || 
           error.message.includes('no longer active'))) {
        // Clear local state and let user fetch new provider
        setValidationPreview(null)
      }
    }
  }

  const handleScrollToValidation = () => {
    // Scroll to the validation section
    const validationSection = document.querySelector('[data-section="validation"]')
    if (validationSection) {
      validationSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  
  // Dialog handlers
  const openAddressEdit = (addressId: number) => {
    setDialogs(prev => ({
      ...prev,
      addressEdit: { isOpen: true, addressId }
    }))
  }
  
  const closeAddressEdit = () => {
    setDialogs(prev => ({
      ...prev,
      addressEdit: { isOpen: false }
    }))
  }
  
  const openPhoneEdit = (phoneId: number) => {
    setDialogs(prev => ({
      ...prev,
      phoneEdit: { isOpen: true, phoneId }
    }))
  }
  
  const closePhoneEdit = () => {
    setDialogs(prev => ({
      ...prev,
      phoneEdit: { isOpen: false }
    }))
  }
  
  
  const closeAddAddress = () => {
    setDialogs(prev => ({
      ...prev,
      addAddress: { isOpen: false }
    }))
  }
  
  // Get current edit items
  const currentEditAddress = dialogs.addressEdit.addressId 
    ? groupedRecords.flat().find(r => r.address.id === dialogs.addressEdit.addressId)?.address
    : undefined
    
  const currentEditPhone = dialogs.phoneEdit.phoneId 
    ? groupedRecords.flat().find(r => r.phone.id === dialogs.phoneEdit.phoneId)?.phone
    : undefined

  // Wrapper functions for dialog callbacks
  const handleAddressEditSubmit = (data: Partial<AddressValidation>) => {
    if (!currentEditAddress || !data.address_id) return
    setAddressValidation({
      address_id: currentEditAddress.id,
      is_correct: data.is_correct ?? false,
      ...data
    } as AddressValidation)
  }

  const handlePhoneEditSubmit = (data: PhoneValidation) => {
    setPhoneValidation(data)
  }
  
  const isLoading = providerLoading || validationLoading
  const error = providerError || validationError
  
  return (
    <AuthGuard>
      <SidebarLayout>
        <ErrorBoundary>
          <div className="container mx-auto p-6 space-y-6">
            <ValidationHeader
              isLoading={isLoading}
              error={error}
              onGrabNext={handleGrabNext}
              onSaveProgress={handleSaveProgress}
              onComplete={handleComplete}
              hasProvider={!!currentProvider}
              getValidationPreview={getValidationPreview}
              onPreviewUpdate={setValidationPreview}
            />
            
            {currentProvider && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Provider information */}
                  <ProviderCard provider={currentProvider.provider} />
                  
                  {/* Validation sections */}
                  <div className="space-y-4" data-section="validation">
                    <h3 className="text-lg font-semibold">Address & Phone Validation</h3>
                    
                    {groupedRecords.map((group, groupIndex) => (
                      <div key={groupIndex} className="space-y-3">
                        {group.map((record, recordIndex) => (
                          <div key={record.id} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Show address only for first record in group */}
                            {recordIndex === 0 && (
                              <AddressValidationCard
                                address={record.address}
                                validation={validationState.addressValidations[record.address.id]}
                                onValidationChange={setAddressValidation}
                                onEdit={() => openAddressEdit(record.address.id)}
                              />
                            )}
                            
                            {/* Show phone for each record */}
                            <div className={recordIndex === 0 ? '' : 'md:col-start-2'}>
                              <PhoneValidationCard
                                phone={record.phone}
                                validation={validationState.phoneValidations[record.phone.id]}
                                onValidationChange={setPhoneValidation}
                                onEdit={() => openPhoneEdit(record.phone.id)}
                                isNullPhone={record.phone.id === 0}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Validation Steps */}
                  <ValidationSteps
                    session={currentProvider.validation_session || null}
                    preview={validationPreview}
                    onRecordCallAttempt={handleRecordCallAttempt}
                    onSaveProgress={handleSaveProgress}
                    onCompleteValidation={handleComplete}
                    onScrollToValidation={handleScrollToValidation}
                    isLoading={isLoading}
                  />

                  {/* Call attempts */}
                  <CallAttemptsSection
                    session={currentProvider.validation_session || null}
                    onRecordAttempt={handleRecordCallAttempt}
                    isLoading={validationLoading}
                  />
                  
                  {/* New addresses */}
                  {validationState.newAddresses.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">New Addresses Added</h4>
                      {validationState.newAddresses.map((address, index) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-900">
                            {address.address_category}
                          </p>
                          <p className="text-sm text-blue-800">
                            {address.address1}
                            {address.address2 && `, ${address.address2}`}
                          </p>
                          <p className="text-sm text-blue-800">
                            {address.city}, {address.state} {address.zip}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* No provider state */}
            {!currentProvider && !isLoading && !error && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No provider currently assigned. Click "Grab Next Provider" to get started.
                </p>
              </div>
            )}
          </div>
          
          {/* Dialogs */}
          {currentEditAddress && (
            <AddressEditDialog
              isOpen={dialogs.addressEdit.isOpen}
              onClose={closeAddressEdit}
              address={currentEditAddress}
              validation={validationState.addressValidations[currentEditAddress.id]}
              onSubmit={handleAddressEditSubmit}
            />
          )}
          
          {currentEditPhone && (
            <PhoneEditDialog
              isOpen={dialogs.phoneEdit.isOpen}
              onClose={closePhoneEdit}
              phone={currentEditPhone}
              validation={validationState.phoneValidations[currentEditPhone.id]}
              onSubmit={handlePhoneEditSubmit}
            />
          )}
          
          <AddNewAddressDialog
            isOpen={dialogs.addAddress.isOpen}
            onClose={closeAddAddress}
            onSubmit={addNewAddress}
          />
        </ErrorBoundary>
      </SidebarLayout>
    </AuthGuard>
  )
}
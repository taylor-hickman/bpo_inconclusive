'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useProviderStore } from '@/lib/provider-store'
import { AuthGuard } from '@/components/auth-guard'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Phone, MapPin, AlertCircle, Loader2, Clock, CheckCircle2, Plus, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'

// Helper functions to handle null values from backend (backend now sends clean JSON)
const getSqlString = (sqlValue: any): string => {
  if (sqlValue === null || sqlValue === undefined) return ''
  return String(sqlValue)
}

const getSqlBool = (sqlValue: any): boolean | null => {
  if (sqlValue === null || sqlValue === undefined) return null
  return Boolean(sqlValue)
}

const getSqlTime = (sqlValue: any): string | null => {
  if (sqlValue === null || sqlValue === undefined) return null
  return String(sqlValue)
}

const formatPhoneNumber = (phone: string | null | undefined): string => {
  // Handle null, undefined
  if (!phone) {
    return 'N/A'
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Handle different phone number lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  } else {
    // Return original if it doesn't match expected patterns
    return phone
  }
}

// Group address-phone records by unique address content
const groupRecordsByAddress = (records: any[]) => {
  const groups = new Map<string, any[]>()
  
  records.forEach(record => {
    // Create a unique key based on address content (not ID)
    const addressKey = [
      getSqlString(record.address.address_category),
      record.address.address1,
      getSqlString(record.address.address2),
      record.address.city,
      record.address.state,
      record.address.zip
    ].join('|').toLowerCase()
    
    if (!groups.has(addressKey)) {
      groups.set(addressKey, [])
    }
    
    // Check if this exact phone is already in the group to avoid duplicates
    const existingGroup = groups.get(addressKey)!
    const phoneExists = existingGroup.some(existingRecord => 
      existingRecord.phone.id === record.phone.id
    )
    
    if (!phoneExists) {
      existingGroup.push(record)
    }
  })
  
  return Array.from(groups.values())
}

// Group addresses and phones by link_id for new structure
const groupAddressesAndPhones = (addresses: any[], phones: any[]) => {
  // If no link_id, deduplicate phones by unique phone number
  const uniquePhones = phones.reduce((acc: any[], phone) => {
    const phoneNumber = phone.phone.replace(/\D/g, '') // Remove non-digits for comparison
    const exists = acc.some(p => p.phone.replace(/\D/g, '') === phoneNumber)
    if (!exists) {
      acc.push(phone)
    }
    return acc
  }, [])

  // If we have link_id, group by it
  if (addresses.some(a => a.link_id) && phones.some(p => p.link_id)) {
    return addresses.map(address => {
      const relatedPhones = uniquePhones.filter(phone => 
        phone.link_id && address.link_id && phone.link_id === address.link_id
      )
      // If no related phones found by link_id, include all unique phones (fallback)
      return {
        address,
        phones: relatedPhones.length > 0 ? relatedPhones : uniquePhones
      }
    })
  }
  
  // If no link_id, show each address with all unique phones
  return addresses.map(address => ({
    address,
    phones: uniquePhones
  }))
}

function ValidationContent() {
  const { token, user } = useAuthStore()
  const { 
    currentData, 
    stats,
    isLoading, 
    error,
    addressValidations,
    phoneValidations,
    newAddresses,
    fetchNextProvider, 
    updateValidations,
    recordCallAttempt,
    completeValidation,
    fetchStats,
    setAddressValidation,
    setPhoneValidation,
    addNewAddress,
    removeNewAddress
  } = useProviderStore()

  const [addressDialogOpen, setAddressDialogOpen] = useState<number | null>(null)
  const [phoneDialogOpen, setPhoneDialogOpen] = useState<number | null>(null)
  const [combinedEditDialogOpen, setCombinedEditDialogOpen] = useState<{addressId: number, phoneId: number} | null>(null)
  const [addAddressDialogOpen, setAddAddressDialogOpen] = useState(false)
  const [correctedAddress, setCorrectedAddress] = useState({
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: ''
  })
  const [correctedPhone, setCorrectedPhone] = useState('')
  const [newAddressForm, setNewAddressForm] = useState({
    address_category: 'Additional',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zip: ''
  })

  useEffect(() => {
    // Small delay to ensure auth is fully initialized
    const timer = setTimeout(() => {
      if (token && user) {
        console.log('Fetching provider data...', { token: !!token, user: !!user })
        fetchNextProvider().catch(err => {
          console.error('Failed to fetch provider:', err)
        })
        fetchStats().catch(err => {
          console.error('Failed to fetch stats:', err)
        })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [token, user]) // Remove function dependencies to prevent loops

  const handleAddressCheckbox = (addressId: number, isChecked: boolean | 'indeterminate') => {
    if (isChecked === true) {
      // Address is correct
      setAddressValidation(addressId, {
        address_id: addressId,
        is_correct: true
      })
    } else if (isChecked === false) {
      // Open dialog to correct address
      const record = currentData?.address_phone_records?.find(r => r.address.id === addressId)
      if (record) {
        const address = record.address
        setCorrectedAddress({
          address1: getSqlString(address.corrected_address1) || address.address1,
          address2: getSqlString(address.corrected_address2) || getSqlString(address.address2) || '',
          city: getSqlString(address.corrected_city) || address.city,
          state: getSqlString(address.corrected_state) || address.state,
          zip: getSqlString(address.corrected_zip) || address.zip
        })
        setAddressDialogOpen(addressId)
      }
    }
  }

  const handlePhoneCheckbox = (phoneId: number, isChecked: boolean | 'indeterminate') => {
    if (isChecked === true) {
      // Phone is correct
      setPhoneValidation(phoneId, {
        phone_id: phoneId,
        is_correct: true
      })
    } else if (isChecked === false) {
      // Open dialog to correct phone
      const record = currentData?.address_phone_records?.find(r => r.phone.id === phoneId)
      if (record) {
        const phone = record.phone
        setCorrectedPhone(getSqlString(phone.corrected_phone) || phone.phone)
        setPhoneDialogOpen(phoneId)
      }
    }
  }

  const saveAddressCorrection = () => {
    if (addressDialogOpen !== null) {
      setAddressValidation(addressDialogOpen, {
        address_id: addressDialogOpen,
        is_correct: false,
        corrected_address1: correctedAddress.address1,
        corrected_address2: correctedAddress.address2,
        corrected_city: correctedAddress.city,
        corrected_state: correctedAddress.state,
        corrected_zip: correctedAddress.zip
      })
      setAddressDialogOpen(null)
    }
  }

  const savePhoneCorrection = () => {
    if (phoneDialogOpen !== null) {
      setPhoneValidation(phoneDialogOpen, {
        phone_id: phoneDialogOpen,
        is_correct: false,
        corrected_phone: correctedPhone
      })
      setPhoneDialogOpen(null)
    }
  }

  const handleAddNewAddress = () => {
    if (newAddressForm.address1 && newAddressForm.city && newAddressForm.state && newAddressForm.zip) {
      addNewAddress(newAddressForm)
      setNewAddressForm({
        address_category: 'Additional',
        address1: '',
        address2: '',
        city: '',
        state: '',
        zip: ''
      })
      setAddAddressDialogOpen(false)
    }
  }

  const handleCallAttempt = async (attemptNumber: number) => {
    try {
      await recordCallAttempt(attemptNumber)
    } catch (error) {
      console.error('Failed to record call attempt:', error)
    }
  }

  const handleComplete = async () => {
    try {
      await completeValidation()
    } catch (error) {
      console.error('Failed to complete validation:', error)
    }
  }

  const canCallAttempt2 = () => {
    const attempt1Time = getSqlTime(currentData?.validation_session?.call_attempt_1)
    if (!attempt1Time) return false
    const attempt1Date = new Date(attempt1Time)
    const now = new Date()
    
    // Simple check - at least 24 hours have passed
    const hoursDiff = (now.getTime() - attempt1Date.getTime()) / (1000 * 60 * 60)
    return hoursDiff >= 24
  }

  const allValidated = () => {
    if (!currentData) return false
    
    // Check address_phone_records first (which we're actually using for rendering)
    if (currentData.address_phone_records && currentData.address_phone_records.length > 0) {
      const result = currentData.address_phone_records.every(record => {
        const addressValidated = addressValidations[record.address.id] || getSqlBool(record.address.is_correct) !== null
        
        // Skip phone validation if phone doesn't exist (id = 0)
        if (record.phone.id === 0) {
          return addressValidated
        }
        
        const phoneValidated = phoneValidations[record.phone.id] || getSqlBool(record.phone.is_correct) !== null
        return addressValidated && phoneValidated
      })
      
      // Also check if all new addresses are validated
      const newAddressesValidated = newAddresses.length === 0 || newAddresses.every((_, index) => {
        // New addresses use negative IDs starting from -1
        const tempId = -(index + 1)
        return addressValidations[tempId] !== undefined
      })
      
      console.log('allValidated check:', {
        recordCount: currentData.address_phone_records.length,
        addressValidations,
        phoneValidations,
        newAddresses,
        result,
        newAddressesValidated
      })
      
      return result && newAddressesValidated
    } else if (currentData.addresses && currentData.phones) {
      // Fallback to new structure if no address_phone_records
      const allAddressesValidated = currentData.addresses.every(address => {
        const addressValidation = addressValidations[address.id]
        const addressIsCorrect = getSqlBool(address.is_correct)
        return !!(addressValidation || addressIsCorrect !== null)
      })
      
      const allPhonesValidated = currentData.phones.every(phone => {
        const phoneValidation = phoneValidations[phone.id]
        const phoneIsCorrect = getSqlBool(phone.is_correct)
        return !!(phoneValidation || phoneIsCorrect !== null)
      })
      
      return allAddressesValidated && allPhonesValidated
    }
    
    return false
  }

  return (
    <SidebarLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Provider Validation</h1>
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Completed Today: {stats.completed_today}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Remaining: {stats.total_pending}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentData ? (
          <div className="space-y-6">
            {/* Provider Information */}
            <Card>
              <CardHeader>
                <CardTitle>Provider Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-muted-foreground">Provider Name</Label>
                    <p className="font-medium">{currentData.provider.provider_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Specialty</Label>
                    <p className="font-medium">{currentData.provider.specialty}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Group</Label>
                    <p className="font-medium">{currentData.provider.provider_group}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">NPI</Label>
                    <p className="font-medium">{currentData.provider.npi}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">GNPI</Label>
                    <p className="font-medium">{currentData.provider.gnpi || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address & Phone Pairs */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address & Phone Validation
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddAddressDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Address
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Use address_phone_records which has proper grouping from backend */}
                  {currentData.address_phone_records && currentData.address_phone_records.length > 0 ? (
                    // Use properly grouped records from backend
                    groupRecordsByAddress(currentData.address_phone_records).map((records, groupIndex) => {
                      // Use the first record for address info
                      const address = records[0].address
                      const phones = records.map(r => r.phone).filter(p => p.id > 0) // Filter out null phones
                      
                      const addressValidation = addressValidations[address.id]
                      const addressIsCorrect = getSqlBool(address.is_correct)
                      const addressValidated = !!(addressValidation || addressIsCorrect !== null)
                      
                      // Check if all phones in this group are validated
                      const allPhonesValidated = phones.every(phone => {
                        const phoneValidation = phoneValidations[phone.id]
                        const phoneIsCorrect = getSqlBool(phone.is_correct)
                        return !!(phoneValidation || phoneIsCorrect !== null)
                      })
                      
                      const allValidated = addressValidated && allPhonesValidated
                      
                      return (
                        <Card key={`address-${address.id}`} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                {getSqlString(address.address_category)} Address & Phone{phones.length > 1 ? 's' : ''}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                {allValidated && (
                                  <span className={cn(
                                    "text-xs px-2 py-1 rounded-full font-medium",
                                    "bg-green-100 text-green-700"
                                  )}>
                                    ✓ All Validated
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Set address data for editing
                                    setCorrectedAddress({
                                      address1: getSqlString(address.corrected_address1) || address.address1,
                                      address2: getSqlString(address.corrected_address2) || getSqlString(address.address2) || '',
                                      city: getSqlString(address.corrected_city) || address.city,
                                      state: getSqlString(address.corrected_state) || address.state,
                                      zip: getSqlString(address.corrected_zip) || address.zip
                                    })
                                    // Set first phone as default for editing
                                    if (phones.length > 0) {
                                      const firstPhone = phones[0]
                                      setCorrectedPhone(getSqlString(firstPhone.corrected_phone) || firstPhone.phone)
                                      setCombinedEditDialogOpen({addressId: address.id, phoneId: firstPhone.id})
                                    }
                                  }}
                                  className="h-8"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Address Section */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <Label className="font-medium">Address</Label>
                                  {addressValidated && (
                                    <span className={cn(
                                      "text-xs px-2 py-1 rounded-full font-medium",
                                      (addressValidation?.is_correct ?? addressIsCorrect) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                    )}>
                                      {(addressValidation?.is_correct ?? addressIsCorrect) ? "✓ Correct" : "⚠ Corrected"}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm space-y-1">
                                  <p className="font-medium">{address.address1 || 'N/A'}</p>
                                  {getSqlString(address.address2) && <p className="text-muted-foreground">{getSqlString(address.address2)}</p>}
                                  <p className="text-muted-foreground">{address.city || 'N/A'}, {address.state || 'N/A'} {address.zip || 'N/A'}</p>
                                </div>
                                
                                {!(addressValidation?.is_correct ?? addressIsCorrect) && getSqlString(address.corrected_address1) && (
                                  <div className="p-2 bg-muted rounded-md border-l-2 border-orange-300">
                                    <Label className="text-xs text-muted-foreground font-medium">Corrected:</Label>
                                    <div className="mt-1 text-sm space-y-1">
                                      <p className="font-medium">{getSqlString(address.corrected_address1) || 'N/A'}</p>
                                      {getSqlString(address.corrected_address2) && <p className="text-muted-foreground">{getSqlString(address.corrected_address2)}</p>}
                                      <p className="text-muted-foreground">{getSqlString(address.corrected_city) || 'N/A'}, {getSqlString(address.corrected_state) || 'N/A'} {getSqlString(address.corrected_zip) || 'N/A'}</p>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`address-${groupIndex}-${address.id}`}
                                    checked={addressValidation?.is_correct === true || (addressIsCorrect === true && !addressValidation)}
                                    onCheckedChange={(checked) => handleAddressCheckbox(address.id, checked)}
                                    disabled={addressValidated}
                                  />
                                  <Label
                                    htmlFor={`address-${groupIndex}-${address.id}`}
                                    className="text-sm font-medium"
                                  >
                                    Address Correct?
                                  </Label>
                                </div>
                              </div>

                              {/* Phones Section */}
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-muted-foreground" />
                                  <Label className="font-medium">{phones.length > 1 ? 'Phones' : 'Phone'}</Label>
                                  {allPhonesValidated && (
                                    <span className={cn(
                                      "text-xs px-2 py-1 rounded-full font-medium",
                                      "bg-green-100 text-green-700"
                                    )}>
                                      ✓ All Validated
                                    </span>
                                  )}
                                </div>
                                
                                {phones.map((phone, phoneIndex) => {
                                  const phoneValidation = phoneValidations[phone.id]
                                  const phoneIsCorrect = getSqlBool(phone.is_correct)
                                  const phoneValidated = !!(phoneValidation || phoneIsCorrect !== null)
                                  
                                  return (
                                    <div key={`${groupIndex}-phone-${phoneIndex}`} className="border-l-2 border-muted pl-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm">
                                          <p className="text-lg font-mono font-medium">{formatPhoneNumber(phone.phone)}</p>
                                          {phones.length > 1 && (
                                            <p className="text-xs text-muted-foreground">Phone {phoneIndex + 1}</p>
                                          )}
                                        </div>
                                        {phoneValidated && (
                                          <span className={cn(
                                            "text-xs px-2 py-1 rounded-full font-medium",
                                            (phoneValidation?.is_correct ?? phoneIsCorrect) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                          )}>
                                            {(phoneValidation?.is_correct ?? phoneIsCorrect) ? "✓ Correct" : "⚠ Corrected"}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {!(phoneValidation?.is_correct ?? phoneIsCorrect) && getSqlString(phone.corrected_phone) && (
                                        <div className="p-2 bg-muted rounded-md border-l-2 border-orange-300">
                                          <Label className="text-xs text-muted-foreground font-medium">Corrected:</Label>
                                          <div className="mt-1 text-sm">
                                            <p className="text-lg font-mono font-medium">{formatPhoneNumber(getSqlString(phone.corrected_phone))}</p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`phone-${groupIndex}-${phoneIndex}`}
                                          checked={phoneValidation?.is_correct === true || (phoneIsCorrect === true && !phoneValidation)}
                                          onCheckedChange={(checked) => handlePhoneCheckbox(phone.id, checked)}
                                          disabled={phoneValidated}
                                        />
                                        <Label
                                          htmlFor={`phone-${groupIndex}-${phoneIndex}`}
                                          className="text-sm font-medium"
                                        >
                                          {phones.length > 1 ? `Phone ${phoneIndex + 1} Correct?` : 'Phone Correct?'}
                                        </Label>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })
                  ) : currentData.address_phone_records?.length > 0 ? (() => {
                    const groupedRecords = groupRecordsByAddress(currentData.address_phone_records)
                    return groupedRecords.map((recordGroup, groupIndex) => {
                      // Use the first record in the group for address information
                      const primaryRecord = recordGroup[0]
                      const address = primaryRecord.address
                      
                      // Check validation status for this address group
                      const allRecordsValidated = recordGroup.every(record => {
                        const addressValidated = addressValidations[record.address.id] || getSqlBool(record.address.is_correct) !== null
                        const phoneValidated = phoneValidations[record.phone.id] || getSqlBool(record.phone.is_correct) !== null
                        return addressValidated && phoneValidated
                      })
                    
                      return (
                        <Card key={`group-${groupIndex}`} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">
                                {getSqlString(address.address_category)} Address & {recordGroup.length > 1 ? 'Phones' : 'Phone'}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                {allRecordsValidated && (
                                  <span className={cn(
                                    "text-xs px-2 py-1 rounded-full font-medium",
                                    "bg-green-100 text-green-700"
                                  )}>
                                    ✓ All Validated
                                  </span>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Set address data for editing from primary record
                                    setCorrectedAddress({
                                      address1: getSqlString(address.corrected_address1) || address.address1,
                                      address2: getSqlString(address.corrected_address2) || getSqlString(address.address2) || '',
                                      city: getSqlString(address.corrected_city) || address.city,
                                      state: getSqlString(address.corrected_state) || address.state,
                                      zip: getSqlString(address.corrected_zip) || address.zip
                                    })
                                    // Set first phone as default for editing
                                    const firstRecord = recordGroup[0]
                                    setCorrectedPhone(getSqlString(firstRecord.phone.corrected_phone) || firstRecord.phone.phone)
                                    setCombinedEditDialogOpen({addressId: firstRecord.address.id, phoneId: firstRecord.phone.id})
                                  }}
                                  className="h-8"
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Address Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <Label className="font-medium">Address</Label>
                                {(() => {
                                  const addressValidation = addressValidations[address.id]
                                  const addressIsCorrect = getSqlBool(address.is_correct)
                                  const addressValidated = !!(addressValidation || addressIsCorrect !== null)
                                  
                                  return addressValidated && (
                                    <span className={cn(
                                      "text-xs px-2 py-1 rounded-full font-medium",
                                      (addressValidation?.is_correct ?? addressIsCorrect) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                    )}>
                                      {(addressValidation?.is_correct ?? addressIsCorrect) ? "✓ Correct" : "⚠ Corrected"}
                                    </span>
                                  )
                                })()}
                              </div>
                              <div className="text-sm space-y-1">
                                <p className="font-medium">{address.address1 || 'N/A'}</p>
                                {getSqlString(address.address2) && <p className="text-muted-foreground">{getSqlString(address.address2)}</p>}
                                <p className="text-muted-foreground">{address.city || 'N/A'}, {address.state || 'N/A'} {address.zip || 'N/A'}</p>
                              </div>
                              
                              {(() => {
                                const addressValidation = addressValidations[address.id]
                                const addressIsCorrect = getSqlBool(address.is_correct)
                                
                                return !(addressValidation?.is_correct ?? addressIsCorrect) && getSqlString(address.corrected_address1) && (
                                  <div className="p-2 bg-muted rounded-md border-l-2 border-orange-300">
                                    <Label className="text-xs text-muted-foreground font-medium">Corrected:</Label>
                                    <div className="mt-1 text-sm space-y-1">
                                      <p className="font-medium">{getSqlString(address.corrected_address1) || 'N/A'}</p>
                                      {getSqlString(address.corrected_address2) && <p className="text-muted-foreground">{getSqlString(address.corrected_address2)}</p>}
                                      <p className="text-muted-foreground">{getSqlString(address.corrected_city) || 'N/A'}, {getSqlString(address.corrected_state) || 'N/A'} {getSqlString(address.corrected_zip) || 'N/A'}</p>
                                    </div>
                                  </div>
                                )
                              })()}
                              
                              <div className="flex items-center space-x-2">
                                {(() => {
                                  const addressValidation = addressValidations[address.id]
                                  const addressIsCorrect = getSqlBool(address.is_correct)
                                  const addressValidated = !!(addressValidation || addressIsCorrect !== null)
                                  
                                  return (
                                    <>
                                      <Checkbox
                                        id={`address-${groupIndex}-${address.id}`}
                                        checked={addressValidation?.is_correct === true || (addressIsCorrect === true && !addressValidation)}
                                        onCheckedChange={(checked) => handleAddressCheckbox(address.id, checked)}
                                        disabled={addressValidated}
                                      />
                                      <Label
                                        htmlFor={`address-${groupIndex}-${address.id}`}
                                        className="text-sm font-medium"
                                      >
                                        Address Correct?
                                      </Label>
                                    </>
                                  )
                                })()}
                              </div>
                            </div>

                            {/* Phones Section */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <Label className="font-medium">{recordGroup.length > 1 ? 'Phones' : 'Phone'}</Label>
                                {(() => {
                                  const allPhonesValidated = recordGroup.every(record => {
                                    const phoneValidation = phoneValidations[record.phone.id]
                                    const phoneIsCorrect = getSqlBool(record.phone.is_correct)
                                    return !!(phoneValidation || phoneIsCorrect !== null)
                                  })
                                  
                                  return allPhonesValidated && (
                                    <span className={cn(
                                      "text-xs px-2 py-1 rounded-full font-medium",
                                      "bg-green-100 text-green-700"
                                    )}>
                                      ✓ All Validated
                                    </span>
                                  )
                                })()}
                              </div>
                              
                              {recordGroup.map((record, phoneIndex) => {
                                const phoneValidation = phoneValidations[record.phone.id]
                                const phoneIsCorrect = getSqlBool(record.phone.is_correct)
                                const phoneValidated = !!(phoneValidation || phoneIsCorrect !== null)
                                
                                return (
                                  <div key={`${groupIndex}-phone-${phoneIndex}`} className="border-l-2 border-muted pl-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm">
                                        <p className="text-lg font-mono font-medium">{formatPhoneNumber(record.phone.phone || 'N/A')}</p>
                                        {recordGroup.length > 1 && (
                                          <p className="text-xs text-muted-foreground">Phone {phoneIndex + 1}</p>
                                        )}
                                      </div>
                                      {phoneValidated && (
                                        <span className={cn(
                                          "text-xs px-2 py-1 rounded-full font-medium",
                                          (phoneValidation?.is_correct ?? phoneIsCorrect) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                                        )}>
                                          {(phoneValidation?.is_correct ?? phoneIsCorrect) ? "✓ Correct" : "⚠ Corrected"}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {!(phoneValidation?.is_correct ?? phoneIsCorrect) && getSqlString(record.phone.corrected_phone) && (
                                      <div className="p-2 bg-muted rounded-md border-l-2 border-orange-300">
                                        <Label className="text-xs text-muted-foreground font-medium">Corrected:</Label>
                                        <div className="mt-1 text-sm">
                                          <p className="text-lg font-mono font-medium">{formatPhoneNumber(getSqlString(record.phone.corrected_phone) || 'N/A')}</p>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`phone-${groupIndex}-${phoneIndex}`}
                                        checked={phoneValidation?.is_correct === true || (phoneIsCorrect === true && !phoneValidation)}
                                        onCheckedChange={(checked) => handlePhoneCheckbox(record.phone.id, checked)}
                                        disabled={phoneValidated}
                                      />
                                      <Label
                                        htmlFor={`phone-${groupIndex}-${phoneIndex}`}
                                        className="text-sm font-medium"
                                      >
                                        {recordGroup.length > 1 ? `Phone ${phoneIndex + 1} Correct?` : 'Phone Correct?'}
                                      </Label>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                    })
                  })() : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No address data available for validation.</p>
                    </div>
                  )}

                  {/* New Addresses */}
                  {newAddresses.map((addr, idx) => (
                    <div key={`new-${idx}`} className="border border-primary rounded-lg p-4 bg-primary/5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Label className="text-sm font-medium">New {addr.address_category} Address</Label>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              To Be Added
                            </span>
                          </div>
                          <p className="text-sm">{addr.address1}</p>
                          {addr.address2 && <p className="text-sm">{addr.address2}</p>}
                          <p className="text-sm">{addr.city}, {addr.state} {addr.zip}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeNewAddress(idx)}
                          className="text-destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>


            {/* Call Attempts */}
            <Card>
              <CardHeader>
                <CardTitle>Call Attempts</CardTitle>
                <CardDescription>Record your call attempts to the provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button
                    onClick={() => handleCallAttempt(1)}
                    disabled={!!getSqlTime(currentData.validation_session?.call_attempt_1)}
                    variant={getSqlTime(currentData.validation_session?.call_attempt_1) ? "secondary" : "default"}
                  >
                    {getSqlTime(currentData.validation_session?.call_attempt_1) ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Call Attempt 1: {new Date(getSqlTime(currentData.validation_session?.call_attempt_1)!).toLocaleString()}
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4 mr-2" />
                        Record Call Attempt 1
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={() => handleCallAttempt(2)}
                    disabled={!canCallAttempt2() || !!getSqlTime(currentData.validation_session?.call_attempt_2)}
                    variant={getSqlTime(currentData.validation_session?.call_attempt_2) ? "secondary" : "default"}
                  >
                    {getSqlTime(currentData.validation_session?.call_attempt_2) ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Call Attempt 2: {new Date(getSqlTime(currentData.validation_session?.call_attempt_2)!).toLocaleString()}
                      </>
                    ) : (
                      <>
                        <Phone className="h-4 w-4 mr-2" />
                        Record Call Attempt 2
                      </>
                    )}
                  </Button>
                </div>
                {!canCallAttempt2() && currentData.validation_session?.call_attempt_1 && !currentData.validation_session?.call_attempt_2 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Call Attempt 2 will be available after 1 business day
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => updateValidations()}
                disabled={isLoading}
              >
                Save Progress
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!allValidated() || isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Validation
              </Button>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              {isLoading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading provider...</p>
                </>
              ) : error ? (
                <>
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-4">{error}</p>
                  <Button onClick={fetchNextProvider}>
                    Try Again
                  </Button>
                </>
              ) : (
                <>
                  <Phone className="h-8 w-8 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-4">Ready to validate providers</p>
                  <Button size="lg" onClick={() => {
                    console.log('Manual fetch triggered')
                    fetchNextProvider()
                  }}>
                    Start Validation
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Click to load the first provider
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Address Correction Dialog */}
      <Dialog open={addressDialogOpen !== null} onOpenChange={() => setAddressDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Address</DialogTitle>
            <DialogDescription>
              Enter the correct address information as provided by the provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="address1">Address Line 1</Label>
              <Input
                id="address1"
                value={correctedAddress.address1}
                onChange={(e) => setCorrectedAddress({ ...correctedAddress, address1: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="address2">Address Line 2</Label>
              <Input
                id="address2"
                value={correctedAddress.address2}
                onChange={(e) => setCorrectedAddress({ ...correctedAddress, address2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={correctedAddress.city}
                  onChange={(e) => setCorrectedAddress({ ...correctedAddress, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={correctedAddress.state}
                  onChange={(e) => setCorrectedAddress({ ...correctedAddress, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={correctedAddress.zip}
                  onChange={(e) => setCorrectedAddress({ ...correctedAddress, zip: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(null)}>
              Cancel
            </Button>
            <Button onClick={saveAddressCorrection}>
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Correction Dialog */}
      <Dialog open={phoneDialogOpen !== null} onOpenChange={() => setPhoneDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Phone Number</DialogTitle>
            <DialogDescription>
              Enter the correct phone number as provided by the provider
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={correctedPhone}
              onChange={(e) => setCorrectedPhone(e.target.value)}
              placeholder="xxx-xxx-xxxx"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhoneDialogOpen(null)}>
              Cancel
            </Button>
            <Button onClick={savePhoneCorrection}>
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Combined Address & Phone Edit Dialog */}
      <Dialog open={!!combinedEditDialogOpen} onOpenChange={() => setCombinedEditDialogOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Address & Phone</DialogTitle>
            <DialogDescription>
              Correct the address and phone information for this provider
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Address Section */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address Information
              </h4>
              <div>
                <Label htmlFor="edit-address1">Address Line 1</Label>
                <Input
                  id="edit-address1"
                  value={correctedAddress.address1}
                  onChange={(e) => setCorrectedAddress({...correctedAddress, address1: e.target.value})}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="edit-address2">Address Line 2 (Optional)</Label>
                <Input
                  id="edit-address2"
                  value={correctedAddress.address2}
                  onChange={(e) => setCorrectedAddress({...correctedAddress, address2: e.target.value})}
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={correctedAddress.city}
                    onChange={(e) => setCorrectedAddress({...correctedAddress, city: e.target.value})}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={correctedAddress.state}
                    onChange={(e) => setCorrectedAddress({...correctedAddress, state: e.target.value})}
                    placeholder="State"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-zip">ZIP Code</Label>
                <Input
                  id="edit-zip"
                  value={correctedAddress.zip}
                  onChange={(e) => setCorrectedAddress({...correctedAddress, zip: e.target.value})}
                  placeholder="ZIP code"
                />
              </div>
            </div>

            {/* Phone Section */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Information
              </h4>
              <div>
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={correctedPhone}
                  onChange={(e) => setCorrectedPhone(e.target.value)}
                  placeholder="xxx-xxx-xxxx"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCombinedEditDialogOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (combinedEditDialogOpen) {
                // Save both address and phone corrections
                setAddressValidation(combinedEditDialogOpen.addressId, {
                  address_id: combinedEditDialogOpen.addressId,
                  is_correct: false,
                  corrected_address1: correctedAddress.address1,
                  corrected_address2: correctedAddress.address2,
                  corrected_city: correctedAddress.city,
                  corrected_state: correctedAddress.state,
                  corrected_zip: correctedAddress.zip
                })
                setPhoneValidation(combinedEditDialogOpen.phoneId, {
                  phone_id: combinedEditDialogOpen.phoneId,
                  is_correct: false,
                  corrected_phone: correctedPhone
                })
                setCombinedEditDialogOpen(null)
              }
            }}>
              Save Corrections
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Address Dialog */}
      <Dialog open={addAddressDialogOpen} onOpenChange={setAddAddressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
            <DialogDescription>
              Add an additional address for this provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Address Category</Label>
              <Input
                id="category"
                value={newAddressForm.address_category}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, address_category: e.target.value })}
                placeholder="e.g., Secondary, Billing, etc."
              />
            </div>
            <div>
              <Label htmlFor="new-address1">Address Line 1</Label>
              <Input
                id="new-address1"
                value={newAddressForm.address1}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, address1: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="new-address2">Address Line 2</Label>
              <Input
                id="new-address2"
                value={newAddressForm.address2}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, address2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="new-city">City</Label>
                <Input
                  id="new-city"
                  value={newAddressForm.city}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="new-state">State</Label>
                <Input
                  id="new-state"
                  value={newAddressForm.state}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="new-zip">ZIP</Label>
                <Input
                  id="new-zip"
                  value={newAddressForm.zip}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, zip: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAddressDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNewAddress}>
              Add Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  )
}

export default function ValidationPage() {
  return (
    <AuthGuard>
      <ValidationContent />
    </AuthGuard>
  )
}
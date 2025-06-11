'use client'

import { Check, Phone, MapPin, Save, CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ValidationSession, ValidationPreview } from '@/lib/types'

interface ValidationStepsProps {
  session: ValidationSession | null
  preview: ValidationPreview | null
  className?: string
}

interface StepInfo {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  status: 'pending' | 'in_progress' | 'completed'
  required: boolean
}

export function ValidationSteps({ session, preview, className }: ValidationStepsProps) {
  const getSteps = (): StepInfo[] => {
    const hasCallAttempt = session?.call_attempt_1
    const hasUnvalidatedItems = preview && (preview.unvalidated_addresses.length > 0 || preview.unvalidated_phones.length > 0)
    const canComplete = preview?.can_complete ?? false

    return [
      {
        id: 'call_attempt',
        title: 'Record Call Attempt',
        description: 'Log the first call attempt to the provider',
        icon: Phone,
        status: hasCallAttempt ? 'completed' : 'pending',
        required: true
      },
      {
        id: 'validate_data',
        title: 'Validate Information',
        description: 'Verify and correct addresses and phone numbers',
        icon: MapPin,
        status: hasUnvalidatedItems === false ? 'completed' : hasCallAttempt ? 'in_progress' : 'pending',
        required: true
      },
      {
        id: 'save_progress',
        title: 'Save Progress',
        description: 'Save validation changes to the system',
        icon: Save,
        status: 'pending', // This step is always available once validation starts
        required: false
      },
      {
        id: 'complete',
        title: 'Complete Validation',
        description: 'Finalize and submit the validation',
        icon: CheckCircle,
        status: canComplete ? 'completed' : 'pending',
        required: true
      }
    ]
  }

  const steps = getSteps()
  const currentStepIndex = steps.findIndex(step => step.status === 'in_progress')
  const nextStepIndex = currentStepIndex >= 0 ? currentStepIndex : steps.findIndex(step => step.status === 'pending')

  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Validation Steps</h3>
          
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isActive = index === nextStepIndex
              const isCompleted = step.status === 'completed'
              const isPending = step.status === 'pending'
              const isInProgress = step.status === 'in_progress'

              return (
                <div key={step.id} className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    isCompleted && "bg-green-100 border-green-500 text-green-700",
                    isInProgress && "bg-blue-100 border-blue-500 text-blue-700",
                    isPending && "bg-gray-100 border-gray-300 text-gray-500",
                    isActive && !isCompleted && !isInProgress && "border-blue-500 text-blue-600"
                  )}>
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isInProgress ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={cn(
                        "text-sm font-medium",
                        isCompleted && "text-green-700",
                        isInProgress && "text-blue-700",
                        isPending && "text-gray-600",
                        isActive && !isCompleted && !isInProgress && "text-blue-600"
                      )}>
                        {step.title}
                      </h4>
                      
                      {step.required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}

                      {isActive && !isCompleted && (
                        <Badge className="text-xs bg-blue-100 text-blue-800">
                          Current
                        </Badge>
                      )}
                    </div>
                    
                    <p className={cn(
                      "text-xs",
                      isCompleted && "text-green-600",
                      isInProgress && "text-blue-600", 
                      isPending && "text-gray-500"
                    )}>
                      {step.description}
                    </p>

                    {/* Progress indicator for validation step */}
                    {step.id === 'validate_data' && preview && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{preview.total_validated}/{preview.total_required} items</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${preview.total_required > 0 ? (preview.total_validated / preview.total_required) * 100 : 0}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next step hint */}
          {nextStepIndex >= 0 && nextStepIndex < steps.length && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Next:</strong> {steps[nextStepIndex].description}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
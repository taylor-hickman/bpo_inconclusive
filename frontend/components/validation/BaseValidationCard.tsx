'use client'

import { ReactNode, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { Edit, Check, X, LucideIcon, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ValidationStatus {
  label: string
  color: string
  icon: LucideIcon | null
}

export interface BaseValidationCardProps {
  title: string
  icon: LucideIcon
  isCorrect: boolean | null
  onValidationChange: (correct: boolean) => void
  onEdit?: () => void
  children: ReactNode
  correctedContent?: ReactNode
  className?: string
  id: string | number
  showEditButton?: boolean
  disabled?: boolean
  helpText?: string
}

export function BaseValidationCard({
  title,
  icon: Icon,
  isCorrect,
  onValidationChange,
  onEdit,
  children,
  correctedContent,
  className,
  id,
  showEditButton = true,
  disabled = false,
  helpText,
  ...props
}: BaseValidationCardProps & Record<string, any>) {
  const [localIsCorrect, setLocalIsCorrect] = useState<boolean | null>(isCorrect)

  useEffect(() => {
    setLocalIsCorrect(isCorrect)
  }, [isCorrect])

  const handleValidationChange = (correct: boolean) => {
    if (disabled) return
    setLocalIsCorrect(correct)
    onValidationChange(correct)
  }

  const getValidationStatus = (): ValidationStatus => {
    if (localIsCorrect === true) return { label: 'Correct', color: 'bg-green-100 text-green-800', icon: Check }
    if (localIsCorrect === false) return { label: 'Incorrect', color: 'bg-red-100 text-red-800', icon: X }
    return { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: null }
  }

  const status = getValidationStatus()
  const StatusIcon = status.icon
  const isFocused = props['data-focused']

  return (
    <Card 
      className={cn(
        "transition-all",
        localIsCorrect === true && "border-green-200 bg-green-50",
        localIsCorrect === false && "border-red-200 bg-red-50",
        disabled && "opacity-60",
        isFocused && "shadow-lg",
        className
      )}
      role="article"
      aria-label={`${title} validation card`}
      aria-current={props['aria-current']}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{title}</span>
            {helpText && (
              <Tooltip content={helpText}>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={status.color}
              aria-label={`Validation status: ${status.label}`}
            >
              {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" aria-hidden="true" />}
              {status.label}
            </Badge>
            {showEditButton && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 w-8 p-0"
                disabled={disabled}
                aria-label={`Edit ${title}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {children}
        
        {localIsCorrect === false && correctedContent && (
          <div 
            className="p-3 bg-blue-50 rounded-lg border border-blue-200"
            role="region"
            aria-label="Corrected information"
          >
            {correctedContent}
          </div>
        )}
        
        <fieldset 
          className="flex items-center space-x-6" 
          role="radiogroup" 
          aria-labelledby={`validation-legend-${id}`}
          aria-describedby={`validation-status-${id}`}
        >
          <legend id={`validation-legend-${id}`} className="sr-only">
            Validation options for {title}
          </legend>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`correct-${id}`}
              checked={localIsCorrect === true}
              onCheckedChange={() => handleValidationChange(true)}
              disabled={disabled}
              aria-label={`Mark ${title} as correct`}
              aria-describedby={`correct-help-${id}`}
            />
            <label
              htmlFor={`correct-${id}`}
              className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                disabled && "cursor-not-allowed opacity-70"
              )}
            >
              Correct
            </label>
            <span id={`correct-help-${id}`} className="sr-only">
              Press C or right arrow to mark as correct
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`incorrect-${id}`}
              checked={localIsCorrect === false}
              onCheckedChange={() => handleValidationChange(false)}
              disabled={disabled}
              aria-label={`Mark ${title} as incorrect`}
              aria-describedby={`incorrect-help-${id}`}
            />
            <label
              htmlFor={`incorrect-${id}`}
              className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                disabled && "cursor-not-allowed opacity-70"
              )}
            >
              Incorrect
            </label>
            <span id={`incorrect-help-${id}`} className="sr-only">
              Press X or left arrow to mark as incorrect
            </span>
          </div>
          
          <div id={`validation-status-${id}`} className="sr-only" aria-live="polite">
            Current validation status: {status.label}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}

export function getValidationStatus(isCorrect: boolean | null): ValidationStatus {
  if (isCorrect === true) return { label: 'Correct', color: 'bg-green-100 text-green-800', icon: Check }
  if (isCorrect === false) return { label: 'Incorrect', color: 'bg-red-100 text-red-800', icon: X }
  return { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: null }
}
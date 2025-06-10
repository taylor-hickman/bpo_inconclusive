'use client'

import { useRef, useEffect, useState, ReactElement, Children, cloneElement } from 'react'
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation'
import { cn } from '@/lib/utils'

interface ValidationCardContainerProps {
  children: ReactElement[]
  className?: string
}

export function ValidationCardContainer({ children, className }: ValidationCardContainerProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter out null/undefined children
  const validChildren = Children.toArray(children).filter(Boolean) as ReactElement[]
  const totalCards = validChildren.length

  const handleNext = () => {
    setFocusedIndex(prev => (prev + 1) % totalCards)
  }

  const handlePrevious = () => {
    setFocusedIndex(prev => (prev - 1 + totalCards) % totalCards)
  }

  const handleMarkCorrect = () => {
    const currentChild = validChildren[focusedIndex]
    if (currentChild?.props?.onValidationChange) {
      // For address validation cards, we need to pass the proper validation object
      if (currentChild.props.address) {
        currentChild.props.onValidationChange({
          address_id: currentChild.props.address.id,
          is_correct: true,
          ...(currentChild.props.validation || {})
        })
      }
      // For phone validation cards
      else if (currentChild.props.phone) {
        currentChild.props.onValidationChange({
          phone_id: currentChild.props.phone.id,
          is_correct: true,
          ...(currentChild.props.validation || {})
        })
      }
    }
  }

  const handleMarkIncorrect = () => {
    const currentChild = validChildren[focusedIndex]
    if (currentChild?.props?.onValidationChange) {
      // For address validation cards
      if (currentChild.props.address) {
        currentChild.props.onValidationChange({
          address_id: currentChild.props.address.id,
          is_correct: false,
          ...(currentChild.props.validation || {})
        })
      }
      // For phone validation cards
      else if (currentChild.props.phone) {
        currentChild.props.onValidationChange({
          phone_id: currentChild.props.phone.id,
          is_correct: false,
          ...(currentChild.props.validation || {})
        })
      }
    }
  }

  const handleEdit = () => {
    const currentChild = validChildren[focusedIndex]
    if (currentChild?.props?.onEdit) {
      currentChild.props.onEdit()
    }
  }

  useKeyboardNavigation({
    onNext: handleNext,
    onPrevious: handlePrevious,
    onMarkCorrect: handleMarkCorrect,
    onMarkIncorrect: handleMarkIncorrect,
    onEdit: handleEdit,
    isActive: true
  })

  // Focus management
  useEffect(() => {
    const currentCard = cardRefs.current[focusedIndex]
    if (currentCard) {
      currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Find the first focusable element within the card
      const focusableElement = currentCard.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusableElement?.focus()
    }
  }, [focusedIndex])

  // Set up refs for each card
  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, totalCards)
  }, [totalCards])

  return (
    <div 
      ref={containerRef}
      className={cn("space-y-4", className)}
      role="region"
      aria-label="Validation cards"
    >
      <div className="sr-only" aria-live="polite">
        Navigating item {focusedIndex + 1} of {totalCards}. Use arrow keys to navigate.
      </div>
      
      {validChildren.map((child, index) => (
        <div
          key={index}
          ref={el => cardRefs.current[index] = el}
          className={cn(
            "transition-all duration-200",
            focusedIndex === index && "ring-2 ring-blue-500 ring-offset-2 rounded-lg"
          )}
          tabIndex={-1}
        >
          {cloneElement(child, {
            ...child.props,
            'aria-current': focusedIndex === index ? 'true' : 'false',
            'data-focused': focusedIndex === index
          })}
        </div>
      ))}
      
      {/* Keyboard shortcuts hint */}
      <div className="text-xs text-muted-foreground text-center mt-4">
        Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">?</kbd> for keyboard shortcuts
      </div>
    </div>
  )
}
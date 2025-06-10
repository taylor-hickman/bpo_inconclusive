import { useEffect, useRef, useCallback } from 'react'

interface UseKeyboardNavigationProps {
  onNext?: () => void
  onPrevious?: () => void
  onMarkCorrect?: () => void
  onMarkIncorrect?: () => void
  onEdit?: () => void
  isActive?: boolean
}

export function useKeyboardNavigation({
  onNext,
  onPrevious,
  onMarkCorrect,
  onMarkIncorrect,
  onEdit,
  isActive = true
}: UseKeyboardNavigationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isActive) return

    // Check if the user is typing in an input field
    const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                          document.activeElement?.tagName === 'TEXTAREA'
    
    if (isInputFocused) return

    switch (event.key) {
      case 'Tab':
        // Let default tab behavior work but we could enhance it
        break
      
      case 'ArrowDown':
      case 'j': // Vim-style navigation
        event.preventDefault()
        onNext?.()
        break
      
      case 'ArrowUp':
      case 'k': // Vim-style navigation
        event.preventDefault()
        onPrevious?.()
        break
      
      case 'ArrowRight':
      case 'c': // Mark as correct
        event.preventDefault()
        onMarkCorrect?.()
        break
      
      case 'ArrowLeft':
      case 'x': // Mark as incorrect
        event.preventDefault()
        onMarkIncorrect?.()
        break
      
      case 'e': // Edit
      case 'Enter':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault()
          onEdit?.()
        }
        break
      
      case '?': // Show help
        if (event.shiftKey) {
          event.preventDefault()
          showKeyboardShortcuts()
        }
        break
    }
  }, [isActive, onNext, onPrevious, onMarkCorrect, onMarkIncorrect, onEdit])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const focus = useCallback(() => {
    containerRef.current?.focus()
  }, [])

  return { containerRef, focus }
}

function showKeyboardShortcuts() {
  // Create a temporary dialog to show keyboard shortcuts
  const message = `
Keyboard Shortcuts:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Navigation:
  ↑/k     - Previous item
  ↓/j     - Next item
  Tab     - Next focusable element

Validation:
  →/c     - Mark as Correct
  ←/x     - Mark as Incorrect
  
Actions:
  e       - Edit current item
  Ctrl+Enter - Edit current item
  
Help:
  ?       - Show this help
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `
  alert(message)
}
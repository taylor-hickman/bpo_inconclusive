import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export all utilities from the utils directory
export * from './utils/formatters'
export * from './utils/validators'
export * from './utils/transformers'
export * from './utils/constants'
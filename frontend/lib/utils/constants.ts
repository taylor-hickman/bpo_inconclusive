// Validation constants
export const VALIDATION_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
} as const

export const ADDRESS_CATEGORIES = {
  MAILING: 'mailing',
  PRACTICE: 'practice',
  BILLING: 'billing'
} as const

export const PHONE_TYPES = {
  MAIN: 'main',
  FAX: 'fax',
  MOBILE: 'mobile'
} as const

// Business rules
export const MAX_CALL_ATTEMPTS = 2
export const CALL_ATTEMPT_COOLDOWN_HOURS = 24
export const SESSION_TIMEOUT_MINUTES = 30

// API configuration
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    REFRESH: '/auth/refresh'
  },
  PROVIDERS: {
    NEXT: '/providers/next',
    STATS: '/providers/stats'
  },
  SESSIONS: {
    VALIDATE: (id: number) => `/sessions/${id}/validate`,
    CALL_ATTEMPT: (id: number) => `/sessions/${id}/call-attempt`,
    COMPLETE: (id: number) => `/sessions/${id}/complete`
  }
} as const

// UI constants
export const DIALOG_SIZES = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl'
} as const

export const TOAST_DURATION = 5000
export const DEBOUNCE_DELAY = 300
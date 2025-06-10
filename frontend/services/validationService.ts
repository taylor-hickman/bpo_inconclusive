import { apiClient } from './apiClient'
import type { ValidationUpdate, CallAttemptRequest } from '@/lib/types'

export class ValidationService {
  async updateValidation(sessionId: number, validation: ValidationUpdate): Promise<void> {
    return apiClient.put<void>(`/sessions/${sessionId}/validate`, validation)
  }
  
  async recordCallAttempt(sessionId: number, attempt: CallAttemptRequest): Promise<void> {
    return apiClient.post<void>(`/sessions/${sessionId}/call-attempt`, attempt)
  }
  
  async completeValidation(sessionId: number): Promise<void> {
    return apiClient.post<void>(`/sessions/${sessionId}/complete`)
  }
}

export const validationService = new ValidationService()
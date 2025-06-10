import { apiClient } from './apiClient'
import type { 
  ProviderValidationData, 
  ProviderStats,
  ValidationUpdate,
  CallAttemptRequest
} from '@/lib/types'

export class ProviderService {
  async getNextProvider(): Promise<ProviderValidationData> {
    return apiClient.get<ProviderValidationData>('/providers/next')
  }
  
  async getStats(): Promise<ProviderStats> {
    return apiClient.get<ProviderStats>('/providers/stats')
  }
}

export const providerService = new ProviderService()
import { apiClient } from './apiClient'
import type { User, AuthResponse, LoginRequest, RegisterRequest } from '@/lib/types'

export class AuthService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/login', credentials)
  }
  
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/register', userData)
  }
  
  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me')
  }
  
  async refreshToken(): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/auth/refresh')
  }
}

export const authService = new AuthService()
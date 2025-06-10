export interface User {
  id: number
  email: string
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}
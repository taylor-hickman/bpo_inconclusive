import { create } from 'zustand'
import Cookies from 'js-cookie'
import { authService } from '@/services'
import type { User, AuthState, LoginRequest, RegisterRequest } from '@/lib/types'

interface AuthStoreState extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  token: Cookies.get('token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await authService.login({ email, password })
      
      const { token, user } = response
      
      if (!token || !user) {
        throw new Error('Invalid response: missing token or user data')
      }
      
      // Store token in cookie
      Cookies.set('token', token, { expires: 1 })
      
      set({ user, token, isLoading: false })
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed'
      set({ 
        error: errorMessage, 
        isLoading: false 
      })
      throw error
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await authService.register({ email, password })
      const { token, user } = response
      
      // Store token in cookie
      Cookies.set('token', token, { expires: 1 })
      
      set({ user, token, isLoading: false })
    } catch (error: any) {
      set({ 
        error: error.message || 'Registration failed', 
        isLoading: false 
      })
      throw error
    }
  },

  logout: () => {
    Cookies.remove('token')
    set({ user: null, token: null, error: null })
  },

  checkAuth: async () => {
    const token = Cookies.get('token')
    
    if (!token) {
      set({ user: null, token: null })
      return
    }

    try {
      const user = await authService.getCurrentUser()
      set({ user, token })
    } catch (error) {
      // Token is invalid, clear it
      Cookies.remove('token')
      set({ user: null, token: null })
      // Don't throw the error - just clear the auth state
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))
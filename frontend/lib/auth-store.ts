import { create } from 'zustand'
import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

interface User {
  id: number
  email: string
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: Cookies.get('token') || null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      })
      
      const { token, user } = response.data
      
      Cookies.set('token', token, { expires: 1 })
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      set({ user, token, isLoading: false })
    } catch (error: any) {
      set({ 
        error: error.response?.data || 'Login failed', 
        isLoading: false 
      })
      throw error
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email,
        password,
      })
      
      const { token, user } = response.data
      
      Cookies.set('token', token, { expires: 1 })
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      set({ user, token, isLoading: false })
    } catch (error: any) {
      set({ 
        error: error.response?.data || 'Registration failed', 
        isLoading: false 
      })
      throw error
    }
  },

  logout: () => {
    Cookies.remove('token')
    delete axios.defaults.headers.common['Authorization']
    set({ user: null, token: null })
  },

  checkAuth: async () => {
    const token = Cookies.get('token')
    console.log('Checking auth, token exists:', !!token)
    
    if (!token) {
      set({ user: null, token: null })
      return
    }

    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      const response = await axios.get(`${API_URL}/auth/me`)
      console.log('Auth check successful, user:', response.data)
      set({ user: response.data, token })
    } catch (error) {
      console.error('Auth check failed:', error)
      Cookies.remove('token')
      delete axios.defaults.headers.common['Authorization']
      set({ user: null, token: null })
      throw error
    }
  },
}))
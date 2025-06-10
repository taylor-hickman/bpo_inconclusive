import axios, { AxiosInstance, AxiosError } from 'axios'
import Cookies from 'js-cookie'
import type { ApiConfig, ApiError } from '@/lib/types'

class ApiClient {
  private client: AxiosInstance
  
  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    })
    
    this.setupInterceptors()
  }
  
  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = Cookies.get('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
    
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorMessage = this.extractErrorMessage(error)
        const apiError = new Error(errorMessage)
        // Add additional properties to the error
        ;(apiError as any).status = error.response?.status
        ;(apiError as any).code = error.code
        ;(apiError as any).originalError = error
        return Promise.reject(apiError)
      }
    )
  }
  
  private extractErrorMessage(error: AxiosError): string {
    // Log the full error for debugging
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      url: error.config?.url
    })
    
    // Handle response errors (4xx, 5xx)
    if (error.response) {
      const { status, data } = error.response
      
      // Handle string responses (like plain text from Go backend)
      if (typeof data === 'string' && data.trim()) {
        return data.trim()
      }
      
      // Handle object responses
      if (data && typeof data === 'object') {
        if (data.message) return data.message
        if (data.error) return data.error
        if (data.detail) return data.detail
      }
      
      // Default status-based messages
      switch (status) {
        case 400:
          return 'Bad request - please check your input'
        case 401:
          return 'Authentication required - please login'
        case 403:
          return 'Access denied'
        case 404:
          return 'Resource not found'
        case 500:
          return 'Server error - please try again later'
        default:
          return `HTTP ${status}: ${error.response.statusText || 'Unknown error'}`
      }
    }
    
    // Handle request errors (network, timeout, etc.)
    if (error.request) {
      if (error.code === 'ECONNREFUSED') {
        return 'Cannot connect to server - please check if the backend is running'
      }
      if (error.code === 'NETWORK_ERROR') {
        return 'Network error - please check your connection'
      }
      if (error.code === 'TIMEOUT') {
        return 'Request timed out - please try again'
      }
      return 'Network error - unable to reach server'
    }
    
    // Fallback for other errors
    return error.message || 'An unexpected error occurred'
  }
  
  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get(url, { params })
    return response.data
  }
  
  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post(url, data)
    return response.data
  }
  
  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put(url, data)
    return response.data
  }
  
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete(url)
    return response.data
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export const apiClient = new ApiClient({
  baseURL: API_URL
})
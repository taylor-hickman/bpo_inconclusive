import Cookies from 'js-cookie'
import type { ApiConfig } from '@/lib/types'

interface FetchError extends Error {
  status?: number
  code?: string
  originalError?: any
}

class ApiClient {
  private baseURL: string
  private timeout: number
  private headers: Record<string, string>
  
  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL
    this.timeout = config.timeout || 10000
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers
    }
  }
  
  private async request<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const token = Cookies.get('token')
    const headers: Record<string, string> = {
      ...this.headers,
      ...options.headers as Record<string, string>
    }
    
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorMessage = await this.extractErrorMessage(response)
        const error: FetchError = new Error(errorMessage)
        error.status = response.status
        error.code = response.status.toString()
        throw error
      }

      const data = await response.json()
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError: FetchError = new Error('Request timed out - please try again')
        timeoutError.code = 'TIMEOUT'
        throw timeoutError
      }
      throw error
    }
  }
  
  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const text = await response.text()
      
      // Try to parse as JSON first
      try {
        const data = JSON.parse(text)
        if (data.message) return data.message
        if (data.error) return data.error
        if (data.detail) return data.detail
      } catch {
        // If not JSON, use the text directly
        if (text.trim()) return text.trim()
      }
    } catch {
      // If we can't read the response body, fall back to status
    }
    
    // Default status-based messages
    switch (response.status) {
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
        return `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`
    }
  }
  
  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    let fullUrl = url
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value != null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        fullUrl += `?${queryString}`
      }
    }
    return this.request<T>(fullUrl, { method: 'GET' })
  }
  
  async post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async put<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }
  
  async delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' })
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export const apiClient = new ApiClient({
  baseURL: API_URL
})
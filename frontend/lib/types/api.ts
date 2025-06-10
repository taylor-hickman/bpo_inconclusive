export interface ApiError {
  message: string
  status?: number
  code?: string
}

export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface ApiConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}

export interface RequestConfig {
  method: HttpMethod
  url: string
  data?: any
  params?: Record<string, any>
  headers?: Record<string, string>
}
// Secure API client for multi-user backend integration

import { logError, logSecurity } from '../security/secure-logger';

interface ApiConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class SecureApiClient {
  private config: ApiConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: config.timeout || 30000,
      retries: config.retries || 3
    };
  }

  // Set authentication tokens
  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  // Clear authentication tokens
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Make authenticated API request
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    };

    // Add authentication header if token exists
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Include cookies for refresh token
    };

    try {
      const response = await this.fetchWithTimeout(url, requestOptions);
      
      // Handle token refresh if needed
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry original request with new token
          headers.Authorization = `Bearer ${this.accessToken}`;
          const retryResponse = await this.fetchWithTimeout(url, {
            ...requestOptions,
            headers
          });
          return await this.handleResponse<T>(retryResponse);
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      logError(`API request failed: ${endpoint}`, 'API-CLIENT');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          data: data.data || data,
          message: data.message
        };
      } else {
        logSecurity('API error response', { 
          status: response.status, 
          endpoint: response.url 
        });
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Invalid response format'
      };
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        return true;
      }
    } catch (error) {
      logError('Token refresh failed', 'API-CLIENT');
    }
    
    return false;
  }

  // HTTP methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }
}

// Export singleton instance
export const apiClient = new SecureApiClient();

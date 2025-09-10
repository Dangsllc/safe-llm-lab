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

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: config.timeout || 30000,
      retries: config.retries || 3
    };
  }

  // Legacy methods kept for compatibility (tokens now in HTTP-only cookies)
  setTokens(accessToken: string, refreshToken?: string): void {
    // No-op: tokens are now managed via HTTP-only cookies
  }

  // Clear authentication tokens (cookies cleared by server on logout)
  clearTokens(): void {
    // No-op: cookies cleared by server
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

    // No manual Authorization header needed - using HTTP-only cookies now

    const requestOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Include HTTP-only cookies for authentication
    };

    try {
      const response = await this.fetchWithTimeout(url, requestOptions);
      
      // Handle token refresh if needed (automatic with HTTP-only cookies)
      if (response.status === 401) {
        // Try refresh token endpoint - cookies will be updated automatically
        try {
          const refreshResponse = await this.fetchWithTimeout(
            `${this.config.baseURL}/auth/refresh`, 
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          if (refreshResponse.ok) {
            // Retry original request with refreshed cookies
            const retryResponse = await this.fetchWithTimeout(url, requestOptions);
            return await this.handleResponse<T>(retryResponse);
          }
        } catch (refreshError) {
          // Refresh failed, return original 401 response
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

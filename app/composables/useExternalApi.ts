import { defu } from 'defu'
import { useToast } from '#imports'

/**
 * useExternalApi
 * 
 * A unified composable for making external API requests.
 * It seamlessly supports both direct client-side requests (for CORS-enabled public APIs)
 * and server-side proxied requests (to bypass CORS or hide sensitive API keys).
 * 
 * Usage Examples:
 * 
 * 1. Direct Call (Public APIs with CORS allowed):
 *    const { get } = useExternalApi()
 *    const data = await get('https://api.github.com/users/octocat')
 * 
 * 2. Proxied Call (Bypass CORS via our own Nitro server):
 *    const { get } = useExternalApi({ proxy: true })
 *    // The request will be sent to our backend: /api/proxy/other-service/data
 *    // Our backend will then fetch: https://other-service.com/data
 *    const data = await get('https://other-service.com/data')
 */

export interface ExternalApiOptions {
  /**
   * If true, the request will be sent through our internal Nitro server proxy
   * to bypass browser CORS restrictions.
   * Default: false
   */
  proxy?: boolean
  /**
   * Default headers to attach to every request
   */
  headers?: Record<string, string>
  
  baseURL?: string
}

export const useExternalApi = (globalOptions: ExternalApiOptions = {}) => {
  const toast = useToast()

  const fetchApi = async <T>(url: string, fetchOptions: any = {}) => {
    // Determine the actual URL to fetch
    let targetUrl = url
    
    // If proxy is enabled
    if (globalOptions.proxy) {
      targetUrl = '/api/proxy/external'
      
      // Merge baseURL if provided and the url isn't already an absolute URL
      if (globalOptions.baseURL && !url.startsWith('http')) {
        const base = globalOptions.baseURL.replace(/\/+$/, '')
        const path = url.startsWith('/') ? url : `/${url}`
        url = `${base}${path}`
      }
      
      // Pass the original target URL as a query parameter
      fetchOptions.query = {
        ...fetchOptions.query,
        target: url
      }
    }

    const defaults = {
      headers: {
        ...globalOptions.headers
      },
      // 1. Request Interceptor
      onRequest({ options }: any) {
        // You can automatically attach auth tokens here if needed
        // const { user } = useCustomerAuth()
        // if (user.value?.token) options.headers.Authorization = `Bearer ${user.value.token}`
      },
      
      // 2. Error Interceptor
      onResponseError({ response }: any) {
        // Attempt to extract a meaningful error message from the external service
        const message = response._data?.message || response._data?.error || response.statusText || 'External Service Error'
        
        // Show a unified error toast
        if (import.meta.client) {
          toast.add({
            title: 'Request Failed',
            description: message,
            color: 'error',
            icon: 'ph:warning-circle-bold'
          })
        }
      }
    }

    // Merge provided options with our defaults using defu
    const params = defu(fetchOptions, defaults)

    try {
      return await $fetch<T>(targetUrl, params)
    } catch (error) {
      // Re-throw the error so the calling component can still handle it if it wants to
      throw error
    }
  }

  return {
    fetchApi,
    get: <T>(url: string, params?: any, options?: any) => 
      fetchApi<T>(url, { method: 'GET', query: params, ...options }),
    post: <T>(url: string, body?: any, options?: any) => 
      fetchApi<T>(url, { method: 'POST', body, ...options }),
    put: <T>(url: string, body?: any, options?: any) => 
      fetchApi<T>(url, { method: 'PUT', body, ...options }),
    delete: <T>(url: string, params?: any, options?: any) => 
      fetchApi<T>(url, { method: 'DELETE', query: params, ...options })
  }
}

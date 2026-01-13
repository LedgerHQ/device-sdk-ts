import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Axios Interceptor - intercepts axios requests and modifies their responses
 * Works in both browser and Node.js environments
 */

type GetJsonResponse = (url: string) => string | null;

export class AxiosInterceptor {
  private getJsonResponse: GetJsonResponse;
  private isActive = false;
  private requestInterceptorId: number | null = null;
  private responseInterceptorId: number | null = null;
  private axiosInstance: AxiosInstance;

  constructor(
    getJsonResponse: GetJsonResponse,
    axiosInstance: AxiosInstance = axios,
  ) {
    this.getJsonResponse = getJsonResponse;
    this.axiosInstance = axiosInstance;
  }

  /**
   * Start intercepting axios requests
   */
  start(): void {
    if (this.isActive) {
      console.warn("Axios Interceptor is already active");
      return;
    }

    // Add request interceptor
    this.requestInterceptorId = this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const url = config.url;
        if (!url) {
          return config;
        }

        // Build full URL with query parameters
        let fullUrl = this.buildFullUrl(config.baseURL, url);

        // Add query parameters if present
        if (config.params) {
          fullUrl = this.addQueryParams(fullUrl, config.params);
        }

        // Try to get modified response
        const response = this.getJsonResponse(fullUrl);
        if (response) {
          // Cancel the original request and inject our response
          const cancelToken = axios.CancelToken.source();
          config.cancelToken = cancelToken.token;

          // Immediately cancel the request and provide our response
          setTimeout(() => {
            cancelToken.cancel(response);
          }, 0);
        }

        return config;
      },
    );

    // Add response interceptor to handle our canceled requests
    this.responseInterceptorId = this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: unknown) => this.handleResponseError(error),
    );

    this.isActive = true;
  }

  /**
   * Stop intercepting axios requests
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.requestInterceptorId !== null) {
      this.axiosInstance.interceptors.request.eject(this.requestInterceptorId);
      this.requestInterceptorId = null;
    }

    if (this.responseInterceptorId !== null) {
      this.axiosInstance.interceptors.response.eject(
        this.responseInterceptorId,
      );
      this.responseInterceptorId = null;
    }

    this.isActive = false;
  }

  /**
   * Check if interceptor is currently active
   */
  isIntercepting(): boolean {
    return this.isActive;
  }

  /**
   * Build full URL from base URL and path
   */
  private buildFullUrl(baseURL: string | undefined, url: string): string {
    if (!baseURL) {
      return url;
    }
    return `${baseURL}${url.startsWith("/") ? url : `/${url}`}`;
  }

  /**
   * Add query parameters to URL
   */
  private addQueryParams(url: string, params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Handle axios response errors
   */
  private handleResponseError(error: unknown): Promise<AxiosResponse | never> {
    // Check if this is our intentional cancellation with a JSON response
    if (axios.isCancel(error) && this.isCustomCancellation(error)) {
      try {
        const message = (error as { message: string }).message;
        const data: unknown = JSON.parse(message);
        const config = (error as { config?: InternalAxiosRequestConfig })
          .config;

        // Return a successful response with our data
        return Promise.resolve({
          data,
          status: 200,
          statusText: "OK",
          headers: {},
          config: config!,
        } as AxiosResponse);
      } catch {
        // Not a valid JSON cancellation, pass through
      }
    }

    return Promise.reject(error);
  }

  /**
   * Check if the cancellation is one of ours (contains JSON message)
   */
  private isCustomCancellation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string"
    );
  }
}

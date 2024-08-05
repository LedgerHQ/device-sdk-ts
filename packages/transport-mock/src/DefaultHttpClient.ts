import { HttpClient } from "./HttpClient";

export type HttpClientArgs = {
  readonly baseUrl: string;
};

export class DefaultHttpClient implements HttpClient {
  private readonly baseUrl: string;

  constructor({ baseUrl }: HttpClientArgs) {
    this.baseUrl = baseUrl;
  }

  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    const requestHeaders = this.buildHeaders(headers);
    return this.fetchRequest<T>("GET", endpoint, undefined, requestHeaders);
  }

  post<T>(
    endpoint: string,
    body: object,
    headers?: Record<string, string>,
  ): Promise<T> {
    const requestHeaders = this.buildHeaders(headers);
    return this.fetchRequest<T>(
      "POST",
      endpoint,
      JSON.stringify(body),
      requestHeaders,
    );
  }

  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    const requestHeaders = this.buildHeaders(headers);
    return this.fetchRequest<T>("DELETE", endpoint, undefined, requestHeaders);
  }

  private fetchRequest<T>(
    method: string,
    endpoint: string,
    body?: string,
    headers?: HeadersInit,
  ): Promise<T> {
    const requestOptions: RequestInit = {
      method,
      headers,
      body,
      redirect: "follow",
    };

    return new Promise<T>((resolve, reject) => {
      fetch(this.baseUrl + endpoint, requestOptions)
        .then((response) => {
          if (response.ok) {
            response
              .json()
              .then((data) => {
                resolve(data as T);
              })
              .catch((_error) => {
                // Success but no body, try as boolean
                resolve(true as T);
              });
          } else {
            reject(new Error(`HTTP error: ${response.status}`));
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private buildHeaders(headers?: Record<string, string>): HeadersInit {
    const requestHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        requestHeaders[key] = value;
      });
    }

    return requestHeaders;
  }
}

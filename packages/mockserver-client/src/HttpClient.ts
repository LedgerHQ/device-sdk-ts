export interface HttpClient {
  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T>;
  post<T>(
    endpoint: string,
    body: object,
    headers?: Record<string, string>,
  ): Promise<T>;
  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T>;
}

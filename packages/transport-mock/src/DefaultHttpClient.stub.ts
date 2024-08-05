import { HttpClient } from "./HttpClient";

export const httpClientStubBuilder = () =>
  new (class HttpClientStub implements HttpClient {
    responses: {
      get: Record<string, object>;
      post: Record<string, object>;
      delete: Record<string, object>;
    };

    constructor() {
      this.responses = { get: {}, post: {}, delete: {} };
    }

    get<T>(endpoint: string, _headers?: Record<string, string>): Promise<T> {
      return Promise.resolve(this.responses.get[endpoint] as T);
    }
    post<T>(
      endpoint: string,
      _body: object,
      _headers?: Record<string, string>,
    ): Promise<T> {
      return Promise.resolve(this.responses.post[endpoint] as T);
    }
    delete<T>(endpoint: string, _headers?: Record<string, string>): Promise<T> {
      return Promise.resolve(this.responses.delete[endpoint] as T);
    }
    mockResponse({
      method,
      endpoint,
      response,
    }: {
      method: "get" | "post" | "delete";
      endpoint: string;
      response: object;
    }): HttpClientStub {
      this.responses = {
        ...this.responses,
        [method]: {
          [endpoint]: response,
        },
      };
      return this;
    }
  })();

import {
  type DmkNetworkClient,
  type DmkRequestConfig,
} from "@ledgerhq/device-management-kit";

type Method = "get" | "post" | "patch" | "delete";

export type DmkNetworkClientStub = DmkNetworkClient & {
  responses: Record<Method, Record<string, unknown>>;
  calls: { method: Method; endpoint: string; body?: object }[];
  mockResponse(args: {
    method: Method;
    endpoint: string;
    response: object;
  }): DmkNetworkClientStub;
};

export const httpClientStubBuilder = (): DmkNetworkClientStub => {
  const stub = new (class {
    responses: Record<Method, Record<string, unknown>>;
    calls: { method: Method; endpoint: string; body?: object }[];

    constructor() {
      this.responses = { get: {}, post: {}, patch: {}, delete: {} };
      this.calls = [];
    }

    get(endpoint: string, _config?: DmkRequestConfig): Promise<unknown> {
      this.calls.push({ method: "get", endpoint });
      return Promise.resolve(this.responses.get[endpoint]);
    }

    post(
      endpoint: string,
      body?: unknown,
      _config?: DmkRequestConfig,
    ): Promise<unknown> {
      this.calls.push({ method: "post", endpoint, body: body as object });
      return Promise.resolve(this.responses.post[endpoint]);
    }

    patch(
      endpoint: string,
      body?: unknown,
      _config?: DmkRequestConfig,
    ): Promise<unknown> {
      this.calls.push({ method: "patch", endpoint, body: body as object });
      return Promise.resolve(this.responses.patch[endpoint]);
    }

    delete(endpoint: string, _config?: DmkRequestConfig): Promise<unknown> {
      this.calls.push({ method: "delete", endpoint });
      return Promise.resolve(this.responses.delete[endpoint]);
    }

    mockResponse({
      method,
      endpoint,
      response,
    }: {
      method: Method;
      endpoint: string;
      response: object;
    }) {
      this.responses = {
        ...this.responses,
        [method]: {
          ...this.responses[method],
          [endpoint]: response,
        },
      };
      return this;
    }
  })();

  return stub as unknown as DmkNetworkClientStub;
};

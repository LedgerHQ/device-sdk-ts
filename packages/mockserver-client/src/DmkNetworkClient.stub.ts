import {
  type DmkNetworkClient,
  type DmkRequestConfig,
} from "@ledgerhq/device-management-kit";

type Method = "get" | "post" | "patch" | "delete";

export type DmkNetworkClientStub = DmkNetworkClient & {
  responses: Record<Method, Record<string, unknown>>;
  calls: { method: Method; endpoint: string; body?: object }[];
  /** Per-call request config, kept aside so `calls` stays easy to match on. */
  configs: { method: Method; endpoint: string; config?: DmkRequestConfig }[];
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
    configs: { method: Method; endpoint: string; config?: DmkRequestConfig }[];

    constructor() {
      this.responses = { get: {}, post: {}, patch: {}, delete: {} };
      this.calls = [];
      this.configs = [];
    }

    get(endpoint: string, config?: DmkRequestConfig): Promise<unknown> {
      this.calls.push({ method: "get", endpoint });
      this.configs.push({ method: "get", endpoint, config });
      return Promise.resolve(this.responses.get[endpoint]);
    }

    post(
      endpoint: string,
      body?: unknown,
      config?: DmkRequestConfig,
    ): Promise<unknown> {
      this.calls.push({ method: "post", endpoint, body: body as object });
      this.configs.push({ method: "post", endpoint, config });
      return Promise.resolve(this.responses.post[endpoint]);
    }

    patch(
      endpoint: string,
      body?: unknown,
      config?: DmkRequestConfig,
    ): Promise<unknown> {
      this.calls.push({ method: "patch", endpoint, body: body as object });
      this.configs.push({ method: "patch", endpoint, config });
      return Promise.resolve(this.responses.patch[endpoint]);
    }

    delete(endpoint: string, config?: DmkRequestConfig): Promise<unknown> {
      this.calls.push({ method: "delete", endpoint });
      this.configs.push({ method: "delete", endpoint, config });
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

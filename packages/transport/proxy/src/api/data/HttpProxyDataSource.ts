import axios, { type Axios, type AxiosResponse } from "axios";

import { type ProxyDataSource } from "@api/data/ProxyDataSource";

export const createHttpProxyDataSource = (fetcher: Axios) =>
  class HttpProxyDataSource implements ProxyDataSource {
    url: string;
    controllers: AbortController[] = [];
    internalFetcher: Axios;

    constructor(url: string) {
      this.url = url;
      this.internalFetcher = fetcher;
    }

    async postAdpu(apduHex: string): Promise<string> {
      const controller = new AbortController();
      this.controllers.push(controller);

      try {
        const requestDto = { data: apduHex };
        const response: AxiosResponse<{ data: string }> =
          await this.internalFetcher.post(this.url, requestDto, {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            timeout: 5000,
            signal: controller.signal,
          });
        return response.data.data;
      } finally {
        this.controllers = this.controllers.filter((c) => c !== controller);
      }
    }

    close(): void {
      this.controllers.forEach((c) => c.abort());
      this.controllers = [];
    }
  };

export const HttpProxyDataSource = createHttpProxyDataSource(axios);
export type HttpProxyDataSourceInstance = InstanceType<
  typeof HttpProxyDataSource
>;

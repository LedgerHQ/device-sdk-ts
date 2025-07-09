import axios from "axios";

import { type ProxyDataSource } from "@api/data/ProxyDataSource";

export class HttpProxyDataSource implements ProxyDataSource {
  constructor(private readonly url: string) {}

  async postAdpu(apduHex: string): Promise<string> {
    const requestDto = { data: apduHex };
    const response = await axios.post<{
      data: string;
    }>(this.url, requestDto, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
    return response.data.data;
  }
}

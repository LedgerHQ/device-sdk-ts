import axios, { type AxiosInstance } from "axios";
import http from "http";
import https from "https";

export function makeNoKeepAliveAxios(
  baseUrl: string,
  timeoutMs: number,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: timeoutMs,
    proxy: false,
    headers: {
      "X-Ledger-Client-Version": clientHeader,
      Connection: "close",
    },
    httpAgent: new http.Agent({ keepAlive: false, maxSockets: Infinity }),
    httpsAgent: new https.Agent({ keepAlive: false, maxSockets: Infinity }),
    transitional: { clarifyTimeoutError: true },
  });
}

export function makeKeepAliveAxiosForSSE(
  baseUrl: string,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: 0,
    proxy: false,
    headers: {
      "X-Ledger-Client-Version": clientHeader,

      Connection: "keep-alive",
    },
    httpAgent: new http.Agent({
      keepAlive: true,
      maxSockets: 1,
      maxFreeSockets: 1,
    }),
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: 1,
      maxFreeSockets: 1,
    }),
    transitional: { clarifyTimeoutError: true },
  });
}

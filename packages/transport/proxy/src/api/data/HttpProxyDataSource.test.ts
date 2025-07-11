/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
// tests/HttpProxyDataSource.test.ts
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHttpProxyDataSource } from "@api/data/HttpProxyDataSource";

class MockAxios {
  post =
    vi.fn<
      (
        url: string,
        data: { data: string },
        config?: AxiosRequestConfig,
      ) => Promise<AxiosResponse<{ data: string }>>
    >();
}

describe("HttpProxyDataSource (injected)", () => {
  const mockUrl = "http://example.com/proxy";
  let mockAxios: MockAxios;
  let HttpProxyDataSource: ReturnType<typeof createHttpProxyDataSource>;

  beforeEach(() => {
    mockAxios = new MockAxios();
    HttpProxyDataSource = createHttpProxyDataSource(mockAxios as any);
  });

  it("POSTs the APDU hex and returns the inner data string", async () => {
    // given
    const apduHex = "f0cacc1a";
    const responseData = "abadbeef";
    const fakeResponse: AxiosResponse<{ data: string }> = {
      data: { data: responseData },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {} as any,
    };
    mockAxios.post.mockResolvedValue(fakeResponse);
    const ds = new HttpProxyDataSource(mockUrl);

    // when
    const result = await ds.postAdpu(apduHex);

    // then
    expect(result).toBe(responseData);
    expect(mockAxios.post).toHaveBeenCalledWith(
      mockUrl,
      { data: apduHex },
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 5000,
        signal: expect.any(AbortSignal),
      }),
    );

    expect(ds.controllers).toHaveLength(0);
  });

  it("forwards errors from axios.post", async () => {
    // given
    const apduHex = "f0cacc1a";
    const networkError = new Error("network failure");
    mockAxios.post.mockRejectedValue(networkError);
    const ds = new HttpProxyDataSource(mockUrl);

    // then
    await expect(ds.postAdpu(apduHex)).rejects.toThrow(networkError);
    expect(mockAxios.post).toHaveBeenCalledWith(
      mockUrl,
      { data: apduHex },
      expect.any(Object),
    );
    expect(ds.controllers).toHaveLength(0);
  });

  it("should abort in-flight requests and reject promises when close() is called", async () => {
    // given
    const apduHex = "f0cacc1a";
    let capturedSignal: AbortSignal;
    mockAxios.post.mockImplementation((_url, _data, config) => {
      capturedSignal = config!.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        capturedSignal.addEventListener("abort", () => {
          reject(new Error("canceled by close()"));
        });
      });
    });
    const ds = new HttpProxyDataSource(mockUrl);

    // when
    const promise = ds.postAdpu(apduHex);

    // then
    expect(ds.controllers).toHaveLength(1);
    ds.close();
    await expect(promise).rejects.toThrow("canceled by close()");
    expect(ds.controllers).toHaveLength(0);
  });

  it("close() should not throw when there are no pending controllers", () => {
    // given
    const ds = new HttpProxyDataSource(mockUrl);

    // then
    expect(() => ds.close()).not.toThrow();
    expect(ds.controllers).toHaveLength(0);
    expect(() => ds.close()).not.toThrow();
  });
});

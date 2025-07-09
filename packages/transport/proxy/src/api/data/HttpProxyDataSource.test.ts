/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// tests/HttpProxyDataSource.test.ts
import axios, { type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpProxyDataSource } from "@api/data/HttpProxyDataSource";

vi.mock("axios");
describe("HttpProxyDataSource", () => {
  const mockUrl = "http://example.com/proxy";
  let dataSource: HttpProxyDataSource;

  beforeEach(() => {
    vi.resetAllMocks();
    dataSource = new HttpProxyDataSource(mockUrl);
  });

  it("should POST the APDU hex and return the inner data string", async () => {
    // given
    const apduHex = "f0cacc1a";
    const responseData = "deadbeef";
    const fakeResponse: AxiosResponse<{ data: string }> = {
      data: { data: responseData },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: {} } as any,
    };

    // @ts-expect-error mock
    axios.post.mockResolvedValue(fakeResponse);

    // when
    const result = await dataSource.postAdpu(apduHex);

    // then
    expect(result).toBe(responseData);
    expect(axios.post).toHaveBeenCalledWith(
      mockUrl,
      { data: apduHex },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        timeout: 5000,
      },
    );
  });

  it("should throw if axios.post rejects", async () => {
    // given
    const apduHex = "f0cacc1a";
    const networkError = new Error("network failure");

    // @ts-expect-error mock
    axios.post.mockRejectedValue(networkError);

    // when
    await expect(dataSource.postAdpu(apduHex)).rejects.toThrow(networkError);

    // then
    expect(axios.post).toHaveBeenCalledWith(
      mockUrl,
      { data: apduHex },
      expect.any(Object),
    );
  });
});

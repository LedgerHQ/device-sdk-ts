import axios from "axios";
import { Left, Right } from "purify-ts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";

import { HttpNetworkDataSource } from "./HttpNetworkDataSource";

vi.mock("axios");

describe("HttpNetworkDataSource", () => {
  let datasource: HttpNetworkDataSource;
  const mockConfig: ContextModuleConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleConfig;

  const mockNetworkResponse = {
    data: {
      data: [
        {
          id: "ethereum",
          descriptors: {
            flex: {
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c",
              descriptorType: "network",
              descriptorVersion: "v1",
              signatures: {
                prod: "3045022100c116b5470c266c2947b92aa9eadbe3da03305efc6b8fee041e04e8484a9834af022041d5b82b359614ea8dd94a542dfd87b0ae6f3b4a075aad9a53a030064ab42cd0",
                test: "3045022100f78bac5c9c3f2ceeea26680aaea17be61fce84ae7ec983a8194e68275f4fe5900220231afbe39fcec63edfea2b4e787a72d79ce53d6a4c408f24b5a116905a9082d3",
              },
            },
            stax: {
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c53204aa5034d2fd4c46647d382aa64d0a03d06b185512bb7942390318bda18d0423a",
              descriptorType: "network",
              descriptorVersion: "v1",
              signatures: {
                prod: "3045022100cf42c039c16fc95dc97c09f15cdd93bed0e63ee45cf5c38c2b30bb8a3bc17f8d022053a96c9e51695c3c1c1a31f5cbf84bd6febadc97f4bb02bdc67cf3e24ad0c32d",
                test: "304402207e1e1b8f99b45c95b0cf1e90f46cf07e6a90f82c49ccdb6e2e95ab0c1e2f5a370220784e1fac16bb01c5d096733e1cbf067d616e4de659fda2c388f8c3502e7f7f80",
              },
            },
          },
        },
      ],
    },
  };

  beforeAll(() => {
    datasource = new HttpNetworkDataSource(mockConfig);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNetworkConfiguration", () => {
    it("should return network configuration successfully", async () => {
      vi.mocked(axios.get).mockResolvedValue(mockNetworkResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(axios.get).toHaveBeenCalledWith(
        "https://crypto-assets-service.api.ledger.com/v1/networks?output=id,descriptors,icons&chain_id=1",
        expect.objectContaining({
          headers: expect.any(Object) as Record<string, string>,
        }),
      );

      expect(result).toEqual(
        Right({
          id: "ethereum",
          descriptors: {
            flex: {
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c",
              descriptorType: "network",
              descriptorVersion: "v1",
              signatures: {
                prod: "3045022100c116b5470c266c2947b92aa9eadbe3da03305efc6b8fee041e04e8484a9834af022041d5b82b359614ea8dd94a542dfd87b0ae6f3b4a075aad9a53a030064ab42cd0",
                test: "3045022100f78bac5c9c3f2ceeea26680aaea17be61fce84ae7ec983a8194e68275f4fe5900220231afbe39fcec63edfea2b4e787a72d79ce53d6a4c408f24b5a116905a9082d3",
              },
              icon: undefined,
            },
            stax: {
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c53204aa5034d2fd4c46647d382aa64d0a03d06b185512bb7942390318bda18d0423a",
              descriptorType: "network",
              descriptorVersion: "v1",
              signatures: {
                prod: "3045022100cf42c039c16fc95dc97c09f15cdd93bed0e63ee45cf5c38c2b30bb8a3bc17f8d022053a96c9e51695c3c1c1a31f5cbf84bd6febadc97f4bb02bdc67cf3e24ad0c32d",
                test: "304402207e1e1b8f99b45c95b0cf1e90f46cf07e6a90f82c49ccdb6e2e95ab0c1e2f5a370220784e1fac16bb01c5d096733e1cbf067d616e4de659fda2c388f8c3502e7f7f80",
              },
              icon: undefined,
            },
          },
        }),
      );
    });

    it("should return error when network data is not found", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { data: [] } });

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Network configuration not found for chain ID: 1")),
      );
    });

    it("should return error when network data is undefined", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: { data: undefined } });

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Network configuration not found for chain ID: 1")),
      );
    });

    it("should return error when axios throws an error", async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(Left(new Error("Network error")));
    });

    it("should return generic error when axios throws non-Error", async () => {
      vi.mocked(axios.get).mockRejectedValue("String error");

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Failed to fetch network configuration")),
      );
    });

    it("should handle invalid data - missing id", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              // Missing id
              descriptors: {},
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(invalidResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(
          new Error("Invalid network configuration response for chain ID: 1"),
        ),
      );
    });

    it("should handle invalid data - missing descriptors", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              // Missing descriptors
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(invalidResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(
          new Error("Invalid network configuration response for chain ID: 1"),
        ),
      );
    });

    it("should handle invalid descriptor - missing data field", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  // Missing data
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: { prod: "sig1", test: "sig2" },
                },
              },
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(invalidResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(
          new Error("Invalid network configuration response for chain ID: 1"),
        ),
      );
    });

    it("should handle invalid descriptor - missing signatures", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  data: "0x0101",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  // Missing signatures
                },
              },
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(invalidResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(
          new Error("Invalid network configuration response for chain ID: 1"),
        ),
      );
    });

    it("should handle invalid signatures - missing prod", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  data: "0x0101",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: {
                    // Missing prod
                    test: "sig2",
                  },
                },
              },
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(invalidResponse);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(
          new Error("Invalid network configuration response for chain ID: 1"),
        ),
      );
    });

    it("should include icons when available", async () => {
      const responseWithIcons = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  data: "0x0101",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: {
                    prod: "sig1",
                    test: "sig2",
                  },
                },
                stax: {
                  data: "0x0102",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: {
                    prod: "sig3",
                    test: "sig4",
                  },
                },
              },
              icons: {
                flex: "icon1",
                stax: "icon2",
              },
            },
          ],
        },
      };
      vi.mocked(axios.get).mockResolvedValue(responseWithIcons);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result.isRight()).toBe(true);
      const configuration = result.unsafeCoerce();
      expect(configuration.descriptors.flex.icon).toBe("icon1");
      expect(configuration.descriptors.stax.icon).toBe("icon2");
    });

    it("should transform data correctly for Polygon chain ID", async () => {
      vi.mocked(axios.get).mockResolvedValue(mockNetworkResponse);

      const result = await datasource.getNetworkConfiguration(137);

      expect(axios.get).toHaveBeenCalledWith(
        "https://crypto-assets-service.api.ledger.com/v1/networks?output=id,descriptors,icons&chain_id=137",
        expect.objectContaining({
          headers: expect.any(Object) as Record<string, string>,
        }),
      );

      expect(result.isRight()).toBe(true);
      const configuration = result.unsafeCoerce();
      expect(Object.keys(configuration.descriptors)).toEqual(["flex", "stax"]);
    });
  });
});

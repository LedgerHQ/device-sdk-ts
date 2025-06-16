import axios from "axios";
import { Left, Right } from "purify-ts";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpNetworkDataSource } from "./HttpNetworkDataSource";

vi.mock("axios");

describe("HttpNetworkDataSource", () => {
  let datasource: HttpNetworkDataSource;
  const mockConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
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
                prod: "3045022100cac32e087b20a4f2cddff4d3a8bc2910d41e15846588cd6b5f40b35e031373f102207a274ee0bdcc18ab55746e2fadff65cb47153bc6ece4d307477c73bacd357c10",
                test: "3045022100b8324978440822055e4b38bf9c90d21ad5b4e6fc05bb6effb91f3e4790b7fc64022025aab5f6081e895e3c252f0ee9003dd966ad6d48ab0e177d021ebd8189dd01d1",
              },
            },
          },
          icons: {
            flex: "https://example.com/flex-icon.svg",
            stax: "https://example.com/stax-icon.svg",
          },
        },
      ],
    },
  };

  beforeAll(() => {
    const axiosInstance = {
      get: vi.fn(),
    };
    datasource = new HttpNetworkDataSource(axiosInstance as any);
    vi.clearAllMocks();
  });

  describe("getNetworkConfiguration", () => {
    it("should return network configuration successfully", async () => {
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(mockNetworkResponse),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(axiosInstance.get).toHaveBeenCalledWith(
        "/v1/networks?output=id,descriptors,icons&chain_id=1"
      );

      expect(result).toEqual(
        Right({
          id: "ethereum",
          descriptors: {
            flex: {
              descriptorType: "network",
              descriptorVersion: "v1",
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c",
              signatures: {
                prod: "3045022100c116b5470c266c2947b92aa9eadbe3da03305efc6b8fee041e04e8484a9834af022041d5b82b359614ea8dd94a542dfd87b0ae6f3b4a075aad9a53a030064ab42cd0",
                test: "3045022100f78bac5c9c3f2ceeea26680aaea17be61fce84ae7ec983a8194e68275f4fe5900220231afbe39fcec63edfea2b4e787a72d79ce53d6a4c408f24b5a116905a9082d3",
              },
              icon: "https://example.com/flex-icon.svg",
            },
            stax: {
              descriptorType: "network",
              descriptorVersion: "v1",
              data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c53204aa5034d2fd4c46647d382aa64d0a03d06b185512bb7942390318bda18d0423a",
              signatures: {
                prod: "3045022100cac32e087b20a4f2cddff4d3a8bc2910d41e15846588cd6b5f40b35e031373f102207a274ee0bdcc18ab55746e2fadff65cb47153bc6ece4d307477c73bacd357c10",
                test: "3045022100b8324978440822055e4b38bf9c90d21ad5b4e6fc05bb6effb91f3e4790b7fc64022025aab5f6081e895e3c252f0ee9003dd966ad6d48ab0e177d021ebd8189dd01d1",
              },
              icon: "https://example.com/stax-icon.svg",
            },
          },
        })
      );
    });

    it("should return error when network data is not found", async () => {
      const axiosInstance = {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Network configuration not found for chain ID: 1"))
      );
    });

    it("should return error when network data is undefined", async () => {
      const axiosInstance = {
        get: vi.fn().mockResolvedValue({ data: { data: undefined } }),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Network configuration not found for chain ID: 1"))
      );
    });

    it("should return error when axios throws an error", async () => {
      const axiosInstance = {
        get: vi.fn().mockRejectedValue(new Error("Network error")),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(Left(new Error("Network error")));
    });

    it("should return error when axios throws non-Error", async () => {
      const axiosInstance = {
        get: vi.fn().mockRejectedValue("string error"),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Failed to fetch network configuration"))
      );
    });

    it("should return error when response has invalid structure - missing id", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              // missing id
              descriptors: {},
              icons: {},
            },
          ],
        },
      };
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(invalidResponse),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Invalid network configuration response for chain ID: 1"))
      );
    });

    it("should return error when response has invalid descriptor structure", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  // missing required fields
                  data: "0x123",
                  // missing descriptorType, descriptorVersion, signatures
                },
              },
              icons: {},
            },
          ],
        },
      };
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(invalidResponse),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Invalid network configuration response for chain ID: 1"))
      );
    });

    it("should return error when signatures are invalid", async () => {
      const invalidResponse = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  data: "0x123",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: {
                    prod: "signature",
                    // missing test signature
                  },
                },
              },
              icons: {},
            },
          ],
        },
      };
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(invalidResponse),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Left(new Error("Invalid network configuration response for chain ID: 1"))
      );
    });

    it("should handle missing icons gracefully", async () => {
      const responseWithoutIcons = {
        data: {
          data: [
            {
              id: "ethereum",
              descriptors: {
                flex: {
                  data: "0x123",
                  descriptorType: "network",
                  descriptorVersion: "v1",
                  signatures: {
                    prod: "prod-sig",
                    test: "test-sig",
                  },
                },
              },
              // no icons field
            },
          ],
        },
      };
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(responseWithoutIcons),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(1);

      expect(result).toEqual(
        Right({
          id: "ethereum",
          descriptors: {
            flex: {
              descriptorType: "network",
              descriptorVersion: "v1",
              data: "0x123",
              signatures: {
                prod: "prod-sig",
                test: "test-sig",
              },
              icon: undefined,
            },
          },
        })
      );
    });

    it("should transform multiple device descriptors correctly", async () => {
      const axiosInstance = {
        get: vi.fn().mockResolvedValue(mockNetworkResponse),
      };
      datasource = new HttpNetworkDataSource(axiosInstance as any);

      const result = await datasource.getNetworkConfiguration(137);

      expect(axiosInstance.get).toHaveBeenCalledWith(
        "/v1/networks?output=id,descriptors,icons&chain_id=137"
      );

      const configuration = result._tag === "Right" ? result.right : null;
      expect(configuration).not.toBeNull();
      expect(Object.keys(configuration!.descriptors)).toEqual(["flex", "stax"]);
    });
  });
});
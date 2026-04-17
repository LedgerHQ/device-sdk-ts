import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { HttpAccountOwnershipDataSource } from "./HttpAccountOwnershipDataSource";

vi.mock("axios");

describe("HttpAccountOwnershipDataSource", () => {
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: {
      url: "https://nft.api.live.ledger-test.com",
    },
    originToken: "test-origin-token",
  } as ContextModuleServiceConfig;

  const validDto = {
    signedDescriptor: "signed-descriptor-data",
    keyId: "domain_metadata_key",
    keyUsage: "trusted_name",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDescriptor", () => {
    it("should return descriptor on successful request", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://nft.api.live.ledger-test.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        params: {
          challenge: "0xabcdef",
          network: "mainnet",
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: "test-origin-token",
        },
      });
      expect(result).toEqual(
        Right({
          signedDescriptor: "signed-descriptor-data",
          keyId: "domain_metadata_key",
          keyUsage: "trusted_name",
        }),
      );
    });

    it("should pass testnet network parameter", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "testnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      // WHEN
      await new HttpAccountOwnershipDataSource(config).getDescriptor(params);

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            challenge: "0xabcdef",
            network: "testnet",
          },
        }),
      );
    });

    it("should return error when response data is empty", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: null,
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: unexpected empty response",
          ),
        ),
      );
    });

    it("should return error when signedDescriptor is missing", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: {
          keyId: "domain_metadata_key",
          keyUsage: "trusted_name",
        },
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        ),
      );
    });

    it("should return error when keyId is missing", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: {
          signedDescriptor: "signed-descriptor-data",
          keyUsage: "trusted_name",
        },
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        ),
      );
    });

    it("should return error when keyUsage is missing", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: {
          signedDescriptor: "signed-descriptor-data",
          keyId: "domain_metadata_key",
        },
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        ),
      );
    });

    it("should return error when field has wrong type", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: {
          signedDescriptor: "signed-descriptor-data",
          keyId: 123,
          keyUsage: "trusted_name",
        },
      });

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: invalid response format",
          ),
        ),
      );
    });

    it("should return error when axios request fails", async () => {
      // GIVEN
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockRejectedValue(new Error("Network error"));

      // WHEN
      const result = await new HttpAccountOwnershipDataSource(
        config,
      ).getDescriptor(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpAccountOwnershipDataSource: Failed to fetch account ownership descriptor",
          ),
        ),
      );
    });

    it("should use correct metadata service URL from config", async () => {
      // GIVEN
      const customConfig: ContextModuleServiceConfig = {
        metadataServiceDomain: {
          url: "https://custom-metadata.example.com",
        },
        originToken: "custom-token",
      } as ContextModuleServiceConfig;
      const params = {
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet" as const,
      };
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validDto,
      });

      // WHEN
      await new HttpAccountOwnershipDataSource(customConfig).getDescriptor(
        params,
      );

      // THEN
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://custom-metadata.example.com/v2/concordium/owner/abcdef1234567890/3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
          headers: expect.objectContaining({
            [LEDGER_ORIGIN_TOKEN_HEADER]: "custom-token",
          }),
        }),
      );
    });
  });
});

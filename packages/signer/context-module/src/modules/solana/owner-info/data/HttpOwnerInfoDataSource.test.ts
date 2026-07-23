/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeviceModelId,
  type DmkNetworkClient,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Left } from "purify-ts";

import type { ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpOwnerInfoDataSource } from "@/modules/solana/owner-info/data/HttpOwnerInfoDataSource";
import type { SolanaTransactionContext } from "@/modules/solana/owner-info/domain/solanaContextTypes";

function stringToHex(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str); // Uint8Array
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("HttpOwnerInfoDataSource", () => {
  const config = {
    metadataServiceDomain: { url: "https://some.doma.in" },
    originToken: "mock-origin-token",
  } as ContextModuleServiceConfig;

  const signedDescriptorHex = stringToHex("mock-descriptor");
  const responseData = {
    tokenAccount: "token-account",
    owner: "owner-address",
    contract: "contract-address",
    signedDescriptor: signedDescriptorHex,
  };

  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    httpMock = { get: vi.fn() };
  });

  it("should fetch address metadata via tokenAddress", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };
    httpMock.get.mockResolvedValueOnce(responseData);

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(httpMock.get).toHaveBeenCalledWith(
      `${config.metadataServiceDomain.url}/v2/solana/owner/some-token`,
      { params: { challenge: "random" } },
    );
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual({
      tlvDescriptor: hexaStringToBuffer(signedDescriptorHex),
    });
  });

  it("should return an error if both tokenAddress and createATA are missing or invalid", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: either tokenAddress or valid createATA must be provided",
        ),
      ),
    );
  });

  it("should return an error if challenge is missing", async () => {
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: undefined,
      createATA: undefined,
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: challenge is required",
        ),
      ),
    );
  });

  it("should return an error if the descriptor is not valid base64", async () => {
    httpMock.get.mockResolvedValueOnce({
      ...responseData,
      signedDescriptor: "!!!not-valid-base64!!!",
    });
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: invalid base64 tlvDescriptor received",
        ),
      ),
    );
  });

  it("should return an error if the metadata request fails", async () => {
    httpMock.get.mockRejectedValueOnce(new Error("Network error"));
    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: Failed to fetch address metadata",
        ),
      ),
    );
  });

  it("should return an error if fetch request return wrong shape for fetchAddressMetadata", async () => {
    httpMock.get.mockResolvedValueOnce({ wrong: "field" });

    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: "some-token",
      challenge: "random",
      createATA: undefined,
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: invalid fetchAddressMetadata response shape",
        ),
      ),
    );
  });

  it("should return an error if fetch request return wrong shape for computeAddressMetadata", async () => {
    httpMock.get.mockResolvedValueOnce({ wrong: "field" });

    const context: SolanaTransactionContext = {
      deviceModelId: DeviceModelId.FLEX,
      tokenAddress: undefined,
      challenge: "random",
      createATA: {
        address: "some-address",
        mintAddress: "some-mint",
      },
    };

    const dataSource = new HttpOwnerInfoDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
    const result = await dataSource.getOwnerInfo(context);

    expect(httpMock.get).toHaveBeenCalledWith(
      `${config.metadataServiceDomain.url}/v2/solana/computed-token-account/some-address/some-mint`,
      { params: { challenge: "random" } },
    );
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] - HttpOwnerInfoDataSource: invalid computeAddressMetadata response shape",
        ),
      ),
    );
  });
});

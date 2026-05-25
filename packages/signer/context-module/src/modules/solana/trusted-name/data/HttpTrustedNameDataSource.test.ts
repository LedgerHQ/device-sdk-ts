/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpSolanaTrustedNameDataSource } from "./HttpTrustedNameDataSource";
import { type SolanaTrustedNameDataSource } from "./TrustedNameDataSource";

describe("HttpSolanaTrustedNameDataSource", () => {
  let datasource: SolanaTrustedNameDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const address = "vitalik.sol";
  const challenge = "deadbeef";
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: { url: "https://nft.api.ledger.com" },
  } as ContextModuleServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpSolanaTrustedNameDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls the names endpoint with network, types, sources and challenge", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "01020304",
      keyId: "name_key",
      keyUsage: "trusted_name",
    });

    await datasource.getTrustedName({
      address,
      network: "mainnet",
      challenge,
      types: ["eoa", "program"],
      sources: ["sns", "cal"],
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      `https://nft.api.ledger.com/v2/names/solana/mainnet/reverse/${address}`,
      { params: { types: "eoa,program", sources: "sns,cal", challenge } },
    );
  });

  it("decodes signedDescriptor hex into Uint8Array", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "ff00",
      keyId: "k",
      keyUsage: "u",
    });

    const result = await datasource.getTrustedName({
      address,
      network: "mainnet",
      challenge,
      types: ["eoa"],
      sources: ["sns"],
    });

    expect(result).toEqual(
      Right({
        address,
        descriptor: new Uint8Array([0xff, 0x00]),
        keyId: "k",
        keyUsage: "u",
      }),
    );
  });

  it("returns Left on malformed response", async () => {
    httpMock.get.mockResolvedValue({ keyId: "k", keyUsage: "u" } as any);

    const result = await datasource.getTrustedName({
      address,
      network: "mainnet",
      challenge,
      types: [],
      sources: [],
    });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpSolanaTrustedNameDataSource: malformed response for ${address}:`,
      ),
    );
  });

  it("returns Left when HTTP client throws", async () => {
    httpMock.get.mockRejectedValue(new Error("net"));

    const result = await datasource.getTrustedName({
      address,
      network: "mainnet",
      challenge,
      types: [],
      sources: [],
    });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpSolanaTrustedNameDataSource: Failed to fetch trusted name: net",
        ),
      ),
    );
  });
});

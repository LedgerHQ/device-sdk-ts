/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";

import { HttpSolanaTrustedNameDataSource } from "./HttpTrustedNameDataSource";
import { type SolanaTrustedNameDataSource } from "./TrustedNameDataSource";

describe("HttpSolanaTrustedNameDataSource", () => {
  let datasource: SolanaTrustedNameDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const address = "vitalik.sol";
  const challenge = "deadbeef";

  const makeConfig = (mode: "prod" | "test" = "prod") =>
    ({
      metadataServiceDomain: { url: "https://nft.api.ledger.com" },
      cal: { mode },
    }) as ContextModuleServiceConfig;

  const makeDatasource = (mode: "prod" | "test" = "prod") =>
    new HttpSolanaTrustedNameDataSource(
      makeConfig(mode),
      httpMock as unknown as DmkNetworkClient,
    );

  const objectResponse = (
    signatures: { prod?: string; test?: string },
    data = "ff00",
  ) => ({
    descriptorType: "name",
    descriptorVersion: "2",
    signedDescriptor: { data, signatures },
    keyId: "cal_trusted_name",
    keyUsage: "trusted_name",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = makeDatasource();
  });

  it("calls the names endpoint with network, sources and challenge (no types)", async () => {
    httpMock.get.mockResolvedValue(objectResponse({ prod: "aabb" }));

    await datasource.getTrustedName({
      address,
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
      sources: ["crypto_asset_list"],
    });

    expect(httpMock.get).toHaveBeenCalledWith(
      `https://nft.api.ledger.com/v2/names/solana/${SolanaTransactionScanChainId.MAINNET}/reverse/${address}`,
      {
        params: {
          sources: "crypto_asset_list",
          challenge,
        },
      },
    );
  });

  it("appends the prod signature TLV and decodes into a Uint8Array", async () => {
    httpMock.get.mockResolvedValue(
      objectResponse({ prod: "aabb", test: "cc" }),
    );

    const result = await datasource.getTrustedName({
      address,
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
      sources: ["crypto_asset_list"],
    });

    // data(ff00) + SIGNATURE_TAG(15) + len(02) + sig(aabb)
    expect(result).toEqual(
      Right({
        address,
        descriptor: new Uint8Array([0xff, 0x00, 0x15, 0x02, 0xaa, 0xbb]),
        keyId: "cal_trusted_name",
        keyUsage: "trusted_name",
      }),
    );
  });

  it("selects the test signature when cal.mode is test", async () => {
    datasource = makeDatasource("test");
    httpMock.get.mockResolvedValue(
      objectResponse({ prod: "aabb", test: "cc" }),
    );

    const result = await datasource.getTrustedName({
      address,
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
      sources: ["crypto_asset_list"],
    });

    // data(ff00) + SIGNATURE_TAG(15) + len(01) + sig(cc)
    expect(result).toEqual(
      Right({
        address,
        descriptor: new Uint8Array([0xff, 0x00, 0x15, 0x01, 0xcc]),
        keyId: "cal_trusted_name",
        keyUsage: "trusted_name",
      }),
    );
  });

  it("returns Left when the signature for the active mode is missing", async () => {
    datasource = makeDatasource("prod");
    httpMock.get.mockResolvedValue(objectResponse({ test: "cc" }));

    const result = await datasource.getTrustedName({
      address,
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
      sources: ["crypto_asset_list"],
    });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpSolanaTrustedNameDataSource: missing prod signature for ${address}`,
      ),
    );
  });

  it("returns Left on malformed response (hex-string signedDescriptor)", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "01020304",
      keyId: "k",
      keyUsage: "u",
    } as any);

    const result = await datasource.getTrustedName({
      address,
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
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
      network: String(SolanaTransactionScanChainId.MAINNET),
      challenge,
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

import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { HttpTokenAccountStateDataSource } from "./HttpTokenAccountStateDataSource";
import { type TokenAccountStateDataSource } from "./TokenAccountStateDataSource";

describe("HttpTokenAccountStateDataSource", () => {
  let datasource: TokenAccountStateDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const tokenAccount = "TokenAccountAddrXXXXXXXXXXXXXXXXXXXXXXXXXXX";
  const challenge = "deadbeef";
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: { url: "https://nft.api.ledger.com" },
  } as ContextModuleServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpTokenAccountStateDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls the metadata endpoint with the challenge param", async () => {
    httpMock.get.mockResolvedValue({
      descriptorType: "token_account_state",
      signedDescriptor: "01020304",
      keyId: "tas_key",
      keyUsage: "coin_meta",
    });

    await datasource.getTokenAccountState({ tokenAccount, challenge });

    expect(httpMock.get).toHaveBeenCalledWith(
      `https://nft.api.ledger.com/v2/solana/token-account-state/${tokenAccount}`,
      { params: { challenge } },
    );
  });

  it("decodes signedDescriptor hex into Uint8Array", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "deadbeef",
      keyId: "k",
      keyUsage: "u",
    });

    const result = await datasource.getTokenAccountState({
      tokenAccount,
      challenge,
    });

    expect(result).toEqual(
      Right({
        tokenAccount,
        descriptor: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
        keyId: "k",
        keyUsage: "u",
      }),
    );
  });

  it("returns Left on malformed response (missing signedDescriptor)", async () => {
    httpMock.get.mockResolvedValue({ keyId: "k", keyUsage: "u" });

    const result = await datasource.getTokenAccountState({
      tokenAccount,
      challenge,
    });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpTokenAccountStateDataSource: malformed response for ${tokenAccount}:`,
      ),
    );
  });

  it("returns Left when signedDescriptor is not valid hex", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "ZZZZ",
      keyId: "k",
      keyUsage: "u",
    });

    const result = await datasource.getTokenAccountState({
      tokenAccount,
      challenge,
    });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(/invalid hex/);
  });

  it("returns Left when HTTP client throws", async () => {
    httpMock.get.mockRejectedValue(new Error("net"));

    const result = await datasource.getTokenAccountState({
      tokenAccount,
      challenge,
    });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenAccountStateDataSource: Failed to fetch token account state: net",
        ),
      ),
    );
  });
});

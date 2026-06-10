/* eslint-disable @typescript-eslint/no-explicit-any */
import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { type AltResolutionDataSource } from "./AltResolutionDataSource";
import { HttpAltResolutionDataSource } from "./HttpAltResolutionDataSource";

describe("HttpAltResolutionDataSource", () => {
  let datasource: AltResolutionDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };
  const altAddress = "AltAddress1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  const entryIndex = 3;
  const challenge = "cafebabe";
  const config: ContextModuleServiceConfig = {
    metadataServiceDomain: { url: "https://nft.api.ledger.com" },
  } as ContextModuleServiceConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    httpMock = { get: vi.fn() };
    datasource = new HttpAltResolutionDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("calls the metadata endpoint with the right path and challenge", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "01020304",
      keyId: "alt_key",
      keyUsage: "coin_meta",
    });

    await datasource.getAltResolution({ altAddress, entryIndex, challenge });

    expect(httpMock.get).toHaveBeenCalledWith(
      `https://nft.api.ledger.com/v2/solana/alt-resolution/${altAddress}/${entryIndex}`,
      { params: { challenge } },
    );
  });

  it("decodes signedDescriptor hex into Uint8Array", async () => {
    httpMock.get.mockResolvedValue({
      signedDescriptor: "abcd",
      keyId: "k",
      keyUsage: "u",
    });

    const result = await datasource.getAltResolution({
      altAddress,
      entryIndex,
      challenge,
    });

    expect(result).toEqual(
      Right({
        altAddress,
        entryIndex,
        descriptor: new Uint8Array([0xab, 0xcd]),
        keyId: "k",
        keyUsage: "u",
      }),
    );
  });

  it.each([-1, 256, 1.5, Number.NaN])(
    "rejects entryIndex out of u8 range: %s",
    async (badIndex) => {
      const result = await datasource.getAltResolution({
        altAddress,
        entryIndex: badIndex,
        challenge,
      });
      expect(result.isLeft()).toBe(true);
      expect((result.extract() as Error).message).toMatch(/entryIndex/);
    },
  );

  it("returns Left on malformed response", async () => {
    httpMock.get.mockResolvedValue({ keyId: "k" } as any);

    const result = await datasource.getAltResolution({
      altAddress,
      entryIndex,
      challenge,
    });

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(
      new RegExp(
        String.raw`\[ContextModule\] HttpAltResolutionDataSource: malformed response for \(${altAddress}, ${entryIndex}\):`,
      ),
    );
  });

  it("returns Left when HTTP client throws", async () => {
    httpMock.get.mockRejectedValue(new Error("net"));

    const result = await datasource.getAltResolution({
      altAddress,
      entryIndex,
      challenge,
    });

    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpAltResolutionDataSource: Failed to fetch ALT resolution: net",
        ),
      ),
    );
  });
});

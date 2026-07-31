import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { Left } from "purify-ts";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { HttpTokenDataSource } from "@/modules/ethereum/token/data/HttpTokenDataSource";
import { type TokenDataSource } from "@/modules/ethereum/token/data/TokenDataSource";
import { type TokenDto } from "@/modules/ethereum/token/data/TokenDto";

describe("HttpTokenDataSource", () => {
  let datasource: TokenDataSource;
  let httpMock: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    const config = {
      cal: {
        url: "https://global.api.prd.ledger.com/cal/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleServiceConfig;
    httpMock = { get: vi.fn() };
    datasource = new HttpTokenDataSource(
      config,
      httpMock as unknown as DmkNetworkClient,
    );
  });

  it("should call the expected CAL tokens URL with params", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([]);

    // WHEN
    await datasource.getTokenInfosPayload({ address: "0x00", chainId: 1 });

    // THEN
    expect(httpMock.get).toHaveBeenCalledWith(
      "https://global.api.prd.ledger.com/cal/v1/tokens",
      {
        params: {
          contract_address: "0x00",
          chain_id: 1,
          output: "descriptor",
          ref: "branch:main",
        },
      },
    );
  });

  it("should return a string when response is correct", async () => {
    // GIVEN
    const tokenDTO: TokenDto = {
      ticker: "USDC",
      descriptor: {
        data: "555344433c499c542cef5e3811e1192ce70d8cc03d5c33590000000600000089",
        signatures: {
          prod: "0123",
        },
      },
    };
    httpMock.get.mockResolvedValue([tokenDTO]);

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result.extract()).toEqual(
      "04555344433c499c542cef5e3811e1192ce70d8cc03d5c335900000006000000890123",
    );
  });

  it("should return a string when response is correct with a prefixed ticker", async () => {
    // GIVEN
    const tokenDTO: TokenDto = {
      ticker: "tUSDC",
      descriptor: {
        data: "7474555344431c7d4b196cb0c7b01d743fbc6116a902379c72380000000600aa36a7",
        signatures: {
          prod: "0123",
        },
      },
    };
    httpMock.get.mockResolvedValue([tokenDTO]);

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result.extract()).toEqual(
      "067474555344431c7d4b196cb0c7b01d743fbc6116a902379c72380000000600aa36a70123",
    );
  });

  it("should return an error when data is empty", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue(null);

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for address 0x00 on chain 1",
        ),
      ),
    );
  });

  it("should return undefined when no signature", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([{}]);

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for address 0x00 on chain 1",
        ),
      ),
    );
  });

  it("should return undefined when no decimals", async () => {
    // GIVEN
    httpMock.get.mockResolvedValue([{ live_signature: "0x0", ticker: "USDC" }]);

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: no token metadata for address 0x00 on chain 1",
        ),
      ),
    );
  });

  it("should return an error when network client throws an error", async () => {
    // GIVEN
    httpMock.get.mockRejectedValue(new Error());

    // WHEN
    const result = await datasource.getTokenInfosPayload({
      address: "0x00",
      chainId: 1,
    });

    // THEN
    expect(result).toEqual(
      Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: Failed to fetch token informations",
        ),
      ),
    );
  });
});

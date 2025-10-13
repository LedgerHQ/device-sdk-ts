import axios from "axios";
import { Left } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { HttpTokenDataSource } from "@/token/data/HttpTokenDataSource";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { type TokenDto } from "@/token/data/TokenDto";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpTokenDataSource", () => {
  let datasource: TokenDataSource;

  beforeAll(() => {
    const config = {
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
    } as ContextModuleConfig;
    datasource = new HttpTokenDataSource(config);
    vi.clearAllMocks();
  });

  it("should call axios with the ledger client version header", async () => {
    // GIVEN
    const version = `context-module/${PACKAGE.version}`;
    const requestSpy = vi.fn(() => Promise.resolve({ data: [] }));
    vi.spyOn(axios, "request").mockImplementation(requestSpy);

    // WHEN
    await datasource.getTokenInfosPayload({ address: "0x00", chainId: 1 });

    // THEN
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { [LEDGER_CLIENT_VERSION_HEADER]: version },
      }),
    );
  });

  it("should return a string when axios response is correct", async () => {
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
    vi.spyOn(axios, "request").mockResolvedValue({ data: [tokenDTO] });

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

  it("should return a string when axios response is correct with a prefixed ticker", async () => {
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
    vi.spyOn(axios, "request").mockResolvedValue({ data: [tokenDTO] });

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
    vi.spyOn(axios, "request").mockResolvedValue({ data: undefined });

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
    vi.spyOn(axios, "request").mockResolvedValue({ data: [{}] });

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
    vi.spyOn(axios, "request").mockResolvedValue({
      data: [{ live_signature: "0x0", ticker: "USDC" }],
    });

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

  it("should return an error when axios throws an error", async () => {
    // GIVEN
    vi.spyOn(axios, "request").mockRejectedValue(new Error());

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

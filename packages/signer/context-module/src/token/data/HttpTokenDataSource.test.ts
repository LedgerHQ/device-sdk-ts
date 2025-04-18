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
        data: "55534443000000000800000001",
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
    expect(result.extract()).toEqual("04555344430000000008000000010123");
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

  it("should return undefined when no ticker", async () => {
    // GIVEN
    const tokenDTO: TokenDto = {
      ticker: "USDC",
      descriptor: {
        data: "55534443000000000800000001",
        signatures: {
          test: "0123",
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

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkClientFactory } from "@/network/networkClientFactory";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

describe("networkClientFactory", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const getRequestHeaders = () => {
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit).toBeDefined();

    return requestInit?.headers as Record<string, string>;
  };

  it("should set the context-module client version header", async () => {
    // GIVEN
    const config = {} as ContextModuleServiceConfig;
    const client = networkClientFactory(config);

    // WHEN
    await client.get("https://example.test", { responseType: "void" });

    // THEN
    expect(getRequestHeaders()).toMatchObject({
      [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
    });
  });

  it("should set the origin token header when configured", async () => {
    // GIVEN
    const config = {
      originToken: "origin-token",
    } as ContextModuleServiceConfig;
    const client = networkClientFactory(config);

    // WHEN
    await client.get("https://example.test", { responseType: "void" });

    // THEN
    expect(getRequestHeaders()).toMatchObject({
      [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
    });
  });

  it("should not set the origin token header when it is missing", async () => {
    // GIVEN
    const config = {} as ContextModuleServiceConfig;
    const client = networkClientFactory(config);

    // WHEN
    await client.get("https://example.test", { responseType: "void" });

    // THEN
    expect(getRequestHeaders()).not.toHaveProperty(LEDGER_ORIGIN_TOKEN_HEADER);
  });
});

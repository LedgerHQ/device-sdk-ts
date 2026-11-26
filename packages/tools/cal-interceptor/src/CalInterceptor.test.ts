import { MemoryStorage } from "./storage/MemoryStorage";
import { CalInterceptor } from "./CalInterceptor";

const SIGNER_URL = "http://127.0.0.1:5328";
const OWNER_PATH =
  "/v2/solana/owner/2fEYPArTb3s8qq14gx3WuM9eQ1nJzK1EG6jVzyxFxJg6?challenge=12345678";
const METADATA_URL = `https://nft.api.live.ledger.com${OWNER_PATH}`;
const PROXY_PATH = `/api/dynamic-descriptor-proxy${OWNER_PATH}`;
const DELEGATE_PATH = "/v2/ethereum/1/contract/proxy/delegate";
const CAL_URL = "https://global.api.prd.ledger.com/cal/v1";

describe("CalInterceptor", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let interceptor: CalInterceptor | undefined;

  const startInterceptor = (
    ...args: ConstructorParameters<typeof CalInterceptor>
  ): CalInterceptor => {
    interceptor = new CalInterceptor(...args);
    interceptor.start();
    return interceptor;
  };

  const requestedUrls = (): string[] =>
    fetchMock.mock.calls.map(([input]) => String(input));

  beforeEach(() => {
    fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response("upstream", { status: 200 })),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    interceptor?.stop();
    interceptor = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("metadata-service requests", () => {
    it("should fetch a GET through the configured signer outside a browser", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([`${SIGNER_URL}${PROXY_PATH}`]);
    });

    it("should accept a signer URL with a trailing slash", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: `${SIGNER_URL}/` });

      // WHEN
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([`${SIGNER_URL}${PROXY_PATH}`]);
    });

    it("should fall back to the page origin in a browser", async () => {
      // GIVEN
      vi.stubGlobal("location", { origin: "http://localhost:3000" });
      startInterceptor(new MemoryStorage());

      // WHEN
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([`http://localhost:3000${PROXY_PATH}`]);
    });

    it("should prefer the configured signer to the page origin", async () => {
      // GIVEN
      vi.stubGlobal("location", { origin: "http://localhost:3000" });
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([`${SIGNER_URL}${PROXY_PATH}`]);
    });

    it("should pass the request through and warn once when there is no signer", async () => {
      // GIVEN
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      startInterceptor();

      // WHEN
      const response = await fetch(METADATA_URL);
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([METADATA_URL, METADATA_URL]);
      expect(await response.text()).toBe("upstream");
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it.each([
      [200, '{"signedDescriptor":"0101"}'],
      [404, '{"error":"not found"}'],
      [502, '{"error":"Failed to fetch from metadata service."}'],
    ])(
      "should serve the proxy's %s status and body as they are",
      async (status, body) => {
        // GIVEN
        fetchMock.mockResolvedValueOnce(new Response(body, { status }));
        startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

        // WHEN
        const response = await fetch(METADATA_URL);

        // THEN
        expect(response.status).toBe(status);
        expect(await response.text()).toBe(body);
      },
    );

    it("should forward the caller's headers and abort signal to the proxy", async () => {
      // GIVEN
      const init: RequestInit = {
        headers: { "X-Ledger-Client-Version": "context-module/test" },
        signal: new AbortController().signal,
      };
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(METADATA_URL, init);

      // THEN
      expect(fetchMock).toHaveBeenCalledWith(
        `${SIGNER_URL}${PROXY_PATH}`,
        init,
      );
    });

    it("should leave a HEAD untouched", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      const response = await fetch(METADATA_URL, { method: "HEAD" });

      // THEN
      expect(fetchMock).toHaveBeenCalledWith(METADATA_URL, { method: "HEAD" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await response.text()).toBe("upstream");
    });

    it("should leave a HEAD Request untouched", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });
      const request = new Request(METADATA_URL, { method: "HEAD" });

      // WHEN
      await fetch(request);

      // THEN
      expect(fetchMock).toHaveBeenCalledWith(request, undefined);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should fetch a GET Request through the signer", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(new Request(METADATA_URL));

      // THEN
      expect(requestedUrls()).toEqual([`${SIGNER_URL}${PROXY_PATH}`]);
    });

    // The proxy delegate descriptor is checked under a replaced key too.
    it("should fetch a POST through the signer, body included", async () => {
      // GIVEN
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"proxy":"0x01"}',
      };
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(`https://nft.api.live.ledger.com${DELEGATE_PATH}`, init);

      // THEN
      expect(fetchMock).toHaveBeenCalledWith(
        `${SIGNER_URL}/api/dynamic-descriptor-proxy${DELEGATE_PATH}`,
        init,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should keep the method and body of a POST Request", async () => {
      // GIVEN
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(
        new Request(`https://nft.api.live.ledger.com${DELEGATE_PATH}`, {
          method: "POST",
          body: '{"proxy":"0x01"}',
        }),
      );

      // THEN
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(
        `${SIGNER_URL}/api/dynamic-descriptor-proxy${DELEGATE_PATH}`,
      );
      expect(init?.method).toBe("POST");
      expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe(
        '{"proxy":"0x01"}',
      );
    });

    it("should leave other methods untouched", async () => {
      // GIVEN
      const init: RequestInit = { method: "PUT", body: "{}" };
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      await fetch(METADATA_URL, init);

      // THEN
      expect(fetchMock).toHaveBeenCalledWith(METADATA_URL, init);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should leave other hosts untouched", async () => {
      // GIVEN
      const urls = [
        `https://example.com${OWNER_PATH}`,
        `${CAL_URL}/tokens?ref=branch:next`,
      ];
      startInterceptor({ dynamicDescriptorProxyBaseUrl: SIGNER_URL });

      // WHEN
      for (const url of urls) {
        await fetch(url);
      }

      // THEN
      expect(requestedUrls()).toEqual(urls);
    });

    it("should route the configured metadata-service host", async () => {
      // GIVEN
      startInterceptor({
        dynamicDescriptorProxyBaseUrl: SIGNER_URL,
        metadataServiceHost: "metadata.test",
      });

      // WHEN
      await fetch(`https://metadata.test${OWNER_PATH}`);
      await fetch(METADATA_URL);

      // THEN
      expect(requestedUrls()).toEqual([
        `${SIGNER_URL}${PROXY_PATH}`,
        METADATA_URL,
      ]);
    });

    it("should not redirect the proxy call again", async () => {
      // GIVEN the signer runs on the metadata-service host
      startInterceptor({
        dynamicDescriptorProxyBaseUrl: SIGNER_URL,
        metadataServiceHost: "127.0.0.1:5328",
      });

      // WHEN
      await fetch(`${SIGNER_URL}${OWNER_PATH}`);

      // THEN
      expect(requestedUrls()).toEqual([`${SIGNER_URL}${PROXY_PATH}`]);
    });
  });

  describe("CAL requests", () => {
    it("should serve a stored dapps descriptor as a 200", async () => {
      // GIVEN
      const descriptor = { "0x12345678": { data: "0102", signatures: {} } };
      const calInterceptor = startInterceptor();
      calInterceptor.storeDescriptor(1, "0xAbC", [
        { descriptors_calldata: descriptor },
      ]);

      // WHEN
      const response = await fetch(
        `${CAL_URL}/dapps?output=descriptors_calldata&chain_id=1&contracts=0xabc&ref=branch:main`,
      );

      // THEN
      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(await response.json()).toEqual([
        { descriptors_calldata: descriptor },
      ]);
    });

    it("should serve a stored certificate as a 200", async () => {
      // GIVEN
      const certificate = [{ descriptor: { data: "0103", signatures: {} } }];
      const calInterceptor = startInterceptor({
        dynamicDescriptorProxyBaseUrl: SIGNER_URL,
      });
      calInterceptor.storeCertificates({
        "flex:domain_metadata_key:trusted_name": certificate,
      });

      // WHEN
      const response = await fetch(
        `${CAL_URL}/certificates?output=descriptor&target_device=flex&public_key_id=domain_metadata_key&public_key_usage=trusted_name`,
      );

      // THEN
      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(await response.json()).toEqual(certificate);
    });

    it("should pass a CAL request through when nothing is stored for it", async () => {
      // GIVEN
      const url = `${CAL_URL}/dapps?output=descriptors_calldata&chain_id=1&contracts=0xdef`;
      const calInterceptor = startInterceptor();
      calInterceptor.storeDescriptor(1, "0xabc", [
        { descriptors_calldata: {} },
      ]);

      // WHEN
      await fetch(url);

      // THEN
      expect(requestedUrls()).toEqual([url]);
    });
  });
});

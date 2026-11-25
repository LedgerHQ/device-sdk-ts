import { FetchInterceptor, type InterceptRequest } from "./AxiosInterceptor";

describe("FetchInterceptor", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let interceptRequest: ReturnType<typeof vi.fn<InterceptRequest>>;
  let interceptor: FetchInterceptor;

  beforeEach(() => {
    fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response("upstream", { status: 200 })),
      );
    vi.stubGlobal("fetch", fetchMock);
    interceptRequest = vi.fn<InterceptRequest>().mockReturnValue(null);
    interceptor = new FetchInterceptor(interceptRequest);
    interceptor.start();
  });

  afterEach(() => {
    interceptor.stop();
    vi.unstubAllGlobals();
  });

  it("should default the method to GET", async () => {
    // WHEN
    await fetch("https://example.test/path?query=1");

    // THEN
    expect(interceptRequest).toHaveBeenCalledWith({
      url: "https://example.test/path?query=1",
      method: "GET",
      init: undefined,
    });
  });

  it("should read the method and init of a string or URL input", async () => {
    // GIVEN
    const init: RequestInit = { method: "head", headers: { "X-Test": "1" } };

    // WHEN
    await fetch(new URL("https://example.test/path"), init);

    // THEN
    expect(interceptRequest).toHaveBeenCalledWith({
      url: "https://example.test/path",
      method: "HEAD",
      init,
    });
  });

  it("should read the method, headers, body and signal of a Request input", async () => {
    // GIVEN
    const controller = new AbortController();
    const request = new Request("https://example.test/path", {
      method: "POST",
      headers: { "X-Test": "1" },
      body: "{}",
      signal: controller.signal,
    });

    // WHEN
    await fetch(request);

    // THEN
    const [intercepted] = interceptRequest.mock.calls[0]!;
    expect(intercepted.url).toBe("https://example.test/path");
    expect(intercepted.method).toBe("POST");
    expect(intercepted.init?.method).toBe("POST");
    expect(intercepted.init?.headers).toBe(request.headers);
    expect(intercepted.init?.signal).toBe(request.signal);
    expect(
      new TextDecoder().decode(intercepted.init?.body as ArrayBuffer),
    ).toBe("{}");
  });

  // The body is read from a clone, so the original fetch can still send it.
  it("should leave the body of a Request input readable when it isn't intercepted", async () => {
    // GIVEN
    const request = new Request("https://example.test/path", {
      method: "POST",
      body: "{}",
    });

    // WHEN
    await fetch(request);

    // THEN
    const [sent] = fetchMock.mock.calls[0]!;
    expect(sent).toBe(request);
    expect(await (sent as Request).text()).toBe("{}");
  });

  it("should let the init method override the method of a Request input", async () => {
    // WHEN
    await fetch(new Request("https://example.test/path"), { method: "HEAD" });

    // THEN
    expect(interceptRequest.mock.calls[0]![0].method).toBe("HEAD");
  });

  it("should call the original fetch with the same arguments when the request isn't intercepted", async () => {
    // GIVEN
    const init: RequestInit = { method: "POST", body: "{}" };

    // WHEN
    const response = await fetch("https://example.test/path", init);

    // THEN
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/path", init);
    expect(await response.text()).toBe("upstream");
  });

  it("should serve the intercepted response with its own status", async () => {
    // GIVEN
    interceptRequest.mockResolvedValue(
      new Response("unavailable", { status: 503 }),
    );

    // WHEN
    const response = await fetch("https://example.test/path");

    // THEN
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("unavailable");
  });

  it("should restore the original fetch on stop", () => {
    // WHEN
    interceptor.stop();

    // THEN
    expect(globalThis.fetch).toBe(fetchMock);
    expect(interceptor.isIntercepting()).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpSpeculosDatasource } from "./HttpSpeculosDatasource";

const TOKEN = "session-token";
const AUTHORIZATION = { Authorization: `Bearer ${TOKEN}` };

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpSpeculosDatasource", () => {
  it("sends only the client header by default", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: "9000" }));

    await new HttpSpeculosDatasource("http://speculos/", "client").postApdu(
      "b001000000",
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://speculos/apdu",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Ledger-Client-Version": "client",
        }),
      }),
    );
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.headers).not.toHaveProperty("Authorization");
  });

  it("sends the bearer token with APDUs", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: "9000" }));

    const response = await new HttpSpeculosDatasource(
      "http://speculos",
      "client",
      TOKEN,
    ).postApdu("b001000000");

    expect(response).toBe("9000");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://speculos/apdu",
      expect.objectContaining({
        headers: expect.objectContaining({
          ...AUTHORIZATION,
          "X-Ledger-Client-Version": "client",
        }),
      }),
    );
  });

  it("sends the bearer token with the availability check", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null));

    const available = await new HttpSpeculosDatasource(
      "http://speculos",
      "client",
      TOKEN,
    ).isServerAvailable();

    expect(available).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://speculos/events",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining(AUTHORIZATION),
      }),
    );
  });

  it("sends the bearer token with the event stream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('data: {"text":"Ready"}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const onEvent = vi.fn();

    await new Promise<void>((resolve, reject) => {
      new HttpSpeculosDatasource("http://speculos", "client", TOKEN)
        .openEventStream(onEvent, resolve)
        .catch(reject);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://speculos/events?stream=true",
      expect.objectContaining({
        headers: {
          ...AUTHORIZATION,
          "X-Ledger-Client-Version": "client",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }),
    );
    expect(onEvent).toHaveBeenCalledWith({ text: "Ready" });
  });
});

import { type Server } from "node:http";
import { type AddressInfo } from "node:net";

import { afterEach, beforeEach, vi } from "vitest";

import { createMockServer } from "@api/createMockServer";

/**
 * Exercises the Speculos-over-HTTP path end to end: an Open App APDU provisions
 * an emulator, APDUs are forwarded while the proxy is active, the raw
 * passthrough relays emulator responses and Close App releases it. `fetch` is
 * mocked to stand in for Speculinho + the emulator (the live path is covered by
 * the Playwright e2e suite).
 */
const EMULATOR_URL = "https://emulator.test";

// e0 d8 00 00 07 "Bitcoin" — Open App(Bitcoin)
const OPEN_BITCOIN = "e0d8000007426974636f696e";
const CLOSE_APP = "b0a7000000";

const fakeResponse = (
  body: unknown,
  init: { ok?: boolean; status?: number; contentType?: string } = {},
): Response =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: () => init.contentType ?? "application/json" },
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  }) as unknown as Response;

let server: Server;
let close: () => void;
let baseUrl: string;
let fetchMock: ReturnType<typeof vi.fn>;

const route = (url: string, init?: RequestInit): Response => {
  if (url.endsWith("/acquire")) return fakeResponse({ status: "pending" });
  if (url.includes("/status/")) {
    return fakeResponse({
      run_id: "run-1",
      status: "ready",
      speculos_url: EMULATOR_URL,
    });
  }
  if (url.endsWith("/release")) return fakeResponse({});
  if (url === `${EMULATOR_URL}/apdu`) return fakeResponse({ data: "ff9000" });
  // Raw passthrough (e.g. screenshot).
  if (url.startsWith(`${EMULATOR_URL}/`)) {
    return fakeResponse("PNG-BYTES", { contentType: "image/png" });
  }
  throw new Error(`unexpected fetch: ${init?.method ?? "GET"} ${url}`);
};

const api = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

const setupSession = async () => {
  const token = (
    (await (await api("/auth", { method: "POST" })).json()) as { token: string }
  ).token;
  const device = (await (
    await api(
      "/devices",
      {
        method: "POST",
        body: JSON.stringify({
          device_type: "nanoX",
          firmware_version: "1.3.0",
          apps: [{ name: "Bitcoin", version: "2.1.0" }],
        }),
      },
      token,
    )
  ).json()) as { id: string };
  return { token, id: device.id };
};

const sendApdu = (token: string, id: string, apdu: string) =>
  api(
    `/devices/${id}/apdu`,
    { method: "POST", body: JSON.stringify({ apdu }) },
    token,
  );

beforeEach(async () => {
  fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(route(String(url), init)),
  );
  // Only intercept calls to Speculinho/emulator; let the real loopback HTTP
  // (the test client hitting the server) go through the original fetch.
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(((
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    if (
      url.startsWith("http://127.0.0.1") ||
      url.startsWith("http://localhost")
    ) {
      return realFetch(input, init);
    }
    return fetchMock(input, init) as Promise<Response>;
  }) as typeof fetch);

  const built = createMockServer({
    speculos: {
      baseUrl: "https://speculinho.test",
      pollIntervalMs: 0,
      readyTimeoutMs: 1000,
    },
  });
  close = built.close;
  await new Promise<void>((resolve) => {
    server = built.app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  close();
  server.close();
  vi.restoreAllMocks();
});

describe("createMockServer + Speculos (HTTP contract)", () => {
  it("provisions, forwards, proxies and releases an emulator across its lifecycle", async () => {
    const { token, id } = await setupSession();

    // Before opening: no instance.
    expect((await api(`/devices/${id}/speculos`, {}, token)).status).toBe(409);

    // Open App -> acquire + wait ready -> 9000, proxy now active.
    const opened = (await (await sendApdu(token, id, OPEN_BITCOIN)).json()) as {
      response: string;
    };
    expect(opened.response).toBe("9000");

    const instance = await api(`/devices/${id}/speculos`, {}, token);
    expect(instance.status).toBe(200);
    expect((await instance.json()) as Record<string, unknown>).toMatchObject({
      speculos_url: EMULATOR_URL,
    });

    // APDUs are now forwarded to the emulator.
    const forwarded = (await (
      await sendApdu(token, id, "b001000000")
    ).json()) as { response: string };
    expect(forwarded.response).toBe("ff9000");

    // Raw passthrough relays the emulator response verbatim.
    const screenshot = await api(
      `/devices/${id}/speculos/screenshot`,
      {},
      token,
    );
    expect(screenshot.status).toBe(200);
    expect(screenshot.headers.get("content-type")).toMatch(/^image\/png/);
    expect(await screenshot.text()).toBe("PNG-BYTES");

    // Close App releases the emulator and reverts to mock mode.
    const closed = (await (await sendApdu(token, id, CLOSE_APP)).json()) as {
      response: string;
    };
    expect(closed.response).toBe("9000");
    expect((await api(`/devices/${id}/speculos`, {}, token)).status).toBe(409);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://speculinho.test/release",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects opening an app the device does not have installed", async () => {
    const { token, id } = await setupSession();
    // e0 d8 00 00 08 "Ethereum"
    const openEth = "e0d8000008457468657265756d";
    const res = await sendApdu(token, id, openEth);
    // Not installed -> 6807, and no acquire attempted.
    expect(((await res.json()) as { response: string }).response).toBe("6807");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

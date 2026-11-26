import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoggerPublisherService } from "@root/src/services/LoggerPublisherService";

import { CalInterceptorService } from "./CalInterceptorService";

const SIGNER_URL = "http://127.0.0.1:5328";

const CERTIFICATES = {
  "flex:cal_calldata_key:coin_meta": {
    descriptor: { data: "01", signatures: { prod: "02" } },
  },
};

describe("CalInterceptorService", () => {
  const signer = vi.fn<typeof fetch>();
  let service: CalInterceptorService;

  /**
   * Answer like a signer: `info` on /api/signer-info, `certificates` on any
   * other route.
   */
  const serveSigner = ({
    certificates,
    info = () => Response.json({ resigningProxyVersion: 2 }),
  }: {
    certificates: () => Response;
    info?: () => Response;
  }): void => {
    signer.mockImplementation((input) =>
      Promise.resolve(
        String(input).endsWith("/api/signer-info") ? info() : certificates(),
      ),
    );
  };

  beforeEach(() => {
    signer.mockReset();
    vi.stubGlobal("fetch", signer);
    // The interceptor narrates every step on the console.
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    service = new CalInterceptorService(
      new LoggerPublisherService([], "test"),
      SIGNER_URL,
    );
  });

  afterEach(() => {
    service.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("checks the signer, loads its certificates and intercepts fetch until stopped", async () => {
    serveSigner({ certificates: () => Response.json(CERTIFICATES) });

    await service.start([]);

    const [, infoInit] = signer.mock.calls.find(
      ([input]) => String(input) === `${SIGNER_URL}/api/signer-info`,
    )!;
    expect(infoInit?.signal).toBeInstanceOf(AbortSignal);
    expect(signer).toHaveBeenCalledWith(`${SIGNER_URL}/api/certificates`);
    expect(globalThis.fetch).not.toBe(signer);
    service.stop();
    expect(globalThis.fetch).toBe(signer);
  });

  // Otherwise every case would fail on the device with 5720, one emulator at
  // a time.
  it("fails the run at startup when the signer cannot serve certificates", async () => {
    serveSigner({
      certificates: () => new Response("down", { status: 502 }),
    });

    await expect(service.start([])).rejects.toThrow(
      `Could not load the CAL test certificates from ${SIGNER_URL}: ` +
        "Failed to fetch certificates: HTTP 502",
    );
    expect(globalThis.fetch).toBe(signer);
  });

  it("fails the run at startup when the signer is unreachable", async () => {
    signer.mockRejectedValue(new TypeError("fetch failed"));

    await expect(service.start([])).rejects.toThrow(
      `Could not reach the CAL signer at ${SIGNER_URL}: fetch failed`,
    );
  });

  it("fails the run at startup when the signer serves no certificate", async () => {
    serveSigner({ certificates: () => Response.json({}) });

    await expect(service.start([])).rejects.toThrow(
      `The signer at ${SIGNER_URL} returned no CAL test certificates.`,
    );
    expect(globalThis.fetch).toBe(signer);
  });

  // An older proxy re-signs descriptors checked under unreplaced keys, so
  // cases would fail on the device instead.
  it.each([
    ["predates /api/signer-info", () => new Response("", { status: 404 })],
    [
      "runs an older re-signing proxy",
      () => Response.json({ resigningProxyVersion: 1 }),
    ],
  ])("refuses a signer that %s", async (_, info) => {
    serveSigner({ certificates: () => Response.json(CERTIFICATES), info });

    await expect(service.start([])).rejects.toThrow(
      `The CAL signer at ${SIGNER_URL} is too old for this tester`,
    );
    expect(signer).not.toHaveBeenCalledWith(`${SIGNER_URL}/api/certificates`);
    expect(globalThis.fetch).toBe(signer);
  });

  // The check runs before any emulator, so no scenario timeout would end it.
  it("fails the run at startup when the signer stalls on its version", async () => {
    const timeout = new DOMException(
      "The operation was aborted due to timeout",
      "TimeoutError",
    );
    serveSigner({
      certificates: () => Response.json(CERTIFICATES),
      // Headers sent, then the body times out
      info: () =>
        new Response(
          new ReadableStream({
            start: (controller) => controller.error(timeout),
          }),
        ),
    });

    await expect(service.start([])).rejects.toThrow(
      `Could not reach the CAL signer at ${SIGNER_URL}: ` +
        "The operation was aborted due to timeout",
    );
    expect(signer).not.toHaveBeenCalledWith(`${SIGNER_URL}/api/certificates`);
  });

  it("fails the run at startup when the signer cannot say its version", async () => {
    serveSigner({
      certificates: () => Response.json(CERTIFICATES),
      info: () => new Response("down", { status: 503 }),
    });

    await expect(service.start([])).rejects.toThrow(
      `The CAL signer at ${SIGNER_URL} answered GET /api/signer-info with HTTP 503.`,
    );
  });
});

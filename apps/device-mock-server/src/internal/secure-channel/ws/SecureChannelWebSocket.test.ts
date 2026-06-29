import { type Server } from "node:http";
import { type AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import { createMockServer } from "@api/createMockServer";
import { INSTALL_BLOCK_APDUS } from "@internal/secure-channel/service/secureChannelApdus";

/**
 * Drives the mock ScriptRunner WebSocket end to end: a client plays DMK's role,
 * relaying each `exchange` APDU through the HTTP `/apdu` resolver (so the derived
 * handshake and explicit mocks are exercised) and replying on the socket.
 */

let server: Server;
let close: () => void;
let baseUrl: string;
let wsBase: string;

const api = (path: string, init: RequestInit = {}, token?: string) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

const setupSession = async (
  apps?: { name: string; version: string }[],
  catalog?: { hash: string; name: string; version: string }[],
) => {
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
          firmware_version: "2.2.3",
          ...(apps ? { apps } : {}),
          ...(catalog ? { catalog } : {}),
        }),
      },
      token,
    )
  ).json()) as { id: string };
  await api(`/devices/${device.id}/connect`, { method: "POST" }, token);
  return { token, id: device.id };
};

/** Create a session with no device attached. */
const authOnly = async (): Promise<string> =>
  ((await (await api("/auth", { method: "POST" })).json()) as { token: string })
    .token;

const addMock = (token: string, id: string, prefix: string, response: string) =>
  api(
    `/devices/${id}/mocks`,
    { method: "POST", body: JSON.stringify({ prefix, response }) },
    token,
  );

interface Terminal {
  type: "success" | "bulk" | "error" | "closed";
  result?: unknown;
  data?: unknown;
  /** For a bulk error: how many APDUs succeeded before the failing one. */
  processed?: number;
}

/** Connect to an endpoint and play the device side until a terminal message. */
const drive = (
  token: string,
  id: string,
  endpoint: string,
): Promise<Terminal> =>
  new Promise<Terminal>((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/secure-channel/${token}/${endpoint}`);
    let settled = false;
    const settle = (terminal: Terminal) => {
      if (settled) return;
      settled = true;
      resolve(terminal);
      ws.close();
    };

    ws.on("message", (raw) => {
      void (async () => {
        const msg = JSON.parse(raw.toString()) as {
          query: string;
          nonce: number;
          result?: unknown;
          data?: unknown;
        };
        if (msg.query === "exchange") {
          const apdu = String(msg.data);
          const { response } = (await (
            await api(
              `/devices/${id}/apdu`,
              { method: "POST", body: JSON.stringify({ apdu }) },
              token,
            )
          ).json()) as { response: string };
          const sw = response.slice(-4);
          ws.send(
            JSON.stringify({
              nonce: msg.nonce,
              response: sw === "9000" ? "success" : "error",
              data: response.slice(0, -4),
            }),
          );
        } else if (msg.query === "success") {
          settle({ type: "success", result: msg.result, data: msg.data });
        } else if (msg.query === "bulk") {
          // Mimic the DMK client's bulk handling: send each APDU to the device
          // and stop on the first error status.
          const apdus = msg.data as string[];
          let processed = 0;
          for (const apdu of apdus) {
            const { response } = (await (
              await api(
                `/devices/${id}/apdu`,
                { method: "POST", body: JSON.stringify({ apdu }) },
                token,
              )
            ).json()) as { response: string };
            if (response.slice(-4) !== "9000") {
              settle({ type: "error", data: response.slice(-4), processed });
              return;
            }
            processed += 1;
          }
          settle({ type: "bulk", data: processed });
        } else if (msg.query === "error") {
          settle({ type: "error", data: msg.data });
        }
      })().catch(reject);
    });
    ws.on("close", () => settle({ type: "closed" }));
    ws.on("error", reject);
  });

beforeEach(async () => {
  const built = createMockServer();
  close = built.close;
  await new Promise<void>((resolve) => {
    server = built.app.listen(0, resolve);
  });
  built.attachWebSocket(server);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
});

afterEach(() => {
  close();
  server.close();
});

describe("secure channel WebSocket", () => {
  it("genuine check completes with the genuine result 0000", async () => {
    const { token, id } = await setupSession();
    const terminal = await drive(token, id, "genuine");
    expect(terminal).toMatchObject({ type: "success", result: "0000" });
  });

  it("genuine check reports a non-genuine verdict when the device mocks it", async () => {
    const { token, id } = await setupSession();
    // The genuine verdict APDU (e0f1) replies with data 0001 instead of 0000.
    await addMock(token, id, "e0f1", "00019000");
    const terminal = await drive(token, id, "genuine");
    expect(terminal).toMatchObject({ type: "success", result: "0001" });
  });

  it("apps/list returns the installed apps derived from device metadata", async () => {
    const { token, id } = await setupSession([
      { name: "Bitcoin", version: "2.1.0" },
      { name: "Ethereum", version: "1.10.0" },
    ]);
    const terminal = await drive(token, id, "apps/list");
    expect(terminal.type).toBe("success");
    expect(terminal.data).toEqual([
      { flags: 0, hash: "", hash_code_data: "", name: "Bitcoin" },
      { flags: 0, hash: "", hash_code_data: "", name: "Ethereum" },
    ]);
  });

  it("install streams the bulk install APDUs and completes", async () => {
    const { token, id } = await setupSession();
    const terminal = await drive(token, id, "install");
    expect(terminal.type).toBe("bulk");
    expect(terminal.data).toBe(INSTALL_BLOCK_APDUS.length);
  });

  it("install fails on an out-of-memory device error", async () => {
    const { token, id } = await setupSession();
    await addMock(token, id, "e0f0", "6a84");
    const terminal = await drive(token, id, "install");
    expect(terminal).toMatchObject({ type: "error", data: "6a84" });
  });

  it("install fails when the app is already installed", async () => {
    const { token, id } = await setupSession();
    await addMock(token, id, "e0f0", "6a80");
    const terminal = await drive(token, id, "install");
    expect(terminal).toMatchObject({ type: "error", data: "6a80" });
  });

  it("install fails on the 5th bulk APDU while the first four succeed", async () => {
    const { token, id } = await setupSession();
    // Target only the 5th install block (its distinct P1 = 04) so the first
    // four blocks still derive to success and the stream fails midway.
    await addMock(token, id, "e0f00400", "6a84");
    const terminal = await drive(token, id, "install");
    expect(terminal).toMatchObject({
      type: "error",
      data: "6a84",
      processed: 4,
    });
  });
});

/**
 * The install flow adds the installed app to the device context the way a real
 * device does: the app is armed from the install hash, then committed into the
 * device's installed apps once the final install block is acknowledged. The
 * post-install `apps/list` then reports it (DMK confirms the install by name).
 */
describe("secure channel WebSocket: install commits the app to the device context", () => {
  const BOLOS = [{ name: "BOLOS", version: "1.5.0" }];
  const BTC = { hash: "abc123", name: "Bitcoin", version: "2.1.0" };

  it("adds the installed app so the post-install list reports it", async () => {
    const { token, id } = await setupSession(BOLOS, [BTC]);

    // Before install, Bitcoin is not in the device context.
    const before = await drive(token, id, "apps/list");
    expect(before.data).toEqual([]);

    // Install resolves the hash to Bitcoin and streams the bulk to success.
    const install = await drive(token, id, `install?hash=${BTC.hash}`);
    expect(install.type).toBe("bulk");

    // The device context now reflects Bitcoin, with its install hash.
    const after = await drive(token, id, "apps/list");
    expect(after.data).toEqual([
      { flags: 0, hash: BTC.hash, hash_code_data: "", name: "Bitcoin" },
    ]);
  });

  it("does not add the app when the install fails on a device error", async () => {
    const { token, id } = await setupSession(BOLOS, [BTC]);
    // Out-of-memory on the install blocks: the commit block is never acked.
    await addMock(token, id, "e0f0", "6a84");

    const install = await drive(token, id, `install?hash=${BTC.hash}`);
    expect(install).toMatchObject({ type: "error", data: "6a84" });

    const after = await drive(token, id, "apps/list");
    expect(after.data).toEqual([]);
  });
});

/**
 * Error paths shared by the device-action secure-channel flows. Both genuine
 * check and install run the same `e051`/`e052` handshake, so a device error on
 * either APDU makes the client report `error` and the server stop the session
 * (the socket closes without a terminal success/result). The status words mirror
 * those `ConnectToSecureChannelTask.mapDeviceError` recognises.
 */
describe("secure channel WebSocket: handshake error paths", () => {
  const HANDSHAKE_ERRORS: { name: string; prefix: string; sw: string }[] = [
    { name: "permission refused by the user", prefix: "e051", sw: "5501" },
    { name: "permission refused (6985)", prefix: "e051", sw: "6985" },
    { name: "device locked", prefix: "e051", sw: "5515" },
    { name: "device locked (6982)", prefix: "e051", sw: "6982" },
    { name: "get certificate failure", prefix: "e052", sw: "6d00" },
  ];

  for (const flow of ["genuine", "install"] as const) {
    describe(flow, () => {
      for (const { name, prefix, sw } of HANDSHAKE_ERRORS) {
        it(`stops without success on ${name}`, async () => {
          const { token, id } = await setupSession();
          await addMock(token, id, prefix, sw);
          const terminal = await drive(token, id, flow);
          expect(terminal.type).toBe("closed");
          expect(terminal.type).not.toBe("success");
        });
      }
    });
  }
});

/** Connection-level errors handled before any handshake APDU is relayed. */
describe("secure channel WebSocket: connection error paths", () => {
  it("rejects an unknown session token with an error message", async () => {
    const terminal = await drive("not-a-real-token", "x", "genuine");
    expect(terminal.type).toBe("error");
  });

  it("rejects a session that has no device", async () => {
    const token = await authOnly();
    const terminal = await drive(token, "x", "genuine");
    expect(terminal.type).toBe("error");
  });

  it("rejects an unknown secure-channel endpoint", async () => {
    const { token } = await setupSession();
    const outcome = await new Promise<"error" | "closed">((resolve) => {
      const ws = new WebSocket(`${wsBase}/secure-channel/${token}/bogus`);
      ws.on("error", () => resolve("error"));
      ws.on("close", () => resolve("closed"));
    });
    expect(["error", "closed"]).toContain(outcome);
  });

  it("survives a client disconnecting mid-handshake", async () => {
    const first = await setupSession();
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(
        `${wsBase}/secure-channel/${first.token}/genuine`,
      );
      // Drop the connection on the first exchange instead of replying.
      ws.on("message", () => ws.terminate());
      ws.on("close", () => resolve());
    });

    // The server is still healthy: a fresh session completes normally.
    const second = await setupSession();
    const terminal = await drive(second.token, second.id, "genuine");
    expect(terminal).toMatchObject({ type: "success", result: "0000" });
  });
});

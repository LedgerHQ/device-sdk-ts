import { type Server } from "node:http";
import { type AddressInfo } from "node:net";

import { afterEach, beforeEach } from "vitest";

import { createMockServer } from "@api/createMockServer";
import { type MockServerConfig } from "@api/model/MockServerConfig";

/**
 * Drives the fully-assembled server over real HTTP. This is the contract gate
 * for the transport layer: routes, the bearer-auth middleware, request
 * validation and the DI composition are all exercised together, the same way a
 * client (DMK / the e2e suite) hits them.
 */
let server: Server;
let close: () => void;
let baseUrl: string;

const start = async (config: MockServerConfig = {}): Promise<void> => {
  const built = createMockServer(config);
  close = built.close;
  await new Promise<void>((resolve) => {
    server = built.app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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

const authenticate = async (): Promise<string> => {
  const res = await api("/auth", { method: "POST" });
  const body = (await res.json()) as { token: string };
  return body.token;
};

const addDevice = async (token: string) => {
  const res = await api(
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
  );
  return (await res.json()) as { id: string; name: string };
};

beforeEach(() => start());

afterEach(() => {
  close();
  server.close();
});

describe("createMockServer (HTTP contract)", () => {
  describe("auth", () => {
    it("issues a bearer token from POST /auth", async () => {
      const res = await api("/auth", { method: "POST" });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body["token"]).toBe("string");
      expect(typeof body["expires_at"]).toBe("number");
    });

    it("rejects a protected route without a token (401)", async () => {
      const res = await api("/devices");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Missing bearer token" });
    });

    it("rejects a protected route with an unknown token (401)", async () => {
      const res = await api("/devices", {}, "not-a-real-token");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Invalid or expired session" });
    });
  });

  describe("health", () => {
    it("reports liveness without auth", async () => {
      const res = await api("/health");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ status: "ok" });
    });
  });

  describe("devices", () => {
    it("creates, lists, fetches, edits and deletes a device", async () => {
      const token = await authenticate();

      const created = await addDevice(token);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe("Ledger Nano X");

      const list = (await (
        await api("/devices", {}, token)
      ).json()) as unknown[];
      expect(list).toHaveLength(1);

      const fetched = await api(`/devices/${created.id}`, {}, token);
      expect(fetched.status).toBe(200);

      const edited = await api(
        `/devices/${created.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ firmware_version: "2.0.0" }),
        },
        token,
      );
      expect(edited.status).toBe(200);
      expect((await edited.json()) as Record<string, unknown>).toMatchObject({
        firmware_version: "2.0.0",
      });

      const removed = await api(
        `/devices/${created.id}`,
        { method: "DELETE" },
        token,
      );
      expect(removed.status).toBe(204);
    });

    it("returns 404 for an unknown device", async () => {
      const token = await authenticate();
      const res = await api("/devices/does-not-exist", {}, token);
      expect(res.status).toBe(404);
    });

    it("rejects a malformed device payload (400)", async () => {
      const token = await authenticate();
      const res = await api(
        "/devices",
        { method: "POST", body: JSON.stringify({ device_type: 123 }) },
        token,
      );
      expect(res.status).toBe(400);
      expect((await res.json()) as { error: string }).toHaveProperty("error");
    });

    it("connects and disconnects a device", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);

      const connected = await api(
        `/devices/${id}/connect`,
        { method: "POST" },
        token,
      );
      expect(connected.status).toBe(200);
      expect((await connected.json()) as Record<string, unknown>).toMatchObject(
        {
          connected: true,
        },
      );

      const disconnected = await api(
        `/devices/${id}/disconnect`,
        { method: "POST" },
        token,
      );
      expect(disconnected.status).toBe(200);
      expect(
        (await disconnected.json()) as Record<string, unknown>,
      ).toMatchObject({ connected: false });
    });
  });

  describe("apdu resolution", () => {
    const sendApdu = async (token: string, id: string, apdu: string) => {
      const res = await api(
        `/devices/${id}/apdu`,
        { method: "POST", body: JSON.stringify({ apdu }) },
        token,
      );
      return {
        status: res.status,
        body: (await res.json()) as { response?: string },
      };
    };

    it("derives the handshake responses from device metadata", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);

      const os = await sendApdu(token, id, "e001000000");
      expect(os.body.response?.startsWith("3300000")).toBe(true);

      const appAndVersion = await sendApdu(token, id, "b001000000");
      expect(appAndVersion.body.response).toBe(
        "0105424f4c4f5305312e332e309000",
      );
    });

    it("serves an explicit mock and falls back to 6d00 otherwise", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);

      await api(
        `/devices/${id}/mocks`,
        {
          method: "POST",
          body: JSON.stringify({ prefix: "e0aa0000", response: "cafe9000" }),
        },
        token,
      );

      expect((await sendApdu(token, id, "e0aa0000")).body.response).toBe(
        "cafe9000",
      );
      expect((await sendApdu(token, id, "e0de000000")).body.response).toBe(
        "6d00",
      );
    });

    it("returns 404 when the device is unknown", async () => {
      const token = await authenticate();
      const res = await api(
        "/devices/ghost/apdu",
        { method: "POST", body: JSON.stringify({ apdu: "e001000000" }) },
        token,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("mock validation", () => {
    it("rejects a mock without a response (400)", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);
      const res = await api(
        `/devices/${id}/mocks`,
        { method: "POST", body: JSON.stringify({ prefix: "e0010000" }) },
        token,
      );
      expect(res.status).toBe(400);
      expect((await res.json()) as { error: string }).toHaveProperty("error");
    });

    it("rejects editing a mock with no response (400)", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);
      const created = (await (
        await api(
          `/devices/${id}/mocks`,
          {
            method: "POST",
            body: JSON.stringify({ prefix: "e0010000", response: "9000" }),
          },
          token,
        )
      ).json()) as { id: string };

      const res = await api(
        `/devices/${id}/mocks/${created.id}`,
        { method: "PATCH", body: JSON.stringify({ prefix: "e0010000" }) },
        token,
      );
      expect(res.status).toBe(400);
      expect((await res.json()) as { error: string }).toHaveProperty("error");
    });

    it("lists and clears a device's mocks", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);
      await api(
        `/devices/${id}/mocks`,
        {
          method: "POST",
          body: JSON.stringify({ prefix: "e0010000", response: "9000" }),
        },
        token,
      );

      const list = (await (
        await api(`/devices/${id}/mocks`, {}, token)
      ).json()) as unknown[];
      expect(list).toHaveLength(1);

      const cleared = await api(
        `/devices/${id}/mocks`,
        { method: "DELETE" },
        token,
      );
      expect(cleared.status).toBe(204);
    });
  });

  describe("speculos", () => {
    it("returns 409 when no Speculos instance is active for the device", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);
      const res = await api(`/devices/${id}/speculos`, {}, token);
      expect(res.status).toBe(409);
    });
  });

  describe("transfer", () => {
    it("exports a snapshot with device-nested mocks and re-imports it", async () => {
      const token = await authenticate();
      const { id } = await addDevice(token);
      await api(
        `/devices/${id}/mocks`,
        {
          method: "POST",
          body: JSON.stringify({
            prefix: "e0010000",
            response: "deadbeef9000",
          }),
        },
        token,
      );

      const exported = (await (await api("/export", {}, token)).json()) as {
        devices: { mocks?: unknown[] }[];
      };
      expect(exported.devices).toHaveLength(1);
      expect(exported.devices[0]!.mocks).toHaveLength(1);

      const imported = await api(
        "/import",
        { method: "POST", body: JSON.stringify(exported) },
        token,
      );
      expect(imported.status).toBe(200);
    });

    it("rejects an import whose device mock lacks a response (400)", async () => {
      const token = await authenticate();
      const res = await api(
        "/import",
        {
          method: "POST",
          body: JSON.stringify({
            devices: [{ device_type: "nanoX", mocks: [{ prefix: "e003" }] }],
          }),
        },
        token,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("session lifecycle", () => {
    it("disposes the current session, invalidating its token", async () => {
      const token = await authenticate();

      const info = await api("/sessions/current", {}, token);
      expect(info.status).toBe(200);

      const deleted = await api(
        "/sessions/current",
        { method: "DELETE" },
        token,
      );
      expect(deleted.status).toBe(204);

      const afterDelete = await api("/devices", {}, token);
      expect(afterDelete.status).toBe(401);
    });
  });
});

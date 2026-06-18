import { httpClientStubBuilder } from "./DmkNetworkClient.stub";
import { MockClient } from "./MockClient";

const aDevice = (overrides: Record<string, unknown> = {}) => ({
  id: "dev-1",
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  ...overrides,
});

describe("MockClient", () => {
  describe("authentication", () => {
    it("lazily creates a session via /auth when no token is provided", async () => {
      const http = httpClientStubBuilder()
        .mockResponse({
          method: "post",
          endpoint: "auth",
          response: { token: "tok-123", expires_at: 42 },
        })
        .mockResponse({
          method: "get",
          endpoint: "devices",
          response: [],
        });
      const client = new MockClient("http://localhost:8080", {
        httpClient: http,
      });

      const devices = await client.listDevices();

      expect(client.getToken()).toBe("tok-123");
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "auth",
        body: {},
      });
      expect(devices).toEqual([]);
    });

    it("does not call /auth when a token is injected", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices",
        response: [],
      });
      const client = new MockClient("http://localhost:8080", {
        token: "injected",
        httpClient: http,
      });

      await client.listDevices();

      expect(client.getToken()).toBe("injected");
      expect(
        http.calls.find((call) => call.endpoint === "auth"),
      ).toBeUndefined();
    });

    it("returns the token from an explicit authenticate() call", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "auth",
        response: { token: "tok-abc", expires_at: 99 },
      });
      const client = new MockClient("http://localhost:8080", {
        httpClient: http,
      });

      const token = await client.authenticate();

      expect(token).toBe("tok-abc");
      expect(client.getToken()).toBe("tok-abc");
    });

    it("reuses a single in-flight /auth call for concurrent requests", async () => {
      const http = httpClientStubBuilder()
        .mockResponse({
          method: "post",
          endpoint: "auth",
          response: { token: "tok-shared", expires_at: 1 },
        })
        .mockResponse({ method: "get", endpoint: "devices", response: [] });
      const client = new MockClient("http://localhost:8080", {
        httpClient: http,
      });

      await Promise.all([client.listDevices(), client.listDevices()]);

      const authCalls = http.calls.filter((call) => call.endpoint === "auth");
      expect(authCalls).toHaveLength(1);
    });

    it("returns undefined token before any session is established", () => {
      const client = new MockClient("http://localhost:8080", {
        httpClient: httpClientStubBuilder(),
      });

      expect(client.getToken()).toBeUndefined();
    });
  });

  describe("constructor", () => {
    it("normalizes a base url without a trailing slash", () => {
      const withSlash = new MockClient("http://localhost:8080/");
      const withoutSlash = new MockClient("http://localhost:8080");

      expect(withSlash.getToken()).toBeUndefined();
      expect(withoutSlash.getToken()).toBeUndefined();
    });
  });

  describe("devices", () => {
    it("lists devices", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices",
        response: [aDevice()],
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const devices = await client.listDevices();

      expect(devices).toEqual([expect.objectContaining({ id: "dev-1" })]);
    });

    it("adds a device with a default empty config", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "devices",
        response: aDevice(),
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const device = await client.addDevice();

      expect(device.id).toBe("dev-1");
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "devices",
        body: {},
      });
    });

    it("gets a single device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices/dev-1",
        response: aDevice(),
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const device = await client.getDevice("dev-1");

      expect(device.id).toBe("dev-1");
    });

    it("edits a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "patch",
        endpoint: "devices/dev-1",
        response: aDevice({ name: "Renamed" }),
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const device = await client.editDevice("dev-1", { name: "Renamed" });

      expect(device.name).toBe("Renamed");
      expect(http.calls).toContainEqual({
        method: "patch",
        endpoint: "devices/dev-1",
        body: { name: "Renamed" },
      });
    });

    it("deletes a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "delete",
        endpoint: "devices/dev-1",
        response: {},
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.deleteDevice("dev-1")).resolves.toBe(true);
      expect(http.calls).toContainEqual({
        method: "delete",
        endpoint: "devices/dev-1",
      });
    });
  });

  describe("connection state", () => {
    it("connects a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "devices/dev-1/connect",
        response: { device: aDevice(), connected: true },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const state = await client.connect("dev-1");

      expect(state.connected).toBe(true);
      expect(state.device.id).toBe("dev-1");
    });

    it("disconnects a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "devices/dev-1/disconnect",
        response: {},
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.disconnect("dev-1")).resolves.toBe(true);
    });

    it("disconnects every connected device", async () => {
      const http = httpClientStubBuilder()
        .mockResponse({
          method: "get",
          endpoint: "devices",
          response: [
            aDevice({ id: "dev-1", connected: true }),
            aDevice({ id: "dev-2", connected: false }),
            aDevice({ id: "dev-3", connected: true }),
          ],
        })
        .mockResponse({
          method: "post",
          endpoint: "devices/dev-1/disconnect",
          response: {},
        })
        .mockResponse({
          method: "post",
          endpoint: "devices/dev-3/disconnect",
          response: {},
        });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.disconnectAll()).resolves.toBe(true);

      const disconnectCalls = http.calls.filter((call) =>
        call.endpoint.endsWith("/disconnect"),
      );
      expect(disconnectCalls.map((call) => call.endpoint)).toEqual([
        "devices/dev-1/disconnect",
        "devices/dev-3/disconnect",
      ]);
    });
  });

  describe("mocks", () => {
    it("lists device-scoped mocks", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices/dev-1/mocks",
        response: [{ id: "m1", prefix: "e0010000", responses: ["9000"] }],
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const mocks = await client.listMocks("dev-1");

      expect(mocks).toEqual([expect.objectContaining({ id: "m1" })]);
    });

    it("creates a device-scoped mock", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "devices/dev-1/mocks",
        response: { id: "m1", prefix: "e0010000", responses: ["9000"] },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const mock = await client.addMock("dev-1", {
        prefix: "e0010000",
        response: "9000",
      });

      expect(mock.id).toBe("m1");
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "devices/dev-1/mocks",
        body: { prefix: "e0010000", response: "9000" },
      });
    });

    it("edits a mock", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "patch",
        endpoint: "devices/dev-1/mocks/m1",
        response: { id: "m1", prefix: "e0010000", responses: ["6985"] },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const mock = await client.editMock("dev-1", "m1", {
        prefix: "e0010000",
        response: "6985",
      });

      expect(mock.responses).toEqual(["6985"]);
      expect(http.calls).toContainEqual({
        method: "patch",
        endpoint: "devices/dev-1/mocks/m1",
        body: { prefix: "e0010000", response: "6985" },
      });
    });

    it("deletes a single mock", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "delete",
        endpoint: "devices/dev-1/mocks/m1",
        response: {},
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.deleteMock("dev-1", "m1")).resolves.toBe(true);
      expect(http.calls).toContainEqual({
        method: "delete",
        endpoint: "devices/dev-1/mocks/m1",
      });
    });

    it("clears all mocks of a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "delete",
        endpoint: "devices/dev-1/mocks",
        response: {},
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.clearMocks("dev-1")).resolves.toBe(true);
      expect(http.calls).toContainEqual({
        method: "delete",
        endpoint: "devices/dev-1/mocks",
      });
    });
  });

  describe("speculos", () => {
    it("resolves the live speculos instance backing a device", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices/dev-1/speculos",
        response: {
          run_id: "run-1",
          speculos_url: "https://speculos:5000",
          model: "stax",
        },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const instance = await client.getSpeculos("dev-1");

      expect(instance).toEqual({
        run_id: "run-1",
        speculos_url: "https://speculos:5000",
        model: "stax",
      });
    });
  });

  describe("session", () => {
    it("fetches the current session", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "sessions/current",
        response: {
          id: "sess-1",
          created_at: 1,
          expires_at: 2,
          devices: [aDevice()],
        },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const session = await client.getSession();

      expect(session.id).toBe("sess-1");
      expect(session.devices).toHaveLength(1);
    });

    it("disposes the session and clears the stored token", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "delete",
        endpoint: "sessions/current",
        response: {},
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.disposeSession()).resolves.toBe(true);
      expect(client.getToken()).toBeUndefined();
    });
  });

  describe("response validation", () => {
    it("throws a descriptive error when the server response is malformed", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "devices/dev-1",
        response: { id: 123 } as unknown as object,
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      await expect(client.getDevice("dev-1")).rejects.toThrow(
        /MockClient: invalid server response/,
      );
    });
  });

  describe("import/export", () => {
    it("exports the session snapshot", async () => {
      const snapshot = {
        devices: [
          {
            name: "Ledger Stax",
            device_type: "stax",
            mocks: [{ prefix: "ff", responses: ["9000"] }],
          },
        ],
      };
      const http = httpClientStubBuilder().mockResponse({
        method: "get",
        endpoint: "export",
        response: snapshot,
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const result = await client.exportSession();

      expect(result).toEqual(snapshot);
    });

    it("posts a snapshot to the import endpoint", async () => {
      const snapshot = {
        devices: [
          {
            name: "Ledger Flex",
            device_type: "flex",
            mocks: [{ prefix: "e0010000", responses: ["aa9000", "5515"] }],
          },
        ],
      };
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "import",
        response: snapshot,
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const result = await client.importSession(snapshot);

      expect(result).toEqual(snapshot);
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "import",
        body: snapshot,
      });
    });
  });

  describe("apdu", () => {
    it("sends a binary APDU as hex to the device apdu endpoint", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "devices/dev-1/apdu",
        response: { response: "9000" },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const result = await client.sendApdu(
        "dev-1",
        Uint8Array.from([0xe0, 0x01, 0x00, 0x00]),
      );

      expect(result.response).toBe("9000");
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "devices/dev-1/apdu",
        body: { apdu: "e0010000" },
      });
    });
  });
});

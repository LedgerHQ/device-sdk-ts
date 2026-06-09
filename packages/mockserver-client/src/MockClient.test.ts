import { httpClientStubBuilder } from "./DmkNetworkClient.stub";
import { MockClient } from "./MockClient";

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
  });

  describe("mocks", () => {
    it("creates a session-scoped mock", async () => {
      const http = httpClientStubBuilder().mockResponse({
        method: "post",
        endpoint: "mocks",
        response: { id: "m1", prefix: "e0010000", responses: ["9000"] },
      });
      const client = new MockClient("http://localhost:8080", {
        token: "tok",
        httpClient: http,
      });

      const mock = await client.addMock({
        prefix: "e0010000",
        response: "9000",
      });

      expect(mock.id).toBe("m1");
      expect(http.calls).toContainEqual({
        method: "post",
        endpoint: "mocks",
        body: { prefix: "e0010000", response: "9000" },
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

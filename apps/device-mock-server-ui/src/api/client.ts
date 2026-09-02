import {
  type Device,
  type DeviceApp,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";

/** Everything the UI can learn about the server without a session. */
export interface Health {
  readonly status: string;
  readonly sessions: number;
}

export interface AuthResponse {
  readonly token: string;
  readonly expires_at: number;
}

/**
 * An HTTP failure carrying the status code, so callers can tell "your token is
 * gone" (401) apart from "that was a bad request" (400).
 */
export class MockServerError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MockServerError";
  }
}

/**
 * The UI is served by the mock server itself, so every call is same-origin;
 * `vite dev` proxies the same paths to a locally running server. Every prefix
 * used below must be listed in {@link file://./routes.ts}, which drives that
 * proxy.
 */
async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (!response.ok) {
    throw new MockServerError(response.status, await errorMessage(response));
  }
  if (response.status === 204) return undefined as T;

  // A page where JSON was expected means the request never reached the mock
  // server — in dev, a path missing from the Vite proxy in `routes.ts` is
  // answered by the SPA fallback with index.html. Say that, rather than letting
  // a JSON parse error surface as "Unexpected token '<'".
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new MockServerError(
      response.status,
      `${path} answered with ${contentType || "an unknown type"} instead of JSON — the request did not reach the mock server`,
    );
  }
  return (await response.json()) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Not a JSON error envelope — fall back to the status line.
  }
  return `${response.status} ${response.statusText}`;
}

const body = (payload: unknown) => JSON.stringify(payload);

export const api = {
  health: () => request<Health>("/health"),

  createSession: () => request<AuthResponse>("/auth", { method: "POST" }),

  getSession: (token: string) =>
    request<Session>("/sessions/current", { token }),

  disposeSession: (token: string) =>
    request<void>("/sessions/current", { method: "DELETE", token }),

  setSeed: (token: string, seed: string) =>
    request<{ seed: string }>("/sessions/current/seed", {
      method: "PUT",
      token,
      body: body({ seed }),
    }),

  /** Whether an OS version was ever released for a model. */
  checkFirmware: (token: string, deviceType: string, firmware: string) =>
    request<{ exists: boolean; model: string }>(
      `/catalog/firmware?${new URLSearchParams({
        device_type: deviceType,
        firmware_version: firmware,
      })}`,
      { token },
    ),

  /** The apps that really exist for a model on a given firmware. */
  listCatalogApps: (token: string, deviceType: string, firmware: string) =>
    request<DeviceApp[]>(
      `/catalog/apps?${new URLSearchParams({
        device_type: deviceType,
        firmware_version: firmware,
      })}`,
      { token },
    ),

  listDevices: (token: string) => request<Device[]>("/devices", { token }),

  addDevice: (token: string, config: DeviceConfig) =>
    request<Device>("/devices", { method: "POST", token, body: body(config) }),

  editDevice: (token: string, deviceId: string, config: DeviceConfig) =>
    request<Device>(`/devices/${deviceId}`, {
      method: "PATCH",
      token,
      body: body(config),
    }),

  deleteDevice: (token: string, deviceId: string) =>
    request<void>(`/devices/${deviceId}`, { method: "DELETE", token }),

  setConnected: (token: string, deviceId: string, connected: boolean) =>
    request<{ device: Device; connected: boolean }>(
      `/devices/${deviceId}/${connected ? "connect" : "disconnect"}`,
      { method: "POST", token },
    ),

  sendApdu: (token: string, deviceId: string, apdu: string) =>
    request<{ response: string }>(`/devices/${deviceId}/apdu`, {
      method: "POST",
      token,
      body: body({ apdu }),
    }),

  listMocks: (token: string, deviceId: string) =>
    request<Mock[]>(`/devices/${deviceId}/mocks`, { token }),

  addMock: (token: string, deviceId: string, config: MockConfig) =>
    request<Mock>(`/devices/${deviceId}/mocks`, {
      method: "POST",
      token,
      body: body(config),
    }),

  editMock: (
    token: string,
    deviceId: string,
    mockId: string,
    config: MockConfig,
  ) =>
    request<Mock>(`/devices/${deviceId}/mocks/${mockId}`, {
      method: "PATCH",
      token,
      body: body(config),
    }),

  deleteMock: (token: string, deviceId: string, mockId: string) =>
    request<void>(`/devices/${deviceId}/mocks/${mockId}`, {
      method: "DELETE",
      token,
    }),

  clearMocks: (token: string, deviceId: string) =>
    request<void>(`/devices/${deviceId}/mocks`, { method: "DELETE", token }),

  exportSession: (token: string) =>
    request<SessionExport>("/export", { token }),

  importSession: (token: string, snapshot: SessionExport) =>
    request<SessionExport>("/import", {
      method: "POST",
      token,
      body: body(snapshot),
    }),
};

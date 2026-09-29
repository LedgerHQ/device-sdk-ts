import {
  type Device,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";

export interface Health {
  readonly status: string;
  readonly sessions: number;
}

export interface AuthResponse {
  readonly token: string;
  readonly expires_at: number;
}

export class MockServerError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "MockServerError";
  }
}

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

  // HTML where JSON was expected means the request never reached the server —
  // in dev, a path missing from `routes.ts`. Better said than left to surface
  // as "Unexpected token '<'".
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
    // Not a JSON error envelope; the status line will do.
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

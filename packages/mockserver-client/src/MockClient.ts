import {
  bufferToHexaString,
  DmkNetworkClient,
} from "@ledgerhq/device-management-kit";
import { array, type Codec } from "purify-ts";

import {
  authResponseCodec,
  type ConnectionState,
  connectionStateCodec,
} from "./model/Auth";
import {
  type CommandResponse,
  commandResponseCodec,
} from "./model/CommandResponse";
import { type Device, deviceCodec, type DeviceConfig } from "./model/Device";
import { type Mock, mockCodec, type MockConfig } from "./model/Mock";
import { type Session, sessionCodec } from "./model/Session";
import { type SessionExport, sessionExportCodec } from "./model/SessionExport";
import { type SpeculosInstance, speculosInstanceCodec } from "./model/Speculos";

export interface MockClientOptions {
  /**
   * An existing mock server session token. When provided the client operates
   * within that session; when omitted the client lazily creates its own session
   * through POST /auth.
   */
  readonly token?: string;
  /** Inject a custom network client (mainly for testing). */
  readonly httpClient?: DmkNetworkClient;
}

/**
 * HTTP client for the device mock server.
 *
 * Implements the bearer-token contract: the session is
 * resolved from an `Authorization: Bearer <token>` header rather than a
 * `session_id` header, and sessions, devices and mocks are exposed as REST
 * resources. The token can be injected or self-provisioned via /auth.
 */
export class MockClient {
  private readonly client: DmkNetworkClient;
  private token?: string;
  private authPromise?: Promise<string>;

  constructor(baseUrl: string, options: MockClientOptions = {}) {
    this.client =
      options.httpClient ??
      new DmkNetworkClient({ baseUrl: this.normalizeUrl(baseUrl) });
    this.token = options.token;
  }

  // --- Authentication -------------------------------------------------------

  /** Create a session and store the returned bearer token. */
  async authenticate(): Promise<string> {
    const data = await this.client.post("auth", {});
    const token = this.decode(authResponseCodec, data).token;
    this.token = token;
    return token;
  }

  /** The current bearer token, if a session has been established. */
  getToken(): string | undefined {
    return this.token;
  }

  // --- Devices --------------------------------------------------------------

  async listDevices(): Promise<Device[]> {
    const data = await this.client.get("devices", {
      headers: await this.authHeaders(),
    });
    return this.decode(array(deviceCodec), data);
  }

  async addDevice(config: DeviceConfig = {}): Promise<Device> {
    const data = await this.client.post("devices", config, {
      headers: await this.authHeaders(),
    });
    return this.decode(deviceCodec, data);
  }

  async getDevice(deviceId: string): Promise<Device> {
    const data = await this.client.get(`devices/${deviceId}`, {
      headers: await this.authHeaders(),
    });
    return this.decode(deviceCodec, data);
  }

  async editDevice(deviceId: string, config: DeviceConfig): Promise<Device> {
    const data = await this.client.patch(`devices/${deviceId}`, config, {
      headers: await this.authHeaders(),
    });
    return this.decode(deviceCodec, data);
  }

  async deleteDevice(deviceId: string): Promise<boolean> {
    await this.client.delete(`devices/${deviceId}`, {
      headers: await this.authHeaders(),
    });
    return true;
  }

  // --- Connection state -----------------------------------------------------

  async connect(deviceId: string): Promise<ConnectionState> {
    const data = await this.client.post(
      `devices/${deviceId}/connect`,
      {},
      { headers: await this.authHeaders() },
    );
    return this.decode(connectionStateCodec, data);
  }

  async disconnect(deviceId: string): Promise<boolean> {
    await this.client.post(
      `devices/${deviceId}/disconnect`,
      {},
      { headers: await this.authHeaders() },
    );
    return true;
  }

  /** Disconnect every device attached to the session. */
  async disconnectAll(): Promise<boolean> {
    const devices = await this.listDevices();
    await Promise.all(
      devices
        .filter((device) => device.connected)
        .map((device) => this.disconnect(device.id)),
    );
    return true;
  }

  // --- APDU simulation ------------------------------------------------------

  async sendApdu(
    deviceId: string,
    apdu: Uint8Array | string,
  ): Promise<CommandResponse> {
    const hex =
      typeof apdu === "string" ? apdu : bufferToHexaString(apdu, false);
    const data = await this.client.post(
      `devices/${deviceId}/apdu`,
      { apdu: hex },
      { headers: await this.authHeaders() },
    );
    return this.decode(commandResponseCodec, data);
  }

  // --- Mocks (device-scoped) ------------------------------------------------

  async listMocks(deviceId: string): Promise<Mock[]> {
    const data = await this.client.get(`devices/${deviceId}/mocks`, {
      headers: await this.authHeaders(),
    });
    return this.decode(array(mockCodec), data);
  }

  async addMock(deviceId: string, config: MockConfig): Promise<Mock> {
    const data = await this.client.post(`devices/${deviceId}/mocks`, config, {
      headers: await this.authHeaders(),
    });
    return this.decode(mockCodec, data);
  }

  async editMock(
    deviceId: string,
    mockId: string,
    config: MockConfig,
  ): Promise<Mock> {
    const data = await this.client.patch(
      `devices/${deviceId}/mocks/${mockId}`,
      config,
      { headers: await this.authHeaders() },
    );
    return this.decode(mockCodec, data);
  }

  async deleteMock(deviceId: string, mockId: string): Promise<boolean> {
    await this.client.delete(`devices/${deviceId}/mocks/${mockId}`, {
      headers: await this.authHeaders(),
    });
    return true;
  }

  async clearMocks(deviceId: string): Promise<boolean> {
    await this.client.delete(`devices/${deviceId}/mocks`, {
      headers: await this.authHeaders(),
    });
    return true;
  }

  // --- Speculos -------------------------------------------------------------

  /**
   * Resolve the live Speculos instance backing a device (the one currently
   * proxying its APDUs). Throws if the device has no active instance.
   */
  async getSpeculos(deviceId: string): Promise<SpeculosInstance> {
    const data = await this.client.get(`devices/${deviceId}/speculos`, {
      headers: await this.authHeaders(),
    });
    return this.decode(speculosInstanceCodec, data);
  }

  // --- Session --------------------------------------------------------------

  async getSession(): Promise<Session> {
    const data = await this.client.get("sessions/current", {
      headers: await this.authHeaders(),
    });
    return this.decode(sessionCodec, data);
  }

  async disposeSession(): Promise<boolean> {
    await this.client.delete("sessions/current", {
      headers: await this.authHeaders(),
    });
    this.token = undefined;
    this.authPromise = undefined;
    return true;
  }

  // --- Import / Export ------------------------------------------------------

  /** Export the session's devices and mocks as a portable snapshot. */
  async exportSession(): Promise<SessionExport> {
    const data = await this.client.get("export", {
      headers: await this.authHeaders(),
    });
    return this.decode(sessionExportCodec, data);
  }

  /**
   * Replace the session's devices and mocks with a previously exported
   * snapshot, returning the resulting (normalized) state.
   */
  async importSession(snapshot: SessionExport): Promise<SessionExport> {
    const data = await this.client.post("import", snapshot, {
      headers: await this.authHeaders(),
    });
    return this.decode(sessionExportCodec, data);
  }

  // --- Helpers --------------------------------------------------------------

  private decode<T>(codec: Codec<T>, data: unknown): T {
    return codec.decode(data).caseOf({
      Left: (error) => {
        throw new Error(`MockClient: invalid server response (${error})`);
      },
      Right: (value) => value,
    });
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken();
    return { Authorization: `Bearer ${token}` };
  }

  private ensureToken(): Promise<string> {
    if (this.token) {
      return Promise.resolve(this.token);
    }
    if (!this.authPromise) {
      this.authPromise = this.authenticate();
    }
    return this.authPromise;
  }

  private normalizeUrl(baseUrl: string): string {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }
}

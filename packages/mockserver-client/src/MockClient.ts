import {
  bufferToHexaString,
  DmkNetworkClient,
  type DmkRequestConfig,
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
import { type Health, healthCodec } from "./model/Health";
import { type Mock, mockCodec, type MockConfig } from "./model/Mock";
import { type Session, sessionCodec } from "./model/Session";
import { type SessionExport, sessionExportCodec } from "./model/SessionExport";
import {
  type SpeculosAction,
  type SpeculosButton,
  type SpeculosInstance,
  speculosInstanceCodec,
} from "./model/Speculos";

export interface MockClientOptions {
  /**
   * An existing mock server session token. When provided the client operates
   * within that session; when omitted the client lazily creates its own session
   * through POST /auth.
   */
  readonly token?: string;
  /** Inject a custom network client (mainly for testing). */
  readonly httpClient?: DmkNetworkClient;
  /** Abort each request after this many milliseconds. Unset means no timeout. */
  readonly timeoutMs?: number;
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
  private readonly timeoutMs?: number;
  private token?: string;
  private authPromise?: Promise<string>;

  constructor(baseUrl: string, options: MockClientOptions = {}) {
    this.client =
      options.httpClient ??
      new DmkNetworkClient({ baseUrl: this.normalizeUrl(baseUrl) });
    this.token = options.token;
    this.timeoutMs = options.timeoutMs;
  }

  // --- Health ---------------------------------------------------------------

  async getHealth(): Promise<Health> {
    const data = await this.client.get("health", this.requestConfig());
    return this.decode(healthCodec, data);
  }

  // --- Authentication -------------------------------------------------------

  /** Create a session and store the returned bearer token. */
  async authenticate(): Promise<string> {
    const data = await this.client.post("auth", {}, this.requestConfig());
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
    const data = await this.client.get(
      "devices",
      await this.authRequestConfig(),
    );
    return this.decode(array(deviceCodec), data);
  }

  async addDevice(config: DeviceConfig = {}): Promise<Device> {
    const data = await this.client.post(
      "devices",
      config,
      await this.authRequestConfig(),
    );
    return this.decode(deviceCodec, data);
  }

  async getDevice(deviceId: string): Promise<Device> {
    const data = await this.client.get(
      `devices/${deviceId}`,
      await this.authRequestConfig(),
    );
    return this.decode(deviceCodec, data);
  }

  async editDevice(deviceId: string, config: DeviceConfig): Promise<Device> {
    const data = await this.client.patch(
      `devices/${deviceId}`,
      config,
      await this.authRequestConfig(),
    );
    return this.decode(deviceCodec, data);
  }

  async deleteDevice(deviceId: string): Promise<boolean> {
    await this.client.delete(
      `devices/${deviceId}`,
      await this.authRequestConfig(),
    );
    return true;
  }

  // --- Connection state -----------------------------------------------------

  async connect(deviceId: string): Promise<ConnectionState> {
    const data = await this.client.post(
      `devices/${deviceId}/connect`,
      {},
      await this.authRequestConfig(),
    );
    return this.decode(connectionStateCodec, data);
  }

  async disconnect(deviceId: string): Promise<boolean> {
    await this.client.post(
      `devices/${deviceId}/disconnect`,
      {},
      await this.authRequestConfig(),
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
      await this.authRequestConfig(),
    );
    return this.decode(commandResponseCodec, data);
  }

  // --- Mocks (device-scoped) ------------------------------------------------

  async listMocks(deviceId: string): Promise<Mock[]> {
    const data = await this.client.get(
      `devices/${deviceId}/mocks`,
      await this.authRequestConfig(),
    );
    return this.decode(array(mockCodec), data);
  }

  async addMock(deviceId: string, config: MockConfig): Promise<Mock> {
    const data = await this.client.post(
      `devices/${deviceId}/mocks`,
      config,
      await this.authRequestConfig(),
    );
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
      await this.authRequestConfig(),
    );
    return this.decode(mockCodec, data);
  }

  async deleteMock(deviceId: string, mockId: string): Promise<boolean> {
    await this.client.delete(
      `devices/${deviceId}/mocks/${mockId}`,
      await this.authRequestConfig(),
    );
    return true;
  }

  async clearMocks(deviceId: string): Promise<boolean> {
    await this.client.delete(
      `devices/${deviceId}/mocks`,
      await this.authRequestConfig(),
    );
    return true;
  }

  // --- Speculos -------------------------------------------------------------

  /**
   * Resolve the live Speculos instance backing a device (the one currently
   * proxying its APDUs). Throws if the device has no active instance.
   */
  async getSpeculos(deviceId: string): Promise<SpeculosInstance> {
    const data = await this.client.get(
      `devices/${deviceId}/speculos`,
      await this.authRequestConfig(),
    );
    return this.decode(speculosInstanceCodec, data);
  }

  /**
   * Capture the device's current screen as a PNG. Throws with status 409 when
   * the device has no active instance, which is the case whenever no app is
   * running.
   */
  async getScreenshot(deviceId: string): Promise<Blob> {
    const data = await this.client.get(
      `devices/${deviceId}/speculos/screenshot`,
      { ...(await this.authRequestConfig()), responseType: "blob" },
    );
    return data as Blob;
  }

  /** Actuate a physical button on a button-driven device. */
  async pressButton(
    deviceId: string,
    button: SpeculosButton,
    action: SpeculosAction = "press-and-release",
  ): Promise<void> {
    await this.client.post(
      `devices/${deviceId}/speculos/button/${button}`,
      { action },
      await this.authRequestConfig(),
    );
  }

  /** Tap a touchscreen device, in device screen pixels. */
  async touchScreen(
    deviceId: string,
    x: number,
    y: number,
    action: SpeculosAction = "press-and-release",
  ): Promise<void> {
    await this.client.post(
      `devices/${deviceId}/speculos/finger`,
      { action, x, y },
      await this.authRequestConfig(),
    );
  }

  // --- Session --------------------------------------------------------------

  async getSession(): Promise<Session> {
    const data = await this.client.get(
      "sessions/current",
      await this.authRequestConfig(),
    );
    return this.decode(sessionCodec, data);
  }

  /**
   * Set the BIP39 mnemonic of the Speculos instances the session starts next.
   * Use test mnemonics only: the server keeps the seed in plaintext.
   */
  async setSeed(seed: string): Promise<void> {
    await this.client.put(
      "sessions/current/seed",
      { seed },
      await this.authRequestConfig(),
    );
  }

  async disposeSession(): Promise<boolean> {
    await this.client.delete(
      "sessions/current",
      await this.authRequestConfig(),
    );
    this.token = undefined;
    this.authPromise = undefined;
    return true;
  }

  // --- Import / Export ------------------------------------------------------

  /** Export the session's devices and mocks as a portable snapshot. */
  async exportSession(): Promise<SessionExport> {
    const data = await this.client.get(
      "export",
      await this.authRequestConfig(),
    );
    return this.decode(sessionExportCodec, data);
  }

  /**
   * Replace the session's devices and mocks with a previously exported
   * snapshot, returning the resulting (normalized) state.
   */
  async importSession(snapshot: SessionExport): Promise<SessionExport> {
    const data = await this.client.post(
      "import",
      snapshot,
      await this.authRequestConfig(),
    );
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

  private requestConfig(): DmkRequestConfig {
    return { timeoutMs: this.timeoutMs };
  }

  private async authRequestConfig(): Promise<DmkRequestConfig> {
    const token = await this.ensureToken();
    return {
      ...this.requestConfig(),
      headers: { Authorization: `Bearer ${token}` },
    };
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

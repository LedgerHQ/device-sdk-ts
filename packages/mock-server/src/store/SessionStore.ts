import { randomUUID } from "node:crypto";

import {
  type Device,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";

import { DEFAULT_DEVICE } from "../defaults";

export interface SessionStoreOptions {
  /** Sliding inactivity timeout in ms (refreshed on every authed request). */
  readonly ttlMs?: number;
  /** Hard cap on a session lifetime in ms, regardless of activity. */
  readonly maxLifetimeMs?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * A device that has opened an app and is now proxying its APDUs to a live
 * Speculos instance managed by the Speculinho operator.
 */
export interface SpeculosProxySession {
  /** Speculinho `run_id` owning the Speculos pod. */
  readonly runId: string;
  /** Per-pod Speculos base URL handed back by Speculinho. */
  readonly speculosUrl: string;
  /** BOLOS app name that opened the proxy. */
  readonly appName: string;
}

interface SessionRecord {
  id: string;
  token: string;
  createdAt: number;
  lastSeenAt: number;
  devices: Map<string, Device>;
  /** Per-device mock table: deviceId -> (mockId -> Mock). */
  deviceMocks: Map<string, Map<string, Mock>>;
  /** Per-device response cursors: deviceId -> (mockId -> next index). */
  deviceMockCursors: Map<string, Map<string, number>>;
  /** Active Speculos proxy per device id. */
  speculos: Map<string, SpeculosProxySession>;
}

/**
 * In-memory store of bearer-token sessions.
 *
 * Each session owns its devices, and each device owns its own mock table.
 * Sessions expire on a sliding TTL or a hard lifetime cap; {@link sweep} removes
 * expired ones.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ttlMs: number;
  private readonly maxLifetimeMs: number;

  /**
   * Invoked with the Speculos proxy sessions discarded when a session or device
   * is evicted (disposed, deleted or swept), so the owner can release the
   * underlying Speculos instances. Kept as a hook to keep the store IO-free.
   */
  onEvict?: (sessions: SpeculosProxySession[]) => void;

  constructor(options: SessionStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxLifetimeMs = options.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
  }

  createSession(): { token: string; expiresAt: number } {
    const now = Date.now();
    const record: SessionRecord = {
      id: randomUUID(),
      token: randomUUID(),
      createdAt: now,
      lastSeenAt: now,
      devices: new Map(),
      deviceMocks: new Map(),
      deviceMockCursors: new Map(),
      speculos: new Map(),
    };
    this.sessions.set(record.token, record);
    return { token: record.token, expiresAt: this.expiresAt(record) };
  }

  /** Resolve a session from its token, refreshing its sliding TTL. */
  touch(token: string): SessionRecord | undefined {
    const record = this.sessions.get(token);
    if (!record || this.isExpired(record)) {
      if (record) this.sessions.delete(token);
      return undefined;
    }
    record.lastSeenAt = Date.now();
    return record;
  }

  deleteSession(token: string): void {
    const record = this.sessions.get(token);
    if (record && record.speculos.size > 0) {
      this.onEvict?.([...record.speculos.values()]);
    }
    this.sessions.delete(token);
  }

  toSession(record: SessionRecord): Session {
    return {
      id: record.id,
      created_at: record.createdAt,
      expires_at: this.expiresAt(record),
      devices: [...record.devices.values()],
    };
  }

  // --- Devices --------------------------------------------------------------

  listDevices(record: SessionRecord): Device[] {
    return [...record.devices.values()];
  }

  addDevice(record: SessionRecord, config: DeviceConfig): Device {
    const id = randomUUID();
    const device = this.buildDevice(id, config);
    record.devices.set(id, device);
    record.deviceMocks.set(id, new Map());
    record.deviceMockCursors.set(id, new Map());
    // No default mocks: the handshake (GetOsVersion / GetAppAndVersion) is
    // derived from the device metadata at APDU-resolution time. Callers may
    // still seed explicit mocks via config (used by import).
    for (const mock of config.mocks ?? []) {
      this.addMock(record, id, mock);
    }
    return device;
  }

  getDevice(record: SessionRecord, deviceId: string): Device | undefined {
    return record.devices.get(deviceId);
  }

  editDevice(
    record: SessionRecord,
    deviceId: string,
    config: DeviceConfig,
  ): Device | undefined {
    const current = record.devices.get(deviceId);
    if (!current) return undefined;
    const updated: Device = { ...current, ...config, id: current.id };
    record.devices.set(deviceId, updated);
    return updated;
  }

  deleteDevice(record: SessionRecord, deviceId: string): boolean {
    const proxy = record.speculos.get(deviceId);
    if (proxy) {
      this.onEvict?.([proxy]);
      record.speculos.delete(deviceId);
    }
    record.deviceMocks.delete(deviceId);
    record.deviceMockCursors.delete(deviceId);
    return record.devices.delete(deviceId);
  }

  setConnected(
    record: SessionRecord,
    deviceId: string,
    connected: boolean,
  ): Device | undefined {
    const current = record.devices.get(deviceId);
    if (!current) return undefined;
    const updated: Device = { ...current, connected };
    record.devices.set(deviceId, updated);
    return updated;
  }

  // --- Speculos proxy -------------------------------------------------------

  getProxy(
    record: SessionRecord,
    deviceId: string,
  ): SpeculosProxySession | undefined {
    return record.speculos.get(deviceId);
  }

  setProxy(
    record: SessionRecord,
    deviceId: string,
    session: SpeculosProxySession,
  ): void {
    record.speculos.set(deviceId, session);
  }

  /**
   * Forget a device's Speculos proxy. Does not release the instance — callers
   * that intercept Close App / disconnect release it directly; {@link onEvict}
   * covers implicit eviction.
   */
  deleteProxy(
    record: SessionRecord,
    deviceId: string,
  ): SpeculosProxySession | undefined {
    const session = record.speculos.get(deviceId);
    record.speculos.delete(deviceId);
    return session;
  }

  // --- Mocks (device-scoped) ------------------------------------------------

  /** List a device's mocks, or `undefined` when the device does not exist. */
  listMocks(record: SessionRecord, deviceId: string): Mock[] | undefined {
    return record.deviceMocks.has(deviceId)
      ? [...record.deviceMocks.get(deviceId)!.values()]
      : undefined;
  }

  addMock(
    record: SessionRecord,
    deviceId: string,
    config: MockConfig,
  ): Mock | undefined {
    const mocks = record.deviceMocks.get(deviceId);
    if (!mocks) return undefined;
    const mock: Mock = {
      id: randomUUID(),
      prefix: config.prefix,
      responses: normalizeResponses(config),
    };
    mocks.set(mock.id, mock);
    return mock;
  }

  editMock(
    record: SessionRecord,
    deviceId: string,
    mockId: string,
    config: MockConfig,
  ): Mock | undefined {
    const mocks = record.deviceMocks.get(deviceId);
    const current = mocks?.get(mockId);
    if (!mocks || !current) return undefined;
    const updated: Mock = {
      ...current,
      ...config,
      id: current.id,
      responses: normalizeResponses(config),
    };
    mocks.set(mockId, updated);
    // Editing a mock restarts its response sequence.
    record.deviceMockCursors.get(deviceId)?.delete(mockId);
    return updated;
  }

  deleteMock(record: SessionRecord, deviceId: string, mockId: string): boolean {
    record.deviceMockCursors.get(deviceId)?.delete(mockId);
    return record.deviceMocks.get(deviceId)?.delete(mockId) ?? false;
  }

  clearMocks(record: SessionRecord, deviceId: string): void {
    record.deviceMocks.get(deviceId)?.clear();
    record.deviceMockCursors.get(deviceId)?.clear();
  }

  /**
   * Return the response a mock should serve for the current matching APDU,
   * advancing its cursor and looping back to the start once exhausted.
   */
  consumeResponse(record: SessionRecord, deviceId: string, mock: Mock): string {
    const cursors = record.deviceMockCursors.get(deviceId);
    const index = cursors?.get(mock.id) ?? 0;
    cursors?.set(mock.id, index + 1);
    return mock.responses[index % mock.responses.length] ?? "";
  }

  // --- Import / Export ------------------------------------------------------

  /** Serialize the session's devices and their mocks as a portable snapshot. */
  exportSession(record: SessionRecord): SessionExport {
    return {
      devices: [...record.devices.entries()].map(([id, device]) => ({
        ...toDeviceConfig(device),
        mocks: [...(record.deviceMocks.get(id)?.values() ?? [])].map(
          (mock) => ({ prefix: mock.prefix, responses: [...mock.responses] }),
        ),
      })),
    };
  }

  /**
   * Replace the session's devices (and their mocks) with the given snapshot,
   * resetting connection state and response cursors. Returns the re-exported
   * state.
   */
  importSession(record: SessionRecord, snapshot: SessionExport): SessionExport {
    record.devices.clear();
    record.deviceMocks.clear();
    record.deviceMockCursors.clear();
    record.speculos.clear();
    for (const device of snapshot.devices) {
      this.addDevice(record, device);
    }
    return this.exportSession(record);
  }

  // --- Lifecycle ------------------------------------------------------------

  /** Remove every expired session. Returns the number of sessions removed. */
  sweep(): number {
    let removed = 0;
    for (const [token, record] of this.sessions) {
      if (this.isExpired(record)) {
        if (record.speculos.size > 0) {
          this.onEvict?.([...record.speculos.values()]);
        }
        this.sessions.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.sessions.size;
  }

  private buildDevice(id: string, config: DeviceConfig): Device {
    return {
      id,
      name: config.name ?? DEFAULT_DEVICE.name,
      device_type: config.device_type ?? DEFAULT_DEVICE.device_type,
      connectivity_type:
        config.connectivity_type ?? DEFAULT_DEVICE.connectivity_type,
      firmware_version: config.firmware_version,
      apps: config.apps,
      masks: config.masks,
      connected: false,
    };
  }

  private expiresAt(record: SessionRecord): number {
    return Math.min(
      record.lastSeenAt + this.ttlMs,
      record.createdAt + this.maxLifetimeMs,
    );
  }

  private isExpired(record: SessionRecord): boolean {
    return Date.now() > this.expiresAt(record);
  }
}

/**
 * Resolve a mock config's ordered response list, accepting either an explicit
 * `responses` array or the single-response `response` shorthand.
 */
function normalizeResponses(config: MockConfig): string[] {
  if (config.responses && config.responses.length > 0) {
    return [...config.responses];
  }
  return config.response !== undefined ? [config.response] : [];
}

/** Strip runtime fields (id, connection state) from a device for export. */
function toDeviceConfig(device: Device): DeviceConfig {
  return {
    name: device.name,
    device_type: device.device_type,
    connectivity_type: device.connectivity_type,
    firmware_version: device.firmware_version,
    apps: device.apps,
    masks: device.masks,
  };
}

export type { SessionRecord };

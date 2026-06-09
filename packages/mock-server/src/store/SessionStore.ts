import { randomUUID } from "node:crypto";

import {
  type Device,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
} from "@ledgerhq/device-mockserver-client";

import { DEFAULT_DEVICE, DEFAULT_MOCKS } from "../defaults";

export interface SessionStoreOptions {
  /** Sliding inactivity timeout in ms (refreshed on every authed request). */
  readonly ttlMs?: number;
  /** Hard cap on a session lifetime in ms, regardless of activity. */
  readonly maxLifetimeMs?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours

interface SessionRecord {
  id: string;
  token: string;
  createdAt: number;
  lastSeenAt: number;
  devices: Map<string, Device>;
  mocks: Map<string, Mock>;
  /** Next response index to serve per mock id (advanced by consumeResponse). */
  mockCursors: Map<string, number>;
}

/**
 * In-memory store of bearer-token sessions.
 *
 * Each session owns its devices and mocks. Sessions expire on a sliding TTL or
 * a hard lifetime cap; {@link sweep} removes expired ones.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ttlMs: number;
  private readonly maxLifetimeMs: number;

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
      mocks: new Map(),
      mockCursors: new Map(),
    };
    this.seedDefaults(record);
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

  // --- Mocks ----------------------------------------------------------------

  listMocks(record: SessionRecord): Mock[] {
    return [...record.mocks.values()];
  }

  addMock(record: SessionRecord, config: MockConfig): Mock {
    const mock: Mock = {
      id: randomUUID(),
      prefix: config.prefix,
      responses: normalizeResponses(config),
    };
    record.mocks.set(mock.id, mock);
    return mock;
  }

  editMock(
    record: SessionRecord,
    mockId: string,
    config: MockConfig,
  ): Mock | undefined {
    const current = record.mocks.get(mockId);
    if (!current) return undefined;
    const updated: Mock = {
      ...current,
      ...config,
      id: current.id,
      responses: normalizeResponses(config),
    };
    record.mocks.set(mockId, updated);
    // Editing a mock restarts its response sequence.
    record.mockCursors.delete(mockId);
    return updated;
  }

  deleteMock(record: SessionRecord, mockId: string): boolean {
    record.mockCursors.delete(mockId);
    return record.mocks.delete(mockId);
  }

  clearMocks(record: SessionRecord): void {
    record.mocks.clear();
    record.mockCursors.clear();
  }

  /**
   * Return the response a mock should serve for the current matching APDU,
   * advancing its cursor and looping back to the start once exhausted.
   */
  consumeResponse(record: SessionRecord, mock: Mock): string {
    const index = record.mockCursors.get(mock.id) ?? 0;
    record.mockCursors.set(mock.id, index + 1);
    return mock.responses[index % mock.responses.length] ?? "";
  }

  // --- Lifecycle ------------------------------------------------------------

  /** Remove every expired session. Returns the number of sessions removed. */
  sweep(): number {
    let removed = 0;
    for (const [token, record] of this.sessions) {
      if (this.isExpired(record)) {
        this.sessions.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.sessions.size;
  }

  private seedDefaults(record: SessionRecord): void {
    for (const mock of DEFAULT_MOCKS) {
      this.addMock(record, mock);
    }
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

export type { SessionRecord };

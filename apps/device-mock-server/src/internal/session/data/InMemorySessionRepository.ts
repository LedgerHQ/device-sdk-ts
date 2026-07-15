import { randomUUID } from "node:crypto";

import {
  type CatalogApp,
  type Device,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";
import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { DEFAULT_DEVICE } from "@internal/defaults";
import { appTypes } from "@internal/di/types";
import {
  advanceOnboarding as advanceOnboardingState,
  deriveOnboardingSeFlags,
  initialOnboardingState,
  onEarlyCheckToggle,
} from "@internal/onboarding/onboarding";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import {
  type SessionRecord,
  type SpeculosProxySession,
} from "@internal/session/model/SessionModels";

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * In-memory {@link SessionRepository}. Each session owns its devices, and each
 * device owns its own mock table. Sessions expire on a sliding TTL or a hard
 * lifetime cap.
 */
@injectable()
export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ttlMs: number;
  private readonly maxLifetimeMs: number;

  constructor(@inject(appTypes.Config) config: MockServerConfig) {
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
    this.maxLifetimeMs = config.maxLifetimeMs ?? DEFAULT_MAX_LIFETIME_MS;
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
      catalog: new Map(),
      pendingAppOperations: new Map(),
      pendingFirmwareOperations: new Map(),
      onboarding: new Map(),
    };
    this.sessions.set(record.token, record);
    return { token: record.token, expiresAt: this.expiresAt(record) };
  }

  findByToken(token: string): Maybe<SessionRecord> {
    const record = this.sessions.get(token);
    if (!record || this.isExpired(record)) {
      if (record) this.sessions.delete(token);
      return Maybe.empty();
    }
    record.lastSeenAt = Date.now();
    return Maybe.of(record);
  }

  deleteSession(token: string): SpeculosProxySession[] {
    const record = this.sessions.get(token);
    const evicted = record ? [...record.speculos.values()] : [];
    this.sessions.delete(token);
    return evicted;
  }

  toSession(record: SessionRecord): Session {
    return {
      id: record.id,
      created_at: record.createdAt,
      expires_at: this.expiresAt(record),
      devices: [...record.devices.values()],
    };
  }

  size(): number {
    return this.sessions.size;
  }

  sweep(): SpeculosProxySession[] {
    const evicted: SpeculosProxySession[] = [];
    for (const [token, record] of this.sessions) {
      if (this.isExpired(record)) {
        evicted.push(...record.speculos.values());
        this.sessions.delete(token);
      }
    }
    return evicted;
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
    // Opt a device into the onboarding simulation: it starts not onboarded and
    // walks itself through the onboarding steps as it is polled.
    if (config.onboarded === false) {
      record.onboarding.set(id, initialOnboardingState());
    }
    // Seed the session-wide app store with the installable apps the client may
    // later install (resolved from their install hash by the secure channel).
    for (const app of config.catalog ?? []) {
      record.catalog.set(app.hash, app);
    }
    // No default mocks: the handshake (GetOsVersion / GetAppAndVersion) is
    // derived from device metadata at APDU-resolution time. Callers may still
    // seed explicit mocks via config (used by import).
    for (const mock of config.mocks ?? []) {
      this.addMock(record, id, mock);
    }
    return device;
  }

  findDevice(record: SessionRecord, deviceId: string): Maybe<Device> {
    return Maybe.fromNullable(record.devices.get(deviceId));
  }

  editDevice(
    record: SessionRecord,
    deviceId: string,
    config: DeviceConfig,
  ): Maybe<Device> {
    return this.findDevice(record, deviceId).map((current) => {
      const updated: Device = { ...current, ...config, id: current.id };
      record.devices.set(deviceId, updated);
      // Start/stop the onboarding simulation in place so the device id stays
      // stable (a client bound to it, e.g. Ledger Live, keeps its connection).
      if (config.onboarded === false && !record.onboarding.has(deviceId)) {
        record.onboarding.set(deviceId, initialOnboardingState());
      } else if (config.onboarded === true) {
        record.onboarding.delete(deviceId);
      }
      return updated;
    });
  }

  deleteDevice(
    record: SessionRecord,
    deviceId: string,
  ): { removed: boolean; proxy: Maybe<SpeculosProxySession> } {
    const proxy = Maybe.fromNullable(record.speculos.get(deviceId));
    record.speculos.delete(deviceId);
    record.deviceMocks.delete(deviceId);
    record.deviceMockCursors.delete(deviceId);
    record.onboarding.delete(deviceId);
    return { removed: record.devices.delete(deviceId), proxy };
  }

  setConnected(
    record: SessionRecord,
    deviceId: string,
    connected: boolean,
  ): Maybe<Device> {
    return this.findDevice(record, deviceId).map((current) => {
      const updated: Device = { ...current, connected };
      record.devices.set(deviceId, updated);
      return updated;
    });
  }

  // --- App store (catalog) / pending app operations -------------------------

  findCatalogAppByHash(record: SessionRecord, hash: string): Maybe<CatalogApp> {
    return Maybe.fromNullable(record.catalog.get(hash));
  }

  setPendingAppOperation(
    record: SessionRecord,
    deviceId: string,
    app: CatalogApp,
  ): void {
    record.pendingAppOperations.set(deviceId, app);
  }

  commitPendingAppOperation(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<Device> {
    const app = record.pendingAppOperations.get(deviceId);
    if (!app) {
      return Maybe.empty();
    }
    record.pendingAppOperations.delete(deviceId);
    return this.findDevice(record, deviceId).map((device) => {
      const apps = device.apps ?? [];
      // The secure-channel `install` endpoint backs both install and uninstall,
      // and they are indistinguishable from the request, so toggle by presence:
      // remove the app when already installed (uninstall), add it otherwise.
      const installed = apps.some((existing) => existing.name === app.name);
      const updated: Device = {
        ...device,
        apps: installed
          ? apps.filter((existing) => existing.name !== app.name)
          : [...apps, { name: app.name, version: app.version, hash: app.hash }],
      };
      record.devices.set(deviceId, updated);
      return updated;
    });
  }

  setPendingFirmwareOperation(
    record: SessionRecord,
    deviceId: string,
    targetVersion: string,
  ): void {
    record.pendingFirmwareOperations.set(deviceId, targetVersion);
  }

  commitPendingFirmwareOperation(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<Device> {
    const targetVersion = record.pendingFirmwareOperations.get(deviceId);
    if (targetVersion === undefined) {
      return Maybe.empty();
    }
    record.pendingFirmwareOperations.delete(deviceId);
    return this.findDevice(record, deviceId).map((device) => {
      const updated: Device = { ...device, firmware_version: targetVersion };
      record.devices.set(deviceId, updated);
      return updated;
    });
  }

  // --- Speculos proxy -------------------------------------------------------

  findProxy(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<SpeculosProxySession> {
    return Maybe.fromNullable(record.speculos.get(deviceId));
  }

  setProxy(
    record: SessionRecord,
    deviceId: string,
    session: SpeculosProxySession,
  ): void {
    record.speculos.set(deviceId, session);
  }

  deleteProxy(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<SpeculosProxySession> {
    const proxy = Maybe.fromNullable(record.speculos.get(deviceId));
    record.speculos.delete(deviceId);
    return proxy;
  }

  // --- Mocks (device-scoped) ------------------------------------------------

  listMocks(record: SessionRecord, deviceId: string): Maybe<Mock[]> {
    return Maybe.fromNullable(record.deviceMocks.get(deviceId)).map((mocks) => [
      ...mocks.values(),
    ]);
  }

  addMock(
    record: SessionRecord,
    deviceId: string,
    config: MockConfig,
  ): Maybe<Mock> {
    return Maybe.fromNullable(record.deviceMocks.get(deviceId)).map((mocks) => {
      const mock: Mock = {
        id: randomUUID(),
        prefix: config.prefix,
        responses: normalizeResponses(config),
      };
      mocks.set(mock.id, mock);
      return mock;
    });
  }

  editMock(
    record: SessionRecord,
    deviceId: string,
    mockId: string,
    config: MockConfig,
  ): Maybe<Mock> {
    const mocks = record.deviceMocks.get(deviceId);
    return Maybe.fromNullable(mocks?.get(mockId)).map((current) => {
      const updated: Mock = {
        ...current,
        ...config,
        id: current.id,
        responses: normalizeResponses(config),
      };
      mocks!.set(mockId, updated);
      // Editing a mock restarts its response sequence.
      record.deviceMockCursors.get(deviceId)?.delete(mockId);
      return updated;
    });
  }

  deleteMock(record: SessionRecord, deviceId: string, mockId: string): boolean {
    record.deviceMockCursors.get(deviceId)?.delete(mockId);
    return record.deviceMocks.get(deviceId)?.delete(mockId) ?? false;
  }

  clearMocks(record: SessionRecord, deviceId: string): void {
    record.deviceMocks.get(deviceId)?.clear();
    record.deviceMockCursors.get(deviceId)?.clear();
  }

  consumeResponse(record: SessionRecord, deviceId: string, mock: Mock): string {
    const cursors = record.deviceMockCursors.get(deviceId);
    const index = cursors?.get(mock.id) ?? 0;
    cursors?.set(mock.id, index + 1);
    return mock.responses[index % mock.responses.length] ?? "";
  }

  // --- Onboarding simulation ------------------------------------------------

  onboardingActive(record: SessionRecord, deviceId: string): boolean {
    return record.onboarding.has(deviceId);
  }

  currentOnboardingSeFlags(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<string> {
    return Maybe.fromNullable(record.onboarding.get(deviceId)).map(
      deriveOnboardingSeFlags,
    );
  }

  advanceOnboarding(record: SessionRecord, deviceId: string): void {
    const state = record.onboarding.get(deviceId);
    if (!state) return;
    const next = advanceOnboardingState(state);
    record.onboarding.set(deviceId, next);
    // Reflect completion on the device metadata so `GET /devices` shows it.
    if (next.completed && !state.completed) {
      this.findDevice(record, deviceId).ifJust((device) =>
        record.devices.set(deviceId, { ...device, onboarded: true }),
      );
    }
  }

  toggleOnboardingEarlyCheck(
    record: SessionRecord,
    deviceId: string,
    enter: boolean,
  ): void {
    const state = record.onboarding.get(deviceId);
    if (!state) return;
    record.onboarding.set(deviceId, onEarlyCheckToggle(state, enter));
  }

  // --- Import / Export ------------------------------------------------------

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

  importSession(record: SessionRecord, snapshot: SessionExport): SessionExport {
    record.devices.clear();
    record.deviceMocks.clear();
    record.deviceMockCursors.clear();
    record.speculos.clear();
    record.catalog.clear();
    record.pendingAppOperations.clear();
    record.pendingFirmwareOperations.clear();
    record.onboarding.clear();
    for (const device of snapshot.devices) {
      this.addDevice(record, device);
    }
    return this.exportSession(record);
  }

  // --- Helpers --------------------------------------------------------------

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
      onboarded: config.onboarded,
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

function normalizeResponses(config: MockConfig): string[] {
  if (config.responses && config.responses.length > 0) {
    return [...config.responses];
  }
  return config.response !== undefined ? [config.response] : [];
}

function toDeviceConfig(device: Device): DeviceConfig {
  return {
    name: device.name,
    device_type: device.device_type,
    connectivity_type: device.connectivity_type,
    firmware_version: device.firmware_version,
    apps: device.apps,
    masks: device.masks,
    onboarded: device.onboarded,
  };
}

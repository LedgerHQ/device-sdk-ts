import {
  type Device,
  type DeviceConfig,
  type Mock,
  type MockConfig,
  type Session,
  type SessionExport,
} from "@ledgerhq/device-mockserver-client";
import { type Maybe } from "purify-ts";

import {
  type SessionRecord,
  type SpeculosProxySession,
} from "@internal/session/model/SessionModels";

/**
 * Port for the in-memory store of bearer-token sessions and everything they own
 * (devices, per-device mocks, Speculos proxies). Lookups return `Maybe`; the
 * eviction methods return the Speculos proxies discarded so the caller can
 * release the underlying instances.
 */
export interface SessionRepository {
  // --- Sessions -------------------------------------------------------------
  createSession(): { token: string; expiresAt: number };
  /** Resolve a session from its token, refreshing its sliding TTL. */
  findByToken(token: string): Maybe<SessionRecord>;
  /** Dispose a session; returns its active Speculos proxies. */
  deleteSession(token: string): SpeculosProxySession[];
  toSession(record: SessionRecord): Session;
  size(): number;
  /** Remove expired sessions; returns their active Speculos proxies. */
  sweep(): SpeculosProxySession[];

  // --- Devices --------------------------------------------------------------
  listDevices(record: SessionRecord): Device[];
  addDevice(record: SessionRecord, config: DeviceConfig): Device;
  findDevice(record: SessionRecord, deviceId: string): Maybe<Device>;
  editDevice(
    record: SessionRecord,
    deviceId: string,
    config: DeviceConfig,
  ): Maybe<Device>;
  /** Delete a device; returns its Speculos proxy if one was active. */
  deleteDevice(
    record: SessionRecord,
    deviceId: string,
  ): { removed: boolean; proxy: Maybe<SpeculosProxySession> };
  setConnected(
    record: SessionRecord,
    deviceId: string,
    connected: boolean,
  ): Maybe<Device>;

  // --- Speculos proxy -------------------------------------------------------
  findProxy(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<SpeculosProxySession>;
  setProxy(
    record: SessionRecord,
    deviceId: string,
    session: SpeculosProxySession,
  ): void;
  deleteProxy(
    record: SessionRecord,
    deviceId: string,
  ): Maybe<SpeculosProxySession>;

  // --- Mocks (device-scoped) ------------------------------------------------
  listMocks(record: SessionRecord, deviceId: string): Maybe<Mock[]>;
  addMock(
    record: SessionRecord,
    deviceId: string,
    config: MockConfig,
  ): Maybe<Mock>;
  editMock(
    record: SessionRecord,
    deviceId: string,
    mockId: string,
    config: MockConfig,
  ): Maybe<Mock>;
  deleteMock(record: SessionRecord, deviceId: string, mockId: string): boolean;
  clearMocks(record: SessionRecord, deviceId: string): void;
  consumeResponse(record: SessionRecord, deviceId: string, mock: Mock): string;

  // --- Import / Export ------------------------------------------------------
  exportSession(record: SessionRecord): SessionExport;
  importSession(record: SessionRecord, snapshot: SessionExport): SessionExport;
}

import {
  type DeviceConfig,
  deviceConfigCodec,
  type MockConfig,
  mockConfigCodec,
  type SessionExport,
  sessionExportCodec,
} from "@ledgerhq/device-mockserver-client";
import { type Either, Left, Right } from "purify-ts";

const MOCK_RESPONSE_REQUIRED =
  "prefix and a response or non-empty responses array are required";

/** A mock config must carry at least one response (single or list). */
const hasResponse = (config: MockConfig): boolean =>
  typeof config.response === "string" ||
  (Array.isArray(config.responses) && config.responses.length > 0);

/**
 * A device id goes in URL paths (`/devices/:id`), so a chosen one is limited to
 * characters that need no encoding. Random UUIDs match it too.
 */
const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

const INVALID_DEVICE_ID =
  "id must be 1 to 64 letters, digits, '-' or '_' characters";

const hasValidId = (config: DeviceConfig): boolean =>
  config.id === undefined || DEVICE_ID.test(config.id);

/** Decode + validate a `PATCH /devices/:id` body. The repository ignores `id`. */
export function decodeDeviceConfig(
  body: unknown,
): Either<string, DeviceConfig> {
  return deviceConfigCodec.decode(body);
}

/** Decode + validate a `POST /devices` body, with its optional `id`. */
export function decodeNewDeviceConfig(
  body: unknown,
): Either<string, DeviceConfig> {
  return deviceConfigCodec
    .decode(body)
    .chain((config) =>
      hasValidId(config) ? Right(config) : Left(INVALID_DEVICE_ID),
    );
}

/** Decode + validate a `POST /devices/:id/mocks` body. */
export function decodeMockConfig(body: unknown): Either<string, MockConfig> {
  return mockConfigCodec
    .decode(body)
    .chain((config) =>
      hasResponse(config) ? Right(config) : Left(MOCK_RESPONSE_REQUIRED),
    );
}

/**
 * Decode + validate a `POST /import` snapshot: each nested mock, and each
 * device id, which must be unique in the snapshot.
 */
export function decodeSessionImport(
  body: unknown,
): Either<string, SessionExport> {
  return sessionExportCodec
    .decode(body)
    .chain((snapshot) =>
      snapshot.devices.every((device) =>
        (device.mocks ?? []).every(hasResponse),
      )
        ? Right(snapshot)
        : Left(`each device mock requires ${MOCK_RESPONSE_REQUIRED}`),
    )
    .chain((snapshot) =>
      snapshot.devices.every(hasValidId)
        ? Right(snapshot)
        : Left(`each device ${INVALID_DEVICE_ID}`),
    )
    .chain((snapshot) => {
      const ids = snapshot.devices.flatMap((device) =>
        device.id === undefined ? [] : [device.id],
      );
      return new Set(ids).size === ids.length
        ? Right(snapshot)
        : Left("device ids must be unique");
    });
}

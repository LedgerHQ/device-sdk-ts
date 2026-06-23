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

/** Decode + validate a `POST /devices` or `PATCH /devices/:id` body. */
export function decodeDeviceConfig(
  body: unknown,
): Either<string, DeviceConfig> {
  return deviceConfigCodec.decode(body);
}

/** Decode + validate a `POST /devices/:id/mocks` body. */
export function decodeMockConfig(body: unknown): Either<string, MockConfig> {
  return mockConfigCodec
    .decode(body)
    .chain((config) =>
      hasResponse(config) ? Right(config) : Left(MOCK_RESPONSE_REQUIRED),
    );
}

/** Decode + validate a `POST /import` snapshot (each nested mock validated). */
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
    );
}

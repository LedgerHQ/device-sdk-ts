/**
 * Default responses for the APDUs the mock ScriptRunner relays during a
 * secure-channel session, colocated with the APDUs themselves so they stay in
 * sync. These responses are produced only when no explicit per-device mock
 * matches (see {@link file://./../../apdu/service/ApduResolverService.ts}); an
 * explicit mock overrides them, e.g. to make the device reply with an error.
 */

import { randomBytes } from "node:crypto";

const STATUS_OK = "9000";

/**
 * Permission request (`0xE0 0x51`) so the AllowSecureConnection interaction is
 * exercised, then GetCertificate (`0xE0 0x52`) so a device id is emitted. Both
 * are sent as `exchange` steps before every operation.
 */
const PERMISSION_PREFIX = "e051";
export const SECURE_CHANNEL_GET_CERTIFICATE_APDU = "e052000000";

/** Permission APDU header before the flow id: CLA, INS, P1, P2, then Lc `08`. */
const PERMISSION_HEADER = `${PERMISSION_PREFIX}000008`;
const FLOW_ID_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Random id of one secure-channel flow (8 bytes, hex). The secure-channel URL
 * has no device id, so the server uses this id to find the device: the flow
 * sends it in its permission APDU, and the device that receives this APDU is
 * the device the flow runs on.
 */
export function createSecureChannelFlowId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Permission APDU of one flow, with the flow id as its data. Clients relay it
 * as is and only read its CLA/INS.
 *
 *   CLA INS P1 P2 | Lc | data
 *   e0  51  00 00 | 08 | flow id (8 bytes)
 */
export function buildSecureChannelPermissionApdu(flowId: string): string {
  return `${PERMISSION_HEADER}${flowId}`;
}

/**
 * Flow id in a permission APDU built by {@link buildSecureChannelPermissionApdu},
 * or `undefined` for any other APDU (a bare `e051000000` included).
 */
export function parseSecureChannelFlowId(apdu: string): string | undefined {
  if (!apdu.startsWith(PERMISSION_HEADER)) {
    return undefined;
  }
  const flowId = apdu.slice(PERMISSION_HEADER.length);
  return FLOW_ID_PATTERN.test(flowId) ? flowId : undefined;
}

/**
 * Synthetic genuine-verdict APDU (`0xE0 0xF1`) relayed at the end of the genuine
 * flow. Its response *data* carries the verdict the mock ScriptRunner reports as
 * the `success` result: `0000` means genuine (DMK's `GENUINE_DEVICE_RESULT`).
 * A device mock can override it (e.g. `e0f1 -> 00019000`) to make the device
 * report as not genuine.
 */
export const SECURE_CHANNEL_GENUINE_APDU = "e0f1000000";

/** Genuine verdict response: data `0000` (genuine) followed by a success SW. */
const GENUINE_VERDICT_RESPONSE = "0000" + STATUS_OK;

/**
 * Synthetic install-block APDUs streamed as a `bulk` message for the install
 * flow, mimicking the real install script. They all share the `e0f0` prefix so a
 * single device mock can override the whole stream (e.g. `e0f0 -> 6a84` to fail
 * on the first block), while each block carries a distinct P1 byte (`00`..`05`)
 * so a mock can instead target one specific block (e.g. `e0f00400 -> 6a84` to
 * fail on the 5th block while the first four still succeed). By default they
 * derive to success, so install completes while emitting a `Progress` event per
 * APDU.
 */
export const INSTALL_BLOCK_APDUS: readonly string[] = [
  "e0f0000004aabbccdd",
  "e0f0010004eeff0011",
  "e0f0020004deadbeef",
  "e0f0030004cafebabe",
  "e0f0040004f00dface",
  "e0f0050000",
];

/**
 * The final install block (the commit/flush, P1 `05`). A real device only holds
 * the new app once this last command is acknowledged, so the mock commits the
 * pending install into the device's registry when this APDU resolves to success.
 */
export const INSTALL_COMMIT_APDU =
  INSTALL_BLOCK_APDUS[INSTALL_BLOCK_APDUS.length - 1]!;

/**
 * GetCertificate response: a length-value encoded empty header followed by a
 * length-value encoded public key (`aabbccdd`), so DMK's `extractPublicKey`
 * yields a non-null key and emits a device id.
 */
const GET_CERTIFICATE_RESPONSE = "0004aabbccdd" + STATUS_OK;

/** Match prefixes (cla+ins) derived from the relayed APDUs above. */
const GET_CERTIFICATE_PREFIX = SECURE_CHANNEL_GET_CERTIFICATE_APDU.slice(0, 4);
const INSTALL_PREFIX = INSTALL_BLOCK_APDUS[0]!.slice(0, 4);
const GENUINE_PREFIX = SECURE_CHANNEL_GENUINE_APDU.slice(0, 4);

/**
 * Derived default response for a relayed secure-channel APDU (handshake, install
 * block or genuine verdict), or `undefined` when the APDU is not one of them.
 * The permission and install-block APDUs yield a bare success; GetCertificate
 * yields a parseable certificate payload; the genuine APDU yields a genuine
 * verdict (`0000`).
 */
export function deriveSecureChannelResponse(apdu: string): string | undefined {
  if (apdu.startsWith(GET_CERTIFICATE_PREFIX)) {
    return GET_CERTIFICATE_RESPONSE;
  }
  if (apdu.startsWith(GENUINE_PREFIX)) {
    return GENUINE_VERDICT_RESPONSE;
  }
  if (apdu.startsWith(PERMISSION_PREFIX)) {
    return STATUS_OK;
  }
  if (apdu.startsWith(INSTALL_PREFIX)) {
    return STATUS_OK;
  }
  return undefined;
}

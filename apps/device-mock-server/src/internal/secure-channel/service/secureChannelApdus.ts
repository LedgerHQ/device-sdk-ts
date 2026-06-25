/**
 * Default responses for the APDUs the mock ScriptRunner relays during a
 * secure-channel session, colocated with the APDUs themselves so they stay in
 * sync. These responses are produced only when no explicit per-device mock
 * matches (see {@link file://./../../apdu/service/ApduResolverService.ts}); an
 * explicit mock overrides them, e.g. to make the device reply with an error.
 */

const STATUS_OK = "9000";

/**
 * Permission request (`0xE0 0x51`) so the AllowSecureConnection interaction is
 * exercised, then GetCertificate (`0xE0 0x52`) so a device id is emitted. Both
 * are sent as `exchange` steps before every operation.
 */
export const SECURE_CHANNEL_PERMISSION_APDU = "e051000000";
export const SECURE_CHANNEL_GET_CERTIFICATE_APDU = "e052000000";

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
 * GetCertificate response: a length-value encoded empty header followed by a
 * length-value encoded public key (`aabbccdd`), so DMK's `extractPublicKey`
 * yields a non-null key and emits a device id.
 */
const GET_CERTIFICATE_RESPONSE = "0004aabbccdd" + STATUS_OK;

/** Match prefixes (cla+ins) derived from the relayed APDUs above. */
const PERMISSION_PREFIX = SECURE_CHANNEL_PERMISSION_APDU.slice(0, 4);
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

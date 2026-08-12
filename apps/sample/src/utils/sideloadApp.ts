/**
 * SCP v2 — Secure Channel Protocol for Ledger device app sideloading.
 *
 * Port of ledgerwallet's Python SCP implementation to TypeScript.
 * Uses @noble/secp256k1 for ECDH and signing, WebCrypto for AES-CBC.
 */

import type { Signature } from "@noble/secp256k1";
import * as secp from "@noble/secp256k1";

// Configure noble-secp256k1 v2 with async HMAC-SHA256 via WebCrypto
secp.etc.hmacSha256Async = async (
  key: Uint8Array,
  ...messages: Uint8Array[]
): Promise<Uint8Array> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = secp.etc.concatBytes(...messages);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
};

const CLA = 0xe0;
const BLOCK_SIZE = 16;
const SCP_MAC_LENGTH = 14;

// Ledger OS instruction codes
const INS_SECUINS = 0x00;
const INS_VALIDATE_TARGET_ID = 0x04;
const INS_INITIALIZE_AUTHENTICATION = 0x50;
const INS_VALIDATE_CERTIFICATE = 0x51;
const INS_GET_CERTIFICATE = 0x52;
const INS_MUTUAL_AUTHENTICATE = 0x53;

// Secure channel loader instruction codes
const SECURE_INS_DELETE_APP = 0x0c;

export type ApduSender = (apdu: Uint8Array) => Promise<Uint8Array>;

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function serializeTlv(data: Uint8Array): Uint8Array {
  return concat(new Uint8Array([data.length]), data);
}

function unserializeTlv(data: Uint8Array): [Uint8Array, Uint8Array] {
  const len = data[0] ?? 0;
  return [data.slice(1, 1 + len), data.slice(1 + len)];
}

function buildApdu(ins: number, data: Uint8Array, p1 = 0, p2 = 0): Uint8Array {
  return concat(new Uint8Array([CLA, ins, p1, p2, data.length]), data);
}

// Status words documented for the clear/secure commands used during
// sideloading: https://ledgerhq.atlassian.net/wiki/spaces/FW/pages/4455596105
const STATUS_WORD_MESSAGES: Record<number, string> = {
  // Generic APDU parsing errors (any command)
  0x6e01: "Unknown CLA",
  0x6d01: "Unknown INS",
  0x650e: "Unexpected P1 value",
  0x650f: "Unexpected P2 value",
  0x6510: "Lc does not match the actual APDU data length",
  0x6511: "Lc does not match the expected fixed length for this instruction",
  0x6512:
    "Lc does not match the expected fixed length for this secure instruction",

  // VALIDATE_TARGET_ID
  0x662e: "No background image loaded on the device",
  0x6814: "Target ID does not match the connected device",

  // INITIALIZE_AUTHENTICATION
  0x5414: "Device failed to generate a key pair",
  0x5523: "Invalid factory settings CRC",
  0x550b: "Device is not personalized",
  0x6602: "Target ID has not been validated yet",

  // VALIDATE_CERTIFICATE
  0x5327: "Internal hashing error",
  0x5328: "Internal hashing error",
  0x5329: "Internal hashing error",
  0x5704: "Host public key does not match personalized certificate 0",
  0x5705: "Host public key does not match personalized certificate 1",
  0x5706: "Host public key does not match the installed custom CA",
  0x5707: "Self-signed certificate signature verification failed",
  0x5708: "Signature verification with the previous host public key failed",
  0x6704: "Invalid host public key length",
  0x6804: "Self-signed certificate cannot be ephemeral",
  0x6805: "Self-signed certificates are not allowed",
  0x6816: "Cannot validate a personalized certificate while a custom CA is set",

  // GET_CERTIFICATE
  0x4216: "Internal error (wrong factory instance)",
  0x520d: "Invalid factory CRC",
  0x532a: "Internal error hashing the device certificate",
  0x5402: "Failed to compute the shared key",
  0x5410: "Failed to initialize the private key",
  0x540a: "Failed to initialize signature encryption",
  0x540b: "Failed to set the signature encryption key",
  0x540c: "Failed to encrypt the signature",
  0x550e: "Device is not personalized",
  0x5718: "Internal error signing the device public key",
  0x5904: "Certificate has not been validated",
  0x5905: "Certificate chain has not been fully retrieved",
  0x6502: "Invalid factory setting zone",
  0x6503: "Invalid root certificate number",

  // MUTUAL_AUTHENTICATE
  0x5211: "Device is not personalized",
  0x5601: "Failed to hash the secret prefix",
  0x5602: "Failed to hash the secret",
  0x5709: "Internal ECDH error",
  0x5906: "Certificate chain has not been fully retrieved",

  // SET_LOAD_OFFSET / LOAD / FLUSH / CRC / COMMIT — "not created yet" guards
  0x5105: "Create App has not been called yet",
  0x5106: "Create App has not been called yet",
  0x5107: "Create App has not been called yet",
  0x5108: "Create App has not been called yet",
  0x5109: "Create App has not been called yet",

  // LOAD
  0x6612: "Secure channel session is closed",
  0x670d: "Malformed load data",
  0x670e: "Malformed load data",
  0x670f: "Load APDU is too small",
  0x680b: "Load offset/length falls outside the app's reserved memory area",
  0x6837: "Internal error hashing the loaded data",
  0x6838: "Internal error hashing the loaded data",

  // CRC
  0x680c: "CRC check offset/length is outside the app's memory area",
  0x6817: "CRC check offset/length is outside the app's memory area",
  0x5217: "CRC mismatch — loaded data is corrupted",

  // COMMIT
  0x510a: "Invalid app dependency signer",
  0x510b: "Invalid app dependency signer",
  0x532b: "Invalid application hash",
  0x570a: "Invalid application signature",
  0x570b: "Unable to verify the application signature",
  0x6613: "Secure channel session is closed",
  0x661a: "OSU app requires a signature",
  0x661b: "Signature is missing",
  0x661c: "OSU app has invalid flags",
  0x6711: "Invalid APDU command size",
  0x6712: "Application name is too long",
  0x680d: "Application name is missing",
  0x680e: "An app with the same hash is already installed",
  0x680f: "An app with the same name is already installed",
  0x6810: "Invalid app dependency flags",
  0x6811: "A required app dependency is not installed",

  // CREATE_APP
  0x5102: "No free app slot on the device (not enough memory)",
  0x5104: "Invalid application main address",
  0x511f: "Invalid application API level",
  0x5120: "Sideloading is not authorized on this device",
  0x6617: "OSU app must be signed by the issuer",
  0x6808: "Invalid app code length, data length, or install params length",
  0x6809: "Application code length must be page-aligned",
  0x680a: "Application data length must be page-aligned",
  0x6834: "Internal error hashing the target ID",
  0x6835: "Internal error hashing the version",
  0x6836: "Internal error hashing the application parameters",
  0x6d06: "Device must be onboarded before installing an app",

  // DELETE_APP
  0x6621: "Internal registry error",
  0x6719: "Delete APDU is too small",

  // Shared across most commands
  0x5501: "User rejected the operation on the device",
  0x5502: "PIN is not validated on the device",

  // Generic ISO7816-style codes from blue-loader-python's comm.py, kept as a
  // fallback since some devices/bootloader states surface these instead of
  // the Ledger-OS-specific codes above.
  0x6982: "A custom certificate authority is already installed",
  0x6985: "Condition of use not satisfied (denied by the user)",
  0x6a83: "A required library dependency is missing",
  0x6a84: "Not enough space on the device",
  0x6a85: "Not enough space on the device",
  0x6484: "Wrong target ID",
  0x6d00: "Unexpected device state",
  0x6e00: "Unexpected device state",
  0x5515: "Device is locked",
  0x6f00: "Unknown error",
};

function formatSw(sw: number): string {
  const hex = `0x${sw.toString(16).padStart(4, "0")}`;
  const message = STATUS_WORD_MESSAGES[sw];
  return message ? `${hex} (${message})` : hex;
}

function checkSw(resp: Uint8Array, context: string): Uint8Array {
  if (resp.length < 2)
    throw new Error(`${context}: empty response (len=${resp.length})`);
  const sw = (resp[resp.length - 2]! << 8) | resp[resp.length - 1]!;
  if (sw !== 0x9000) {
    throw new Error(`${context}: ${formatSw(sw)}`);
  }
  return resp.slice(0, resp.length - 2);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(hash);
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function uint32BE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, false);
  return buf;
}

// --- secp256k1 helpers ---

function generatePrivateKey(): Uint8Array {
  return secp.utils.randomPrivateKey();
}

function getPublicKeyUncompressed(privKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privKey, false);
}

async function signDER(
  privKey: Uint8Array,
  msg: Uint8Array,
): Promise<Uint8Array> {
  // BOLOS verifies against sha256(msg) directly, and noble's signAsync
  // already treats its first argument as a pre-hashed digest.
  const msgHash = await sha256(msg);
  let sig: Signature = await secp.signAsync(msgHash, privKey);
  if (sig.hasHighS()) sig = sig.normalizeS();
  const compact = sig.toCompactRawBytes();
  return encodeDER(compact.slice(0, 32), compact.slice(32, 64));
}

function encodeDERInteger(val: Uint8Array): Uint8Array {
  let start = 0;
  while (start < val.length - 1 && val[start] === 0) start++;
  let trimmed = val.slice(start);
  if ((trimmed[0] ?? 0) & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded.set(trimmed, 1);
    trimmed = padded;
  }
  return concat(new Uint8Array([0x02, trimmed.length]), trimmed);
}

function encodeDER(r: Uint8Array, s: Uint8Array): Uint8Array {
  const body = concat(encodeDERInteger(r), encodeDERInteger(s));
  return concat(new Uint8Array([0x30, body.length]), body);
}

/**
 * ECDH following libsecp256k1 convention used by ledgerwallet:
 * multiply, take compressed point, SHA-256 hash it.
 */
async function ecdh(
  privKey: Uint8Array,
  pubKeyUncompressed: Uint8Array,
): Promise<Uint8Array> {
  const shared = secp.getSharedSecret(privKey, pubKeyUncompressed, true);
  return sha256(shared);
}

// --- AES-CBC helpers (WebCrypto) ---

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function aesCbcEncrypt(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<{ ct: Uint8Array; newIv: Uint8Array }> {
  // WebCrypto always adds one block of PKCS7 padding; our data is already
  // block-aligned (ISO 9797 padded), so we strip that extra block back off.
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: iv as BufferSource },
      key,
      data as BufferSource,
    ),
  );
  const result = ct.slice(0, data.length);
  const newIv = result.slice(result.length - BLOCK_SIZE);
  return { ct: result, newIv };
}

async function aesCbcDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
): Promise<{ pt: Uint8Array; newIv: Uint8Array }> {
  const newIv = data.slice(data.length - BLOCK_SIZE);
  // Add a dummy PKCS7 padding block so WebCrypto's decrypt doesn't reject it.
  const padBlock = new Uint8Array(BLOCK_SIZE).fill(BLOCK_SIZE);
  const input = concat(data, padBlock);
  const pt = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv as BufferSource },
      key,
      input as BufferSource,
    ),
  );
  return { pt: pt.slice(0, data.length), newIv };
}

// --- ISO 9797 padding ---

function iso9797Pad(data: Uint8Array): Uint8Array {
  const paddingLen = BLOCK_SIZE - (data.length % BLOCK_SIZE);
  const padded = new Uint8Array(data.length + paddingLen);
  padded.set(data);
  padded[data.length] = 0x80;
  return padded;
}

function iso9797Unpad(data: Uint8Array): Uint8Array {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] === 0x80) return data.slice(0, i);
    if (data[i] !== 0x00) throw new Error("Invalid ISO 9797 padding");
  }
  throw new Error("Invalid ISO 9797 padding");
}

// --- SCP key derivation (matches ledgerwallet exactly) ---

const SECP256K1_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

async function deriveKey(
  secret: Uint8Array,
  index: number,
  keyLen: number,
): Promise<Uint8Array> {
  let retry = 0;
  while (true) {
    const input = concat(uint32BE(index), new Uint8Array([retry]), secret);
    const md = await sha256(input);
    const privateValue = BigInt(
      "0x" +
        Array.from(md)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
    );
    if (privateValue < SECP256K1_ORDER && privateValue !== 0n) {
      const hexStr = privateValue.toString(16).padStart(64, "0");
      const privKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        privKey[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
      }
      const pubKey = getPublicKeyUncompressed(privKey);
      const hash = await sha256(pubKey);
      return hash.slice(0, keyLen);
    }
    retry++;
  }
}

// --- SCP Session ---

class ScpSession {
  private encKey!: CryptoKey;
  private macKey!: CryptoKey;
  private encIv: Uint8Array = new Uint8Array(BLOCK_SIZE);
  private macIv: Uint8Array = new Uint8Array(BLOCK_SIZE);

  async init(secret: Uint8Array) {
    const encKeyRaw = await deriveKey(secret, 0, 16);
    const macKeyRaw = await deriveKey(secret, 1, 16);
    this.encKey = await importAesKey(encKeyRaw);
    this.macKey = await importAesKey(macKeyRaw);
  }

  async wrap(data: Uint8Array): Promise<Uint8Array> {
    const padded = iso9797Pad(data);
    const { ct: encrypted, newIv: newEncIv } = await aesCbcEncrypt(
      this.encKey,
      this.encIv,
      padded,
    );
    this.encIv = newEncIv;
    const { ct: macData, newIv: newMacIv } = await aesCbcEncrypt(
      this.macKey,
      this.macIv,
      encrypted,
    );
    this.macIv = newMacIv;
    const mac = macData.slice(macData.length - BLOCK_SIZE);
    return concat(encrypted, mac.slice(mac.length - SCP_MAC_LENGTH));
  }

  async unwrap(data: Uint8Array): Promise<Uint8Array> {
    if (data.length === 0) return data;
    const encrypted = data.slice(0, data.length - SCP_MAC_LENGTH);
    const mac = data.slice(data.length - SCP_MAC_LENGTH);
    const { ct: computedMac, newIv: newMacIv } = await aesCbcEncrypt(
      this.macKey,
      this.macIv,
      encrypted,
    );
    this.macIv = newMacIv;
    const expectedMac = computedMac
      .slice(computedMac.length - BLOCK_SIZE)
      .slice(BLOCK_SIZE - SCP_MAC_LENGTH);
    let ok = true;
    for (let i = 0; i < SCP_MAC_LENGTH; i++) {
      if (mac[i] !== expectedMac[i]) ok = false;
    }
    if (!ok) throw new Error("Invalid SCP MAC");
    const { pt: decrypted, newIv: newEncIv } = await aesCbcDecrypt(
      this.encKey,
      this.encIv,
      encrypted,
    );
    this.encIv = newEncIv;
    return iso9797Unpad(decrypted);
  }
}

// --- Certificate roles ---
const CERT_ROLE_SIGNER = 0x01;
const CERT_ROLE_SIGNER_EPHEMERAL = 0x11;

function hexStringToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

type ApduScriptCommand = {
  ins: number;
  payload: Uint8Array;
};

/**
 * Parses a ".apdu" script — one hex-encoded clear-form APDU per line, as
 * produced by an app's build/deploy tooling for `ledgerblue.runScript --scp`
 * — into the secure sub-instruction + payload to replay for each line. Each
 * line's own CLA/INS/P1/P2 header (always 0xE0/0x00/0x00/0x00) is discarded:
 * `secureExchange` reconstructs it when wrapping the payload for replay.
 */
function parseApduScript(content: string): ApduScriptCommand[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const bytes = hexStringToBytes(line);
      if (bytes.length < 6) {
        throw new Error(`Malformed APDU script line: ${line}`);
      }
      const data = bytes.slice(5);
      return { ins: data[0]!, payload: data.slice(1) };
    });
}

/**
 * Sideload an app onto a connected Ledger device by replaying a ".apdu"
 * script over the SCP v2 secure channel. The script (produced by the app's
 * own build/deploy tooling, e.g. `ledgerblue.runScript --scp`) already
 * contains the correct DELETE_APP/CREATE_APP/LOAD/COMMIT calls for that
 * specific app, so no install parameters need to be guessed or supplied
 * separately — only the connected device's target ID is needed.
 */
export async function sideloadApp(
  sendApdu: ApduSender,
  scriptContent: string,
  targetId: number,
  onProgress?: (phase: string, pct: number) => void,
): Promise<void> {
  const commands = parseApduScript(scriptContent);
  if (commands.length === 0) {
    throw new Error("No APDU commands found in the script");
  }

  const masterPrivKey = generatePrivateKey();
  const masterPubKey = getPublicKeyUncompressed(masterPrivKey);

  onProgress?.("Authenticating with device...", 0);

  // Step 0: Validate Target ID (required before authentication)
  checkSw(
    await sendApdu(buildApdu(INS_VALIDATE_TARGET_ID, uint32BE(targetId))),
    "VALIDATE_TARGET_ID",
  );

  // Step 1: Exchange nonces
  const serverNonce = randomBytes(8);
  const initResp = checkSw(
    await sendApdu(buildApdu(INS_INITIALIZE_AUTHENTICATION, serverNonce)),
    "INITIALIZE_AUTHENTICATION",
  );
  const deviceNonce = initResp.slice(4, 12);

  // Step 2: Send server certificate chain
  const dataToSign1 = concat(new Uint8Array([CERT_ROLE_SIGNER]), masterPubKey);
  const masterSig = await signDER(masterPrivKey, dataToSign1);
  const cert1 = concat(serializeTlv(masterPubKey), serializeTlv(masterSig));
  checkSw(
    await sendApdu(buildApdu(INS_VALIDATE_CERTIFICATE, cert1)),
    "VALIDATE_CERTIFICATE[0]",
  );

  const ephemeralPrivKey = generatePrivateKey();
  const ephemeralPubKey = getPublicKeyUncompressed(ephemeralPrivKey);
  const dataToSign2 = concat(
    new Uint8Array([CERT_ROLE_SIGNER_EPHEMERAL]),
    serverNonce,
    deviceNonce,
    ephemeralPubKey,
  );
  const ephemeralSig = await signDER(masterPrivKey, dataToSign2);
  const cert2 = concat(
    serializeTlv(ephemeralPubKey),
    serializeTlv(ephemeralSig),
  );
  checkSw(
    await sendApdu(buildApdu(INS_VALIDATE_CERTIFICATE, cert2, 0x80)),
    "VALIDATE_CERTIFICATE[1]",
  );

  // Step 3: Get device certificate chain
  const devCert0 = checkSw(
    await sendApdu(buildApdu(INS_GET_CERTIFICATE, new Uint8Array(0))),
    "GET_CERTIFICATE[0]",
  );
  const devCert1 = checkSw(
    await sendApdu(buildApdu(INS_GET_CERTIFICATE, new Uint8Array(0), 0x80)),
    "GET_CERTIFICATE[1]",
  );

  // Only the device's ephemeral key is needed for ECDH — skip cert0's permanent key
  const [, cert0Rest] = unserializeTlv(devCert0);
  unserializeTlv(cert0Rest);
  const [, cert1Rest] = unserializeTlv(devCert1);
  const [deviceEphemeralPubKey] = unserializeTlv(cert1Rest);

  // Step 4: Mutual authentication
  checkSw(
    await sendApdu(buildApdu(INS_MUTUAL_AUTHENTICATE, new Uint8Array(0))),
    "MUTUAL_AUTHENTICATE",
  );

  // Step 5-6: Derive shared secret via ECDH and initialize the SCP session
  const sharedSecret = await ecdh(ephemeralPrivKey, deviceEphemeralPubKey);
  const scp = new ScpSession();
  await scp.init(sharedSecret);

  onProgress?.("Secure channel established", 5);

  async function secureExchange(
    ins: number,
    data: Uint8Array,
  ): Promise<Uint8Array> {
    const wrapped = await scp.wrap(concat(new Uint8Array([ins]), data));
    const resp = checkSw(
      await sendApdu(buildApdu(INS_SECUINS, wrapped)),
      `SECURE[0x${ins.toString(16)}]`,
    );
    return resp.length === 0 ? resp : scp.unwrap(resp);
  }

  for (let i = 0; i < commands.length; i++) {
    const { ins, payload } = commands[i]!;
    try {
      await secureExchange(ins, payload);
    } catch (e) {
      // A leading "delete app" command commonly fails when the app isn't
      // already installed — expected on a first install, so don't abort.
      if (ins === SECURE_INS_DELETE_APP) continue;
      throw e;
    }
    onProgress?.(
      "Replaying install script...",
      5 + Math.round(((i + 1) / commands.length) * 93),
    );
  }

  onProgress?.("Installation complete", 100);
}

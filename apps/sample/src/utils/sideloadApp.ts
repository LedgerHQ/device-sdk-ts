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
const SECURE_INS_SET_LOAD_OFFSET = 0x05;
const SECURE_INS_LOAD = 0x06;
const SECURE_INS_FLUSH = 0x07;
const SECURE_INS_CRC = 0x08;
const SECURE_INS_COMMIT = 0x09;
const SECURE_INS_CREATE_APP = 0x0b;
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

function checkSw(resp: Uint8Array, context: string): Uint8Array {
  if (resp.length < 2)
    throw new Error(`${context}: empty response (len=${resp.length})`);
  const sw = (resp[resp.length - 2]! << 8) | resp[resp.length - 1]!;
  if (sw !== 0x9000) {
    throw new Error(
      `${context}: device returned 0x${sw.toString(16).padStart(4, "0")}`,
    );
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

function uint16BE(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, n, false);
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

export type SideloadAppParams = {
  appName: string;
  targetId: number;
  apiLevel: number;
  dataLength: number;
  installParamsSize: number;
  flags: number;
  mainAddress: number;
  /** NVRAM code region size. Auto-derived from the hex file's address span when omitted. */
  codeLength?: number;
};

/**
 * Sideload an app onto a connected Ledger device from raw Intel HEX content,
 * over the SCP v2 secure channel (mirrors ledgerblue's `loadApp`).
 */
export async function sideloadApp(
  sendApdu: ApduSender,
  hexFileContent: string,
  appParams: SideloadAppParams,
  onProgress?: (phase: string, pct: number) => void,
): Promise<void> {
  const segments = parseHexFile(hexFileContent);
  if (segments.length === 0) {
    throw new Error("No data records found in the hex file");
  }
  const codeLength = appParams.codeLength ?? computeCodeLength(segments);

  const masterPrivKey = generatePrivateKey();
  const masterPubKey = getPublicKeyUncompressed(masterPrivKey);

  onProgress?.("Authenticating with device...", 0);

  // Step 0: Validate Target ID (required before authentication)
  checkSw(
    await sendApdu(
      buildApdu(INS_VALIDATE_TARGET_ID, uint32BE(appParams.targetId)),
    ),
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
    data: Uint8Array = new Uint8Array(0),
  ): Promise<Uint8Array> {
    const wrapped = await scp.wrap(concat(new Uint8Array([ins]), data));
    const resp = checkSw(
      await sendApdu(buildApdu(INS_SECUINS, wrapped)),
      `SECURE[0x${ins.toString(16)}]`,
    );
    return resp.length === 0 ? resp : scp.unwrap(resp);
  }

  onProgress?.("Removing old version...", 8);
  try {
    await secureExchange(
      SECURE_INS_DELETE_APP,
      serializeTlv(new TextEncoder().encode(appParams.appName)),
    );
  } catch {
    // App might not exist yet
  }

  const createData = concat(
    new Uint8Array([appParams.apiLevel]),
    uint32BE(codeLength),
    uint32BE(appParams.dataLength),
    uint32BE(appParams.installParamsSize),
    uint32BE(appParams.flags),
    uint32BE(appParams.mainAddress),
  );
  await secureExchange(SECURE_INS_CREATE_APP, createData);

  const totalBytes = segments.reduce((sum, seg) => sum + seg.data.length, 0);
  let loadedBytes = 0;

  const MAX_MTU = 0xf0;
  const HEADER_LEN = 3;
  const MAC_LEN = 14;
  const PAD_LEN = 1;
  let maxChunk = MAX_MTU - HEADER_LEN - PAD_LEN - MAC_LEN;
  maxChunk -= maxChunk % 16;

  for (const seg of segments) {
    await secureExchange(SECURE_INS_SET_LOAD_OFFSET, uint32BE(seg.loadAddress));

    let offset = 0;
    while (offset < seg.data.length) {
      const chunkSize = Math.min(seg.data.length - offset, maxChunk);
      const chunkData = concat(
        uint16BE(offset),
        seg.data.slice(offset, offset + chunkSize),
      );
      await secureExchange(SECURE_INS_LOAD, chunkData);
      offset += chunkSize;
      loadedBytes += chunkSize;
      onProgress?.(
        "Loading firmware...",
        10 + Math.round((loadedBytes / totalBytes) * 85),
      );
    }

    await secureExchange(SECURE_INS_FLUSH);
    const crc = crc16ccitt(seg.data);
    await secureExchange(
      SECURE_INS_CRC,
      concat(uint16BE(0), uint32BE(seg.data.length), uint16BE(crc)),
    );
  }

  onProgress?.("Finalizing...", 98);
  await secureExchange(SECURE_INS_COMMIT);
  onProgress?.("Installation complete", 100);
}

// --- CRC16-CCITT (matching ledgerblue's crc16) ---

const CRC16_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108,
  0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210,
  0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b,
  0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401,
  0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee,
  0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6,
  0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d,
  0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5,
  0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc,
  0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87, 0x4ce4,
  0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd,
  0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13,
  0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a,
  0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e,
  0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1,
  0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb,
  0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d, 0x34e2, 0x24c3, 0x14a0,
  0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8,
  0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657,
  0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9,
  0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882,
  0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e,
  0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07,
  0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d,
  0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
  0x2e93, 0x3eb2, 0x0ed1, 0x1ef0,
];

function crc16ccitt(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) & 0xffff) ^ CRC16_TABLE[((crc >> 8) ^ data[i]!) & 0xff]!;
  }
  return crc;
}

// --- Intel HEX parser ---

type Segment = {
  startAddress: number;
  loadAddress: number;
  data: Uint8Array;
};

function computeCodeLength(segments: Segment[]): number {
  return segments.reduce(
    (max, seg) => Math.max(max, seg.loadAddress + seg.data.length),
    0,
  );
}

function parseHexFile(content: string): Segment[] {
  const lines = content.split("\n").filter((l) => l.startsWith(":"));
  let baseAddress = 0;
  let minAddr = Infinity;

  // Group data records by their extended-address area, matching ledgerblue's
  // IntelHexParser: every extended linear/segment address record starts a new area.
  const areas: {
    base: number;
    records: { addr: number; data: Uint8Array }[];
  }[] = [];
  let currentArea: {
    base: number;
    records: { addr: number; data: Uint8Array }[];
  } | null = null;

  for (const line of lines) {
    const hex = line.slice(1).trim();
    const byteCount = parseInt(hex.substring(0, 2), 16);
    const address = parseInt(hex.substring(2, 6), 16);
    const recordType = parseInt(hex.substring(6, 8), 16);
    const dataHex = hex.substring(8, 8 + byteCount * 2);

    if (recordType === 0x04) {
      baseAddress = parseInt(dataHex, 16) << 16;
      currentArea = { base: baseAddress, records: [] };
      areas.push(currentArea);
    } else if (recordType === 0x02) {
      baseAddress = parseInt(dataHex, 16) << 4;
      currentArea = { base: baseAddress, records: [] };
      areas.push(currentArea);
    } else if (recordType === 0x00) {
      const fullAddr = baseAddress + address;
      if (fullAddr < minAddr) minAddr = fullAddr;
      const data = new Uint8Array(byteCount);
      for (let i = 0; i < byteCount; i++) {
        data[i] = parseInt(dataHex.substring(i * 2, i * 2 + 2), 16);
      }
      if (!currentArea) {
        currentArea = { base: baseAddress, records: [] };
        areas.push(currentArea);
      }
      currentArea.records.push({ addr: fullAddr, data });
    }
  }

  const segments: Segment[] = [];
  for (const area of areas) {
    if (area.records.length === 0) continue;
    area.records.sort((a, b) => a.addr - b.addr);
    const areaStart = area.records[0]!.addr;
    const lastRecord = area.records[area.records.length - 1]!;
    const areaEnd = lastRecord.addr + lastRecord.data.length;
    const areaData = new Uint8Array(areaEnd - areaStart);
    for (const rec of area.records) {
      areaData.set(rec.data, rec.addr - areaStart);
    }
    segments.push({
      startAddress: areaStart,
      loadAddress: areaStart - minAddr,
      data: areaData,
    });
  }

  return segments;
}

import {
  type PcztGlobal,
  type PcztOrchardAction,
  type PcztOrchardBundle,
  type PcztTransaction,
  type PcztTransparentInput,
  type PcztTransparentOutput,
} from "@api/model/PcztTransaction";

/** Deterministic byte array of `length`, every byte set to `fill`. */
export const bytes = (length: number, fill: number): Uint8Array =>
  new Uint8Array(length).fill(fill);

export const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hex, "hex"));

export const bytesToHex = (data: Uint8Array): string =>
  Buffer.from(data).toString("hex");

/** Real Orchard ciphertext sizes from app-zcash `develop` test client. */
export const ORCHARD_ENC_CIPHERTEXT_SIZE = 580;
export const ORCHARD_OUT_CIPHERTEXT_SIZE = 80;

/** Mirrors `PcztGlobal` defaults in app-zcash `tests/application_client/pczt.py`. */
export const SAMPLE_GLOBAL: PcztGlobal = {
  txVersion: 5,
  versionGroupId: 0x26a7270a,
  consensusBranchId: 0xc2d6d0b4,
  fallbackLockTime: 0,
  expiryHeight: 0,
  coinType: 133,
  txModifiable: 0,
};

/**
 * Expected `PCZT_HEADER` payload for {@link SAMPLE_GLOBAL}, computed by hand
 * from `docs/PCZT_APDU.md`: "PCZT" + version(1) + global, all little-endian.
 */
export const SAMPLE_HEADER_HEX =
  "50435a54" + // "PCZT"
  "01000000" + // PCZT version 1
  "05000000" + // tx_version 5
  "0a27a726" + // version_group_id 0x26A7270A LE
  "b4d0d6c2" + // consensus_branch_id 0xC2D6D0B4 LE
  "0100000000" + // fallback_lock_time Option<u32>: present, 0
  "00000000" + // expiry_height 0
  "85000000" + // coin_type 133 LE
  "00"; // tx_modifiable 0

export const sampleTransparentInput = (): PcztTransparentInput => ({
  prevoutTxid: bytes(32, 0x11),
  prevoutIndex: 0,
  sequence: 0xffffffff,
  value: 1000n,
  scriptPubKey: hexToBytes(
    "76a914000000000000000000000000000000000000000088ac",
  ),
  sighashType: 0x01,
  derivation: {
    signingPath: "44'/133'/0'/0/0",
    pubkey: bytes(33, 0x02),
    seedFingerprint: bytes(32, 0x00),
  },
});

export const sampleTransparentOutput = (): PcztTransparentOutput => ({
  value: 900n,
  scriptPubKey: hexToBytes(
    "76a914111111111111111111111111111111111111111188ac",
  ),
  derivation: null,
});

export const sampleOrchardAction = (): PcztOrchardAction => ({
  cvNet: bytes(32, 0x01),
  nullifier: bytes(32, 0x02),
  rk: bytes(32, 0x03),
  spendRecipient: bytes(43, 0x04),
  spendValue: 5n,
  spendRho: bytes(32, 0x05),
  spendRseed: bytes(32, 0x06),
  alpha: bytes(32, 0x07),
  signingPath: "44'/133'/0'",
  seedFingerprint: bytes(32, 0x00),
  cmx: bytes(32, 0x08),
  ephemeralKey: bytes(32, 0x09),
  encCiphertext: bytes(ORCHARD_ENC_CIPHERTEXT_SIZE, 0xaa),
  outCiphertext: bytes(ORCHARD_OUT_CIPHERTEXT_SIZE, 0xbb),
  recipient: bytes(43, 0x0a),
  value: 5n,
  rseed: bytes(32, 0x0b),
  rcv: bytes(32, 0x0c),
});

/**
 * A dummy padding spend (spend value 0). The PCZT IoFinalizer self-signs these
 * host-side, so the device must NOT be asked to sign them.
 */
export const dummyOrchardAction = (): PcztOrchardAction => ({
  ...sampleOrchardAction(),
  spendValue: 0n,
  value: 0n,
});

export const sampleOrchardBundle = (): PcztOrchardBundle => ({
  actions: [sampleOrchardAction()],
  flags: 2,
  valueBalance: 0n,
  anchor: bytes(32, 0x0d),
});

/**
 * Orchard bundle with padding: dummy, real, dummy. Only the real spend
 * (action index 1) is device-signed.
 */
export const mixedDummyOrchardBundle = (): PcztOrchardBundle => ({
  actions: [dummyOrchardAction(), sampleOrchardAction(), dummyOrchardAction()],
  flags: 2,
  valueBalance: 0n,
  anchor: bytes(32, 0x0d),
});

/** Orchard bundle made only of dummy padding spends (no device signature). */
export const allDummyOrchardBundle = (): PcztOrchardBundle => ({
  actions: [dummyOrchardAction(), dummyOrchardAction()],
  flags: 2,
  valueBalance: 0n,
  anchor: bytes(32, 0x0d),
});

/** Public → Public: transparent only, no Orchard bundle. */
export const publicToPublicTransaction = (): PcztTransaction => ({
  global: SAMPLE_GLOBAL,
  transparentInputs: [sampleTransparentInput()],
  transparentOutputs: [sampleTransparentOutput()],
  orchardBundle: null,
});

/** Private → Private: Orchard only, empty transparent sections. */
export const privateToPrivateTransaction = (): PcztTransaction => ({
  global: SAMPLE_GLOBAL,
  transparentInputs: [],
  transparentOutputs: [],
  orchardBundle: sampleOrchardBundle(),
});

/** Public → Private: transparent input spent into an Orchard output. */
export const publicToPrivateTransaction = (): PcztTransaction => ({
  global: SAMPLE_GLOBAL,
  transparentInputs: [sampleTransparentInput()],
  transparentOutputs: [],
  orchardBundle: sampleOrchardBundle(),
});

/** Private → Public: Orchard spend into a transparent output. */
export const privateToPublicTransaction = (): PcztTransaction => ({
  global: SAMPLE_GLOBAL,
  transparentInputs: [],
  transparentOutputs: [sampleTransparentOutput()],
  orchardBundle: sampleOrchardBundle(),
});

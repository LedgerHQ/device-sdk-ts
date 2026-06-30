import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type PcztBip32Derivation,
  type PcztGlobal,
  type PcztOrchardBundle,
  type PcztTransparentInput,
  type PcztTransparentOutput,
} from "@api/model/PcztTransaction";
import {
  PCZT_MAX_PACKET_SIZE,
  PCZT_P1,
  PCZT_P2,
} from "@internal/app-binder/command/utils/apduHeaderUtils";
import { createVarint } from "@internal/app-binder/task/utils/legacyTransactionUtils";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";

/**
 * Byte-exact serialization of the compact PCZT subset the device parses.
 *
 * The field order, sizes and endianness mirror `LedgerHQ/app-zcash`
 * (branch `develop`) `src/parser/pczt/{common,transparent,orchard}.rs` and the
 * `docs/PCZT_APDU.md` contract. PCZT integer fields are little-endian;
 * derivation-path components use the standard big-endian `Bip32Path` encoding.
 *
 * Each `serialize*` function returns the ordered list of *logical* packet
 * payloads for one `PCZT_*` command. The task frames them into APDUs with
 * {@link pcztP1}/{@link pcztP2}. Every logical packet is at most
 * {@link PCZT_MAX_PACKET_SIZE} bytes; large `Vec<u8>` fields (script,
 * ciphertext) are pre-split here.
 */

/** Default ZIP-32 seed fingerprint when the PCZT omits one (32 zero bytes). */
const DEFAULT_SEED_FINGERPRINT = new Uint8Array(32);

/** `path_len u8` followed by big-endian `u32` path components. */
const packDerivationPath = (path: string): Uint8Array => {
  const components = DerivationPathUtils.splitPath(path);
  const builder = new ByteArrayBuilder();
  builder.add8BitUIntToData(components.length);
  components.forEach((component) => builder.add32BitUIntToData(component));
  return builder.build();
};

/** `Option<u32>`: tag `0x00` (absent) or `0x01` + little-endian `u32`. */
const optionalU32 = (value: number | null): Uint8Array => {
  if (value === null) {
    return Uint8Array.of(0x00);
  }
  const builder = new ByteArrayBuilder();
  builder.add8BitUIntToData(0x01);
  builder.add32BitUIntToData(value, false);
  return builder.build();
};

/**
 * A `bip32_derivation` packet:
 * - CompactSize entry count (`0` when absent, else `1`)
 * - if present: compressed pubkey `[33]` + seed fingerprint `[32]` + `Bip32Path`
 */
const bip32DerivationPacket = (
  derivation: PcztBip32Derivation | null | undefined,
): Uint8Array => {
  if (!derivation) {
    return createVarint(0);
  }
  return concatUint8Arrays(
    createVarint(1),
    derivation.pubkey,
    derivation.seedFingerprint ?? DEFAULT_SEED_FINGERPRINT,
    packDerivationPath(derivation.signingPath),
  );
};

/** A `zip32_derivation` packet: seed fingerprint `[32]` + `Bip32Path` (no count). */
const zip32DerivationPacket = (
  signingPath: string,
  seedFingerprint?: Uint8Array,
): Uint8Array =>
  concatUint8Arrays(
    seedFingerprint ?? DEFAULT_SEED_FINGERPRINT,
    packDerivationPath(signingPath),
  );

/**
 * A length-prefixed `Vec<u8>` field, split into ≤ {@link PCZT_MAX_PACKET_SIZE}
 * packets: first packet is `CompactSize length + bytes`, continuations are
 * bytes only.
 */
const fieldPackets = (field: Uint8Array): Uint8Array[] =>
  splitIntoPackets(concatUint8Arrays(createVarint(field.length), field));

/** Split a logical payload into ≤ {@link PCZT_MAX_PACKET_SIZE} byte packets. */
const splitIntoPackets = (payload: Uint8Array): Uint8Array[] => {
  if (payload.length <= PCZT_MAX_PACKET_SIZE) {
    return [payload];
  }
  const packets: Uint8Array[] = [];
  for (
    let offset = 0;
    offset < payload.length;
    offset += PCZT_MAX_PACKET_SIZE
  ) {
    packets.push(payload.subarray(offset, offset + PCZT_MAX_PACKET_SIZE));
  }
  return packets;
};

/** `PCZT_HEADER` payload: magic, PCZT version, then `common::Global`. */
export const serializePcztHeader = (global: PcztGlobal): Uint8Array => {
  const builder = new ByteArrayBuilder();
  builder.addBufferToData(Uint8Array.of(0x50, 0x43, 0x5a, 0x54)); // "PCZT"
  builder.add32BitUIntToData(1, false); // PCZT version
  builder.add32BitUIntToData(global.txVersion, false);
  builder.add32BitUIntToData(global.versionGroupId, false);
  builder.add32BitUIntToData(global.consensusBranchId, false);
  builder.addBufferToData(optionalU32(global.fallbackLockTime));
  builder.add32BitUIntToData(global.expiryHeight, false);
  builder.add32BitUIntToData(global.coinType, false);
  builder.add8BitUIntToData(global.txModifiable);
  return builder.build();
};

/** `PCZT_TRANSPARENT_INPUT` packet sequence. */
export const serializeTransparentInputs = (
  inputs: PcztTransparentInput[],
): Uint8Array[] => {
  const packets: Uint8Array[] = [createVarint(inputs.length)];

  for (const input of inputs) {
    const small = new ByteArrayBuilder();
    small.addBufferToData(input.prevoutTxid);
    small.add32BitUIntToData(input.prevoutIndex, false);
    small.addBufferToData(optionalU32(input.sequence));
    small.add64BitUIntToData(input.value, false);
    packets.push(small.build());

    packets.push(...fieldPackets(input.scriptPubKey));

    packets.push(
      concatUint8Arrays(
        Uint8Array.of(input.sighashType),
        bip32DerivationPacket(input.derivation),
      ),
    );
  }

  return packets;
};

/** `PCZT_TRANSPARENT_OUTPUT` packet sequence. */
export const serializeTransparentOutputs = (
  outputs: PcztTransparentOutput[],
): Uint8Array[] => {
  const packets: Uint8Array[] = [createVarint(outputs.length)];

  for (const output of outputs) {
    const value = new ByteArrayBuilder();
    value.add64BitUIntToData(output.value, false);
    packets.push(value.build());

    packets.push(...fieldPackets(output.scriptPubKey));

    packets.push(bip32DerivationPacket(output.derivation));
  }

  return packets;
};

/** `PCZT_ORCHARD_ACTION` packet sequence (including the trailer). */
export const serializeOrchardActions = (
  bundle: PcztOrchardBundle,
): Uint8Array[] => {
  const packets: Uint8Array[] = [createVarint(bundle.actions.length)];

  if (bundle.actions.length === 0) {
    return packets;
  }

  for (const action of bundle.actions) {
    const spend = new ByteArrayBuilder();
    spend.addBufferToData(action.cvNet);
    spend.addBufferToData(action.nullifier);
    spend.addBufferToData(action.rk);
    spend.addBufferToData(action.spendRecipient);
    spend.add64BitUIntToData(action.spendValue, false);
    spend.addBufferToData(action.spendRho);
    spend.addBufferToData(action.spendRseed);
    spend.addBufferToData(action.alpha);
    packets.push(spend.build());

    packets.push(
      zip32DerivationPacket(action.signingPath, action.seedFingerprint),
    );

    packets.push(concatUint8Arrays(action.cmx, action.ephemeralKey));

    packets.push(...fieldPackets(action.encCiphertext));
    packets.push(...fieldPackets(action.outCiphertext));

    const metadata = new ByteArrayBuilder();
    metadata.addBufferToData(action.recipient);
    metadata.add64BitUIntToData(action.value, false);
    metadata.addBufferToData(action.rseed);
    metadata.addBufferToData(action.rcv);
    packets.push(metadata.build());
  }

  const trailer = new ByteArrayBuilder();
  const valueBalance = bundle.valueBalance;
  trailer.add8BitUIntToData(bundle.flags);
  trailer.add64BitUIntToData(
    valueBalance < 0n ? -valueBalance : valueBalance,
    false,
  );
  trailer.add8BitUIntToData(valueBalance < 0n ? 1 : 0);
  trailer.addBufferToData(bundle.anchor);
  packets.push(trailer.build());

  return packets;
};

/**
 * P1 framing for packet `index` of a `total`-packet command:
 * `FIRST` for the first (or only) packet, `LAST` for the last, else `NEXT`.
 */
export const pcztP1 = (index: number, total: number): number => {
  if (index === 0) {
    return PCZT_P1.FIRST;
  }
  if (index === total - 1) {
    return PCZT_P1.LAST;
  }
  return PCZT_P1.NEXT;
};

/**
 * P2 framing: `FINISHED` only on the last packet of the final bundle command
 * (`ORCHARD_ACTION`), otherwise `CONTINUE`.
 */
export const pcztP2 = (
  index: number,
  total: number,
  finished: boolean,
): number =>
  finished && index === total - 1 ? PCZT_P2.FINISHED : PCZT_P2.CONTINUE;

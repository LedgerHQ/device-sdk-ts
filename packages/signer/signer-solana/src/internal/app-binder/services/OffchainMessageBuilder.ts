import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

import { OffchainMessageBuildError } from "@internal/app-binder/services/Errors";

import { type Bs58Encoder, DefaultBs58Encoder } from "./bs58Encoder";

const DEVICE_V0_PAYLOAD_KB = 15;
const BYTES_PER_KB = 1024;
const DEVICE_V0_PAYLOAD_CEILING = DEVICE_V0_PAYLOAD_KB * BYTES_PER_KB;
const DEVICE_LEGACY_PAYLOAD_CEILING = 1280;
const RESERVED_HEADER_BYTES = 40;
const RESERVED_TRANSPORT_BYTES = 8;

const OFFCHAINMSG_MAX_LEN =
  DEVICE_V0_PAYLOAD_CEILING - RESERVED_HEADER_BYTES - RESERVED_TRANSPORT_BYTES;

export const LEGACY_OFFCHAINMSG_MAX_LEN =
  DEVICE_LEGACY_PAYLOAD_CEILING -
  RESERVED_HEADER_BYTES -
  RESERVED_TRANSPORT_BYTES; // 1232

export const OFFCHAINMSG_MAX_V0_LEN = 65515;

export const OFFCHAINMSG_MAX_V1_LEN = 65535; // 2-byte LE uint16 max

const ED25519_SIGNATURE_LEN = 64;
const SOLANA_PUBKEY_LEN = 32;
const APP_DOMAIN_LEN = 32;
const BYTES_PER_PATH_INDEX = 4;

const MAX_PRINTABLE_ASCII = 0x7e;
const MIN_PRINTABLE_ASCII = 0x20;
const LINE_FEED_ASCII = 0x0a;
const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;

export enum MessageFormat {
  Ascii = 0,
  Utf8 = 1,
  Utf8LongV0 = 2,
}

export class OffchainMessageBuilder {
  constructor(private readonly appDomain?: string) {}

  /**
   * V0 wire format:
   *   signing domain  (16 B): 0xFF + "solana offchain"
   *   version         ( 1 B): 0x00
   *   application domain (32 B): UTF-8, padded/truncated to 32 bytes
   *   format          ( 1 B): 0 = ASCII, 1 = UTF-8, 2 = UTF-8 long
   *   signer count    ( 1 B): 1
   *   signer          (32 B)
   *   message length  ( 2 B): little-endian uint16
   *   message body    (variable)
   */
  buildV0(messageBody: Uint8Array, signerPubkey: Uint8Array): Uint8Array {
    const format = this.findMessageFormat(messageBody, false);
    const builder = new ByteArrayBuilder();

    this._writeSigningDomain(builder);
    builder.add8BitUIntToData(0);

    const domainBytes = new Uint8Array(APP_DOMAIN_LEN);
    if (this.appDomain) {
      const encoded = new TextEncoder().encode(this.appDomain);
      domainBytes.set(encoded.subarray(0, APP_DOMAIN_LEN));
    }
    builder.addBufferToData(domainBytes);

    builder.add8BitUIntToData(format);
    builder.add8BitUIntToData(1);
    builder.addBufferToData(signerPubkey);
    this._writeLeU16(builder, messageBody.length);
    builder.addBufferToData(messageBody);

    return builder.build();
  }

  /**
   * Legacy wire format (compact V0 without appDomain or signer fields):
   *   signing domain  (16 B): 0xFF + "solana offchain"
   *   version         ( 1 B): 0x00
   *   format          ( 1 B)
   *   message length  ( 2 B): little-endian uint16
   *   message body    (variable)
   */
  buildLegacy(messageBody: Uint8Array): Uint8Array {
    const format = this.findMessageFormat(messageBody, true);
    const builder = new ByteArrayBuilder();

    this._writeSigningDomain(builder);
    builder.add8BitUIntToData(0);
    builder.add8BitUIntToData(format);
    this._writeLeU16(builder, messageBody.length);
    builder.addBufferToData(messageBody);

    return builder.build();
  }

  /**
   * V1 wire format (per app-solana parser):
   *   signing domain  (16 B): 0xFF + "solana offchain"
   *   version         ( 1 B): 0x01
   *   signer count    ( 1 B)
   *   signers         (N * 32 B): lexicographically sorted, deduplicated
   *   message length  ( 2 B): little-endian uint16
   *   message body    (variable)
   */
  buildV1(messageBody: Uint8Array, signers: Uint8Array[]): Uint8Array {
    const sorted = this.sortAndDedupeSigners(signers);
    const builder = new ByteArrayBuilder();

    this._writeSigningDomain(builder);
    builder.add8BitUIntToData(1);

    builder.add8BitUIntToData(sorted.length);
    for (const signer of sorted) {
      builder.addBufferToData(signer);
    }

    this._writeLeU16(builder, messageBody.length);
    builder.addBufferToData(messageBody);

    return builder.build();
  }

  buildApduPayload(ocm: Uint8Array, paths: number[]): Uint8Array {
    const builder = new ByteArrayBuilder(
      1 + 1 + paths.length * BYTES_PER_PATH_INDEX + ocm.length,
    );

    builder.add8BitUIntToData(1);
    builder.add8BitUIntToData(paths.length);
    paths.forEach((idx) => builder.add32BitUIntToData(idx));
    builder.addBufferToData(ocm);

    return builder.build();
  }

  buildEnvelopeBase58(
    rawSignature: Uint8Array,
    serializedOCM: Uint8Array,
    encoder: Bs58Encoder = DefaultBs58Encoder,
  ): string {
    if (rawSignature.length !== ED25519_SIGNATURE_LEN) {
      throw new OffchainMessageBuildError(
        `Invalid signature length: ${rawSignature.length} (expected ${ED25519_SIGNATURE_LEN})`,
      );
    }
    const sigCount = Uint8Array.of(1);
    const envelope = new Uint8Array(
      sigCount.length + rawSignature.length + serializedOCM.length,
    );
    envelope.set(sigCount, 0);
    envelope.set(rawSignature, sigCount.length);
    envelope.set(serializedOCM, sigCount.length + rawSignature.length);
    return encoder.encode(envelope);
  }

  sortAndDedupeSigners(signers: Uint8Array[]): Uint8Array[] {
    const sorted = [...signers].sort((a, b) => {
      for (let i = 0; i < SOLANA_PUBKEY_LEN; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

    return sorted.filter(
      (key, idx) =>
        idx === 0 || !sorted[idx - 1]!.every((byte, i) => byte === key[i]),
    );
  }

  findMessageFormat(message: Uint8Array, isLegacy: boolean): MessageFormat {
    const maxLedgerLen = isLegacy
      ? LEGACY_OFFCHAINMSG_MAX_LEN
      : OFFCHAINMSG_MAX_LEN;

    if (message.length <= maxLedgerLen) {
      if (this._isPrintableASCII(message, isLegacy)) return MessageFormat.Ascii;
      if (this._isUTF8(message)) return MessageFormat.Utf8;
    } else if (message.length <= OFFCHAINMSG_MAX_V0_LEN) {
      if (this._isUTF8(message)) return MessageFormat.Utf8LongV0;
    } else {
      throw new OffchainMessageBuildError(
        `Message too long: ${message.length} bytes (max is ${OFFCHAINMSG_MAX_V0_LEN})`,
      );
    }
    throw new OffchainMessageBuildError(
      "Message is not valid printable ASCII or UTF-8",
    );
  }

  private _isPrintableASCII(buf: Uint8Array, isLegacy: boolean): boolean {
    for (let i = 0; i < buf.length; i++) {
      const ch: number = buf[i]!;
      if (!isLegacy && ch === LINE_FEED_ASCII) continue;
      if (ch < MIN_PRINTABLE_ASCII || ch > MAX_PRINTABLE_ASCII) return false;
    }
    return true;
  }

  private _isUTF8(buf: Uint8Array): boolean {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return true;
    } catch {
      return false;
    }
  }

  private _writeSigningDomain(builder: ByteArrayBuilder): void {
    builder
      .add8BitUIntToData(BYTE_MASK)
      .addAsciiStringToData("solana offchain");
  }

  private _writeLeU16(builder: ByteArrayBuilder, value: number): void {
    builder.add8BitUIntToData(value & BYTE_MASK);
    builder.add8BitUIntToData((value >> BITS_PER_BYTE) & BYTE_MASK);
  }
}

import { type Either, Left, Right } from "purify-ts";

import {
  readTlvEntries,
  TlvParseError,
} from "@internal/app-binder/clear-sign/tlv";

import * as K from "./kinds";
import { parseInlinePayload } from "./parsePool";
import {
  fail,
  InvalidVariantPayloadError,
  TruncatedDataError,
  type TypePoolDecoderError,
  TypePoolDecoderThrow,
} from "./TypePoolDecoderError";
import {
  type CachedVariant,
  type VariantCache,
  variantCacheKey,
} from "./types";

// ENUM_VARIANT TLV tags.
const TAG_EV_ENUM_ID = 0x21;
const TAG_EV_VARIANT_INDEX = 0x22;
const TAG_EV_VARIANT_NAME = 0x23;
const TAG_EV_PAYLOAD_KIND = 0x24;
const TAG_EV_PAYLOAD = 0x25;

const textDecoder = new TextDecoder("utf-8");

function readBE(buf: Uint8Array, size: number): number {
  let value = 0;
  for (let i = 0; i < size; i++) {
    value = value * 256 + (buf[i] ?? 0);
  }
  return value;
}

function buildOne(
  tlv: Uint8Array,
): { key: string; variant: CachedVariant } | null {
  const records = readTlvEntries(tlv);
  let enumId: string | undefined;
  let variantIndex: number | undefined;
  let variantName: string | undefined;
  let payloadKind: number | undefined;
  let payload: Uint8Array | undefined;

  for (const { tag, value } of records) {
    switch (tag) {
      case TAG_EV_ENUM_ID:
        enumId = textDecoder.decode(value);
        break;
      case TAG_EV_VARIANT_INDEX:
        variantIndex = readBE(value, value.length);
        break;
      case TAG_EV_VARIANT_NAME:
        variantName = textDecoder.decode(value);
        break;
      case TAG_EV_PAYLOAD_KIND:
        payloadKind = value.length > 0 ? value[0] : undefined;
        break;
      case TAG_EV_PAYLOAD:
        payload = value;
        break;
      default:
        break; // ignore PROGRAM_ID, STRUCT_TYPE/VERSION, SIGNATURE, etc.
    }
  }

  if (
    enumId === undefined ||
    variantIndex === undefined ||
    payloadKind === undefined
  ) {
    return null; // incomplete record — skip leniently
  }
  const name = variantName ?? `variant_${variantIndex}`;
  const key = variantCacheKey(enumId, variantIndex);

  if (payloadKind === K.VARIANT_PAYLOAD_EMPTY) {
    return {
      key,
      variant: { variantName: name, kind: K.VARIANT_PAYLOAD_EMPTY },
    };
  }
  if (payloadKind === K.VARIANT_PAYLOAD_INLINE) {
    if (payload === undefined) return null;
    const parsed = parseInlinePayload(payload);
    return {
      key,
      variant: {
        variantName: name,
        kind: K.VARIANT_PAYLOAD_INLINE,
        payload: parsed,
      },
    };
  }
  if (payloadKind === K.VARIANT_PAYLOAD_RAW_SIZE) {
    if (payload === undefined || payload.length < 2) return null;
    return {
      key,
      variant: {
        variantName: name,
        kind: K.VARIANT_PAYLOAD_RAW_SIZE,
        size: readBE(payload.subarray(0, 2), 2),
      },
    };
  }
  fail(
    new InvalidVariantPayloadError(
      `unknown payload kind 0x${payloadKind.toString(16).padStart(2, "0")}`,
    ),
  );
}

/**
 * Build the decoder's {@link VariantCache} from a program's `ENUM_VARIANT`
 * descriptors (one raw TLV per variant).
 *
 * Structurally-malformed TLV framing (truncated records / lengths) surfaces as
 * a typed {@link TypePoolDecoderError} `Left`; semantically-incomplete records (missing
 * mandatory tags) are skipped leniently. Later entries win on duplicate keys.
 */
export function buildEnumCache(
  variantTlvs: readonly Uint8Array[],
): Either<TypePoolDecoderError, VariantCache> {
  try {
    const cache = new Map<string, CachedVariant>();
    for (const tlv of variantTlvs) {
      const built = buildOne(tlv);
      if (built !== null) {
        cache.set(built.key, built.variant);
      }
    }
    return Right(cache);
  } catch (error) {
    if (error instanceof TypePoolDecoderThrow) {
      return Left(error.error);
    }
    if (error instanceof TlvParseError) {
      return Left(new TruncatedDataError(error.message));
    }
    return Left(
      new InvalidVariantPayloadError(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
}

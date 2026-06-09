/**
 * Byte-level builders for the CAL substructure / INSTRUCTION_INFO TLVs the
 * requirement builder consumes. Deliberately dumb so tests pin exact bytes.
 */

export function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function derLength(length: number): Uint8Array {
  if (length < 0x80) return bytes(length);
  if (length <= 0xff) return bytes(0x81, length);
  return bytes(0x82, (length >> 8) & 0xff, length & 0xff);
}

/** One DER-style `tag || length || value` record. */
export function tlv(tag: number, value: Uint8Array): Uint8Array {
  return concat(bytes(tag), derLength(value.length), value);
}

// ---- VALUE + TOKEN_VALUE --------------------------------------------------

export function value(source: number, payload: Uint8Array): Uint8Array {
  return concat(tlv(0x01, bytes(source)), tlv(0x02, payload));
}

export function tokenValue(
  kind: number,
  opts: { value?: Uint8Array; accountIndex?: number } = {},
): Uint8Array {
  const parts = [tlv(0x01, bytes(kind))];
  if (opts.value) parts.push(tlv(0x02, opts.value));
  if (opts.accountIndex !== undefined)
    parts.push(tlv(0x03, bytes(opts.accountIndex)));
  return concat(...parts);
}

// ---- substructure values --------------------------------------------------

export function valueFlowPort(opts: {
  /** Single candidate; convenience for the common single-account port. */
  accountIndex?: number;
  /** Ordered candidate list (overrides `accountIndex`); ACCOUNT_INDEX repeats. */
  accountIndices?: number[];
  /** `OPTIONAL_ACCOUNT_STRATEGY` byte (omitted when undefined). */
  optionalAccountStrategy?: number;
  tokenValue?: Uint8Array;
}): Uint8Array {
  const indices =
    opts.accountIndices ??
    (opts.accountIndex !== undefined ? [opts.accountIndex] : []);
  const parts = indices.map((index) => tlv(0x02, bytes(index)));
  if (opts.optionalAccountStrategy !== undefined)
    parts.push(tlv(0x07, bytes(opts.optionalAccountStrategy)));
  if (opts.tokenValue) parts.push(tlv(0x05, opts.tokenValue));
  return concat(...parts);
}

export function accountReset(opts: {
  accountIndex: number;
  requirePreBalanceZero?: boolean;
}): Uint8Array {
  return concat(
    tlv(0x01, bytes(opts.accountIndex)),
    tlv(0x02, bytes(opts.requirePreBalanceZero ? 1 : 0)),
  );
}

/** DISPLAY_FIELD with PARAM_TRUSTED_NAME (param type 0x07) wrapping a VALUE. */
export function trustedNameDisplayField(valueBytes: Uint8Array): Uint8Array {
  return concat(tlv(0x02, bytes(0x07)), tlv(0x03, tlv(0x01, valueBytes)));
}

/**
 * DISPLAY_FIELD with PARAM_TOKEN_AMOUNT (param type 0x02). The TOKEN reference
 * is a VALUE at PARAM tag 0x02; a sibling VALUE (tag 0x01) is included so the
 * builder mirrors real descriptors.
 */
export function tokenAmountDisplayField(
  tokenValueBytes: Uint8Array,
): Uint8Array {
  return concat(
    tlv(0x02, bytes(0x02)),
    tlv(
      0x03,
      concat(tlv(0x01, value(0x00, bytes(0))), tlv(0x02, tokenValueBytes)),
    ),
  );
}

export function instructionInfo(opts: {
  typePool: Uint8Array;
  rootType: number;
  mintAssociations?: { accountIndex: number; mintIndex: number }[];
}): Uint8Array {
  const parts = [tlv(0x06, opts.typePool), tlv(0x07, bytes(opts.rootType))];
  for (const { accountIndex, mintIndex } of opts.mintAssociations ?? []) {
    parts.push(tlv(0x08, bytes(accountIndex)), tlv(0x09, bytes(mintIndex)));
  }
  return concat(...parts);
}

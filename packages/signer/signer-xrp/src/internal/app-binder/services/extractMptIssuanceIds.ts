const ISSUANCE_ID_LENGTH = 24;

const TYPE_UINT16 = 1;
const TYPE_UINT32 = 2;
const TYPE_UINT64 = 3;
const TYPE_HASH128 = 4;
const TYPE_HASH256 = 5;
const TYPE_AMOUNT = 6;
const TYPE_BLOB = 7;
const TYPE_ACCOUNT_ID = 8;
const TYPE_NUMBER = 9;
const TYPE_INT32 = 10;
const TYPE_INT64 = 11;
const TYPE_OBJECT = 14;
const TYPE_ARRAY = 15;
const TYPE_UINT8 = 16;
const TYPE_HASH160 = 17;
const TYPE_PATH_SET = 18;
const TYPE_VECTOR256 = 19;
const TYPE_UINT96 = 20;
const TYPE_HASH192 = 21;

const FIXED_SIZES: Record<number, number> = {
  [TYPE_UINT16]: 2,
  [TYPE_UINT32]: 4,
  [TYPE_UINT64]: 8,
  [TYPE_HASH128]: 16,
  [TYPE_HASH256]: 32,
  [TYPE_NUMBER]: 12,
  [TYPE_INT32]: 4,
  [TYPE_INT64]: 8,
  [TYPE_UINT8]: 1,
  [TYPE_HASH160]: 20,
  [TYPE_UINT96]: 12,
  [TYPE_HASH192]: 24,
};

/** `Amount`, `SendMax` and `DeliverMin`. */
const MPT_AMOUNT_FIELDS = [1, 9, 10];
/** `MPTokenIssuanceID`. */
const ISSUANCE_ID_FIELD = 1;

/** End markers: `ObjectEndMarker` (14, 1) and `ArrayEndMarker` (15, 1). */
const OBJECT_END = 0xe1;
const ARRAY_END = 0xf1;

class Reader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset >= this.bytes.length;
  }

  peek(): number {
    return this.byte(this.offset);
  }

  read(length: number): Uint8Array {
    if (this.offset + length > this.bytes.length) {
      throw new Error("Unexpected end of transaction");
    }
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readByte(): number {
    return this.read(1)[0]!;
  }

  private byte(index: number): number {
    if (index >= this.bytes.length) {
      throw new Error("Unexpected end of transaction");
    }
    return this.bytes[index]!;
  }
}

const readFieldId = (reader: Reader): { type: number; field: number } => {
  const header = reader.readByte();
  let type = header >> 4;
  let field = header & 0x0f;
  if (type === 0) type = reader.readByte();
  if (field === 0) field = reader.readByte();
  return { type, field };
};

const readLength = (reader: Reader): number => {
  const b1 = reader.readByte();
  if (b1 <= 192) return b1;
  if (b1 <= 240) return 193 + (b1 - 193) * 256 + reader.readByte();
  if (b1 <= 254) {
    const b2 = reader.readByte();
    return 12481 + (b1 - 241) * 65536 + b2 * 256 + reader.readByte();
  }
  throw new Error("Invalid length prefix");
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

/** Returns the issuance ID of an MPT amount, `undefined` for XRP or an IOU. */
const readAmount = (reader: Reader): string | undefined => {
  const first = reader.peek();
  if (first & 0x80) {
    reader.read(48);
    return undefined;
  }
  if (first & 0x20) {
    return toHex(reader.read(33).slice(9));
  }
  reader.read(8);
  return undefined;
};

const skipPathSet = (reader: Reader): void => {
  for (;;) {
    const step = reader.readByte();
    if (step === 0x00) return;
    if (step === 0xff) continue;
    if (step & 0x01) reader.read(20);
    if (step & 0x10) reader.read(20);
    if (step & 0x20) reader.read(20);
  }
};

const skipValue = (reader: Reader, type: number): void => {
  const size = FIXED_SIZES[type];
  if (size !== undefined) {
    reader.read(size);
    return;
  }
  switch (type) {
    case TYPE_AMOUNT:
      readAmount(reader);
      return;
    case TYPE_BLOB:
    case TYPE_ACCOUNT_ID:
    case TYPE_VECTOR256:
      reader.read(readLength(reader));
      return;
    case TYPE_OBJECT:
      while (reader.peek() !== OBJECT_END) {
        skipValue(reader, readFieldId(reader).type);
      }
      reader.readByte();
      return;
    case TYPE_ARRAY:
      while (reader.peek() !== ARRAY_END) {
        skipValue(reader, readFieldId(reader).type);
      }
      reader.readByte();
      return;
    case TYPE_PATH_SET:
      skipPathSet(reader);
      return;
    default:
      throw new Error(`Unsupported field type ${type}`);
  }
};

/**
 * Reads the issuance IDs of the MPTs a serialized transaction uses: the MPT
 * amounts of `Amount`, `SendMax` and `DeliverMin`, and `MPTokenIssuanceID`.
 *
 * Canonical serialization sorts the fields by type, so the scan stops after
 * `Hash192`, the type of `MPTokenIssuanceID`. Fields of a later type are never
 * read. A transaction it cannot read gives no ID: the app then reviews it
 * without a descriptor.
 */
export const extractMptIssuanceIds = (transaction: Uint8Array): string[] => {
  const ids = new Set<string>();
  const reader = new Reader(transaction);

  try {
    while (!reader.done) {
      const { type, field } = readFieldId(reader);
      if (type > TYPE_HASH192) break;

      if (type === TYPE_AMOUNT && MPT_AMOUNT_FIELDS.includes(field)) {
        const id = readAmount(reader);
        if (id !== undefined) ids.add(id);
      } else if (type === TYPE_HASH192 && field === ISSUANCE_ID_FIELD) {
        ids.add(toHex(reader.read(ISSUANCE_ID_LENGTH)));
      } else {
        skipValue(reader, type);
      }
    }
  } catch (_error) {
    return [];
  }

  return [...ids];
};

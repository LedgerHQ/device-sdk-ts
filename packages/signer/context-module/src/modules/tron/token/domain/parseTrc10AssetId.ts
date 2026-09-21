/**
 * Extracts the TRC10 asset id from a serialized Tron `Transaction.raw`.
 *
 * The asset id travels in the transaction itself, so a TRC10 transfer is
 * recognisable without the caller naming the token.
 *
 * Field numbers follow app-tron's `proto/core/Tron.proto` and
 * `proto/core/Contract.proto`.
 */

const CONTRACT_FIELD = 11; // Transaction.raw.contract
const CONTRACT_TYPE_FIELD = 1; // Transaction.Contract.type
const CONTRACT_PARAMETER_FIELD = 2; // Transaction.Contract.parameter
const ANY_VALUE_FIELD = 2; // google.protobuf.Any.value
const ASSET_NAME_FIELD = 1; // TransferAssetContract.asset_name

const TRANSFER_ASSET_CONTRACT = 2; // Transaction.Contract.ContractType

const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_32BIT = 5;

const MAX_VARINT_BYTES = 10;
const ASCII_ZERO = 0x30;
const ASCII_NINE = 0x39;

type Varint = { value: number; next: number };

type ProtobufField = {
  fieldNumber: number;
  wireType: number;
  data?: Uint8Array;
  value?: number;
  next: number;
};

/**
 * Values above 2^53 lose precision, which is harmless here: the only decoded
 * value ever compared is the contract type, and oversized varints (amounts,
 * timestamps) are read solely to know where the next field starts.
 */
function readVarint(bytes: Uint8Array, offset: number): Varint | undefined {
  let value = 0;
  let shift = 1;
  for (let i = 0; i < MAX_VARINT_BYTES; i++) {
    const byte = bytes[offset + i];
    if (byte === undefined) return undefined;
    value += (byte & 0x7f) * shift;
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 };
    shift *= 128;
  }
  return undefined;
}

function readField(
  bytes: Uint8Array,
  offset: number,
): ProtobufField | undefined {
  const key = readVarint(bytes, offset);
  if (key === undefined) return undefined;

  const fieldNumber = Math.floor(key.value / 8);
  const wireType = key.value % 8;

  switch (wireType) {
    case WIRE_VARINT: {
      const varint = readVarint(bytes, key.next);
      if (varint === undefined) return undefined;
      return { fieldNumber, wireType, value: varint.value, next: varint.next };
    }
    case WIRE_LENGTH_DELIMITED: {
      const length = readVarint(bytes, key.next);
      if (length === undefined) return undefined;
      const end = length.next + length.value;
      if (end > bytes.length) return undefined;
      return {
        fieldNumber,
        wireType,
        data: bytes.subarray(length.next, end),
        next: end,
      };
    }
    case WIRE_64BIT:
    case WIRE_32BIT: {
      const end = key.next + (wireType === WIRE_64BIT ? 8 : 4);
      if (end > bytes.length) return undefined;
      return { fieldNumber, wireType, next: end };
    }
    default:
      return undefined;
  }
}

function findLengthDelimited(
  bytes: Uint8Array,
  fieldNumber: number,
): Uint8Array | undefined {
  let offset = 0;
  while (offset < bytes.length) {
    const field = readField(bytes, offset);
    if (field === undefined) return undefined;
    if (field.fieldNumber === fieldNumber && field.data !== undefined) {
      return field.data;
    }
    offset = field.next;
  }
  return undefined;
}

function findVarint(
  bytes: Uint8Array,
  fieldNumber: number,
): number | undefined {
  let offset = 0;
  while (offset < bytes.length) {
    const field = readField(bytes, offset);
    if (field === undefined) return undefined;
    if (field.fieldNumber === fieldNumber && field.wireType === WIRE_VARINT) {
      return field.value;
    }
    offset = field.next;
  }
  return undefined;
}

/**
 * Returns the TRC10 asset id, or `undefined` when the transaction is not a
 * TRC10 transfer. Native TRX rides on the same contract with an `_` asset
 * name, and is rejected here along with any malformed payload.
 */
export function parseTrc10AssetId(
  rawTransaction: Uint8Array,
): string | undefined {
  const contract = findLengthDelimited(rawTransaction, CONTRACT_FIELD);
  if (contract === undefined) return undefined;

  if (findVarint(contract, CONTRACT_TYPE_FIELD) !== TRANSFER_ASSET_CONTRACT) {
    return undefined;
  }

  const parameter = findLengthDelimited(contract, CONTRACT_PARAMETER_FIELD);
  if (parameter === undefined) return undefined;

  const value = findLengthDelimited(parameter, ANY_VALUE_FIELD);
  if (value === undefined) return undefined;

  const assetName = findLengthDelimited(value, ASSET_NAME_FIELD);
  if (assetName === undefined || assetName.length === 0) return undefined;

  const isAssetId = assetName.every(
    (byte) => byte >= ASCII_ZERO && byte <= ASCII_NINE,
  );
  if (!isAssetId) return undefined;

  return String.fromCharCode(...assetName);
}

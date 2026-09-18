const CONTRACT_FIELD = 11;
const CONTRACT_TYPE_FIELD = 1;
const CONTRACT_PARAMETER_FIELD = 2;
const ANY_VALUE_FIELD = 2;

const TRANSFER_CONTRACT = 1;
const TRANSFER_ASSET_CONTRACT = 2;
const TRIGGER_SMART_CONTRACT = 31;

const TRANSFER_RECIPIENT_FIELD = 2;
const TRANSFER_ASSET_RECIPIENT_FIELD = 3;
const SMART_CONTRACT_RECIPIENT_FIELD = 2;

const WIRE_VARINT = 0;
const WIRE_64BIT = 1;
const WIRE_LENGTH_DELIMITED = 2;
const WIRE_32BIT = 5;
const MAX_VARINT_BYTES = 10;

type ProtobufField = {
  fieldNumber: number;
  wireType: number;
  data?: Uint8Array;
  value?: number;
  next: number;
};

function readVarint(
  bytes: Uint8Array,
  offset: number,
): { value: number; next: number } | undefined {
  let value = 0;
  let shift = 1;
  for (let index = 0; index < MAX_VARINT_BYTES; index++) {
    const byte = bytes[offset + index];
    if (byte === undefined) return undefined;
    value += (byte & 0x7f) * shift;
    if ((byte & 0x80) === 0) {
      return { value, next: offset + index + 1 };
    }
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
  if (wireType === WIRE_VARINT) {
    const value = readVarint(bytes, key.next);
    return value === undefined
      ? undefined
      : { fieldNumber, wireType, value: value.value, next: value.next };
  }
  if (wireType === WIRE_LENGTH_DELIMITED) {
    const length = readVarint(bytes, key.next);
    if (length === undefined) return undefined;
    const end = length.next + length.value;
    return end > bytes.length
      ? undefined
      : {
          fieldNumber,
          wireType,
          data: bytes.subarray(length.next, end),
          next: end,
        };
  }
  if (wireType === WIRE_64BIT || wireType === WIRE_32BIT) {
    const end = key.next + (wireType === WIRE_64BIT ? 8 : 4);
    return end > bytes.length
      ? undefined
      : { fieldNumber, wireType, next: end };
  }
  return undefined;
}

function findField(
  bytes: Uint8Array,
  fieldNumber: number,
): ProtobufField | undefined {
  let offset = 0;
  while (offset < bytes.length) {
    const field = readField(bytes, offset);
    if (field === undefined) return undefined;
    if (field.fieldNumber === fieldNumber) return field;
    offset = field.next;
  }
  return undefined;
}

export function extractTransactionRecipient(
  rawTransaction: Uint8Array,
): Uint8Array | undefined {
  const contract = findField(rawTransaction, CONTRACT_FIELD)?.data;
  if (contract === undefined) return undefined;

  const contractType = findField(contract, CONTRACT_TYPE_FIELD)?.value;
  const parameter = findField(contract, CONTRACT_PARAMETER_FIELD)?.data;
  if (parameter === undefined) return undefined;

  const value = findField(parameter, ANY_VALUE_FIELD)?.data;
  if (value === undefined) return undefined;

  const recipientField =
    contractType === TRANSFER_CONTRACT
      ? TRANSFER_RECIPIENT_FIELD
      : contractType === TRANSFER_ASSET_CONTRACT
        ? TRANSFER_ASSET_RECIPIENT_FIELD
        : contractType === TRIGGER_SMART_CONTRACT
          ? SMART_CONTRACT_RECIPIENT_FIELD
          : undefined;
  if (recipientField === undefined) return undefined;

  return findField(value, recipientField)?.data;
}

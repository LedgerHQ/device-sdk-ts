import { extractTransactionRecipient } from "./extractTransactionRecipient";

const RECIPIENT = new Uint8Array(21).fill(0x22);

function concat(...values: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(
    values.reduce((length, value) => length + value.length, 0),
  );
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function varint(value: number): Uint8Array {
  const bytes: number[] = [];
  do {
    const part = value & 0x7f;
    value >>>= 7;
    bytes.push(value === 0 ? part : part | 0x80);
  } while (value !== 0);
  return Uint8Array.from(bytes);
}

function lengthDelimited(fieldNumber: number, value: Uint8Array): Uint8Array {
  return concat(varint(fieldNumber * 8 + 2), varint(value.length), value);
}

function transaction(contractType: number, recipientField: number): Uint8Array {
  const contractValue = lengthDelimited(recipientField, RECIPIENT);
  const parameter = lengthDelimited(2, contractValue);
  const contract = concat(
    varint(1 * 8),
    varint(contractType),
    lengthDelimited(2, parameter),
  );
  return lengthDelimited(11, contract);
}

describe("extractTransactionRecipient", () => {
  it.each([
    ["TransferContract", 1, 2],
    ["TransferAssetContract", 2, 3],
    ["TriggerSmartContract", 31, 2],
  ])("extracts the recipient from %s", (_name, contractType, fieldNumber) => {
    expect(
      extractTransactionRecipient(transaction(contractType, fieldNumber)),
    ).toStrictEqual(RECIPIENT);
  });

  it("returns undefined for an unsupported contract", () => {
    expect(extractTransactionRecipient(transaction(4, 2))).toBeUndefined();
  });

  it("returns undefined for a truncated transaction", () => {
    const complete = transaction(1, 2);

    expect(
      extractTransactionRecipient(complete.subarray(0, -1)),
    ).toBeUndefined();
  });
});

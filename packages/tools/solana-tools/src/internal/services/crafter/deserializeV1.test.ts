import { address } from "@solana/addresses";
import { blockhash } from "@solana/rpc-types";
import {
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/transaction-messages";

// AccountRole.WRITABLE (from @solana/instructions: READONLY=0, WRITABLE=1,
// READONLY_SIGNER=2, WRITABLE_SIGNER=3).
const WRITABLE_ROLE = 1;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

vi.mock("@ledgerhq/device-management-kit", () => ({
  base64StringToBuffer: (value: string): Uint8Array | null => {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return null;
    return fromBase64(value);
  },
}));

import { deserializeV1ToMessage } from "./deserializeV1";

const payer = address("2cHm11EeTGQixAkyaqNRFczpi1XB1n6rK7bSwNiZbCdB");
const recipient = address("7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2");
const program = address("11111111111111111111111111111111");
const recentBlockhash = blockhash(
  "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg",
);

function buildV1MessageBytes(): Uint8Array {
  const withFeePayer = setTransactionMessageFeePayer(
    payer,
    createTransactionMessage({ version: 1 }),
  );
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash(
    { blockhash: recentBlockhash, lastValidBlockHeight: 1000n },
    withFeePayer,
  );
  const withInstructions = appendTransactionMessageInstructions(
    [
      {
        programAddress: program,
        accounts: [{ address: recipient, role: WRITABLE_ROLE }],
        data: new Uint8Array([2, 0, 0, 0, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]),
      },
    ],
    withLifetime,
  );

  return new Uint8Array(
    getCompiledTransactionMessageEncoder().encode(
      compileTransactionMessage(withInstructions),
    ),
  );
}

describe("deserializeV1ToMessage", () => {
  it("deserializes a bare v1 message and exposes its instructions", () => {
    const bytes = buildV1MessageBytes();

    const message = deserializeV1ToMessage(toBase64(bytes));

    expect(message.version).toBe(1);
    expect(message.feePayer.address).toBe(payer);
    expect(message.instructions).toHaveLength(1);
    expect(message.instructions[0]!.programAddress).toBe(program);
  });

  it("deserializes a v1 message with trailing (unrelated) bytes appended, ignoring them", () => {
    const messageBytes = buildV1MessageBytes();
    // Simulate a full-wire transaction: message + a signature-sized tail.
    // deserializeV1ToMessage never needs to distinguish this from a bare
    // message — craft always drops signatures regardless.
    const withTrailingBytes = new Uint8Array(messageBytes.length + 64);
    withTrailingBytes.set(messageBytes, 0);
    withTrailingBytes.fill(0xab, messageBytes.length);

    const message = deserializeV1ToMessage(toBase64(withTrailingBytes));

    expect(message.version).toBe(1);
    expect(message.feePayer.address).toBe(payer);
  });

  it("throws on input that is not valid base64", () => {
    expect(() => deserializeV1ToMessage("!!!not base64!!!")).toThrow(
      "Input is not a valid base64 string.",
    );
  });

  it("throws on base64 that does not decode as a v1 message", () => {
    const garbage = toBase64(new Uint8Array([0xff, 0xff, 0xff, 0xff]));

    expect(() => deserializeV1ToMessage(garbage)).toThrow(
      "Input is neither a valid serialized v1 message nor a valid serialized v1 transaction.",
    );
  });

  it("throws on a legacy/v0 message (wrong version byte)", () => {
    const legacyLikeBytes = new Uint8Array([1, 0, 3, 0xaa, 0xbb]);

    expect(() => deserializeV1ToMessage(toBase64(legacyLikeBytes))).toThrow();
  });
});

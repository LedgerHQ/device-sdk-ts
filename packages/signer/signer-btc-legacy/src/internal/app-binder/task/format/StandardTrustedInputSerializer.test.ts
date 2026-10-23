import { type LegacyTransaction } from "@api/model/CreateTransactionArg";

import { StandardTrustedInputSerializer } from "./StandardTrustedInputSerializer";

describe("StandardTrustedInputSerializer", () => {
  const transaction: LegacyTransaction = {
    version: Uint8Array.of(0x02, 0x00, 0x00, 0x00),
    inputs: [],
    outputs: [],
    locktime: Uint8Array.of(0x01, 0x02, 0x03, 0x04),
  };

  it("should end with the lock time", () => {
    const chunks = new StandardTrustedInputSerializer().serialize(transaction);

    expect(chunks.at(-1)).toStrictEqual(transaction.locktime);
  });

  it("should send the extra data with its length after the lock time, in 50-byte blocks", () => {
    const extraData = new Uint8Array(60).fill(0xaa);

    const chunks = new StandardTrustedInputSerializer().serialize({
      ...transaction,
      extraData,
    });

    const end = Uint8Array.of(0x01, 0x02, 0x03, 0x04, 60, ...extraData);
    expect(chunks.slice(-2)).toStrictEqual([
      end.subarray(0, 50),
      end.subarray(50),
    ]);
  });
});

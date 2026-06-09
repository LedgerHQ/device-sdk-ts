import { ZcashSaplingOutputCommitCommand } from "./ZcashSaplingOutputCommitCommand";

describe("ZcashSaplingOutputCommitCommand", () => {
  it("matches Ledger Wallet apduRecordStoreFromLogs short SIGN after HASH_OUTPUT_FULL", () => {
    const command = new ZcashSaplingOutputCommitCommand({
      lockTime: 0,
      sigHashType: 1,
      expiryHeight: Buffer.alloc(4, 0),
    });

    expect(Buffer.from(command.getApdu().getRawApdu()).toString("hex")).toBe(
      "e04800000b0000000000000100000000",
    );
  });
});

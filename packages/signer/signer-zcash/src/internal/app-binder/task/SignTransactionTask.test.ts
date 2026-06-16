import {
  CommandResultFactory,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { HashOutputFullCommand } from "@internal/app-binder/command/HashOutputFullCommand";
import { ProvideOutputFullChangePathCommand } from "@internal/app-binder/command/ProvideOutputFullChangePathCommand";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { StartUntrustedHashTransactionInputCommand } from "@internal/app-binder/command/StartUntrustedHashTransactionInputCommand";
import { ZcashSaplingOutputCommitCommand } from "@internal/app-binder/command/ZcashSaplingOutputCommitCommand";
import {
  createPaymentTransactionArgsFromLogs,
  expectedSignedTransactionHexFromLogs,
  ledgerWalletLog20260511LegacyPreviousTransaction,
  signTransactionFromLedgerWalletLogs20260511,
  trustedInputHexFromLogs,
} from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-05-11";
import { signTransactionFromLedgerWalletLogs20260512 } from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-05-12";
import { signTransactionFromLedgerWalletLogs20260615 } from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-06-15";
import { GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
import * as legacyTransactionUtils from "@internal/app-binder/task/utils/legacyTransactionUtils";

import { SignTransactionTask } from "./SignTransactionTask";

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hex, "hex"));

/** Pushed ECDSA blob from `expectedSignedTransactionHexFromLogs` (same as device). */
const LEDGER_WALLET_LOG_20260511_INPUT_SIGNATURE = hexToBytes(
  "30440220673139ab50de3fb7af1e7436fbcde38c2afe3751b090dc09c390e07a704e91a902200514b0e2c8b49c8e0ce7988e065ed06d8245631f9d0577cb041fb4a5f5a985a801",
);

type SendCommandCall = Parameters<InternalApi["sendCommand"]>;

const PREVIOUS_TRANSACTION = {
  version: new Uint8Array([0x05, 0x00, 0x00, 0x80]),
  nVersionGroupId: new Uint8Array([0x0a, 0x27, 0xa7, 0x26]),
  consensusBranchId: new Uint8Array([0xf0, 0x4d, 0xec, 0x4d]),
  locktime: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
  nExpiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
  inputs: [
    {
      prevout: new Uint8Array(36).fill(0x11),
      script: new Uint8Array([]),
      sequence: new Uint8Array([0xff, 0xff, 0xff, 0xff]),
    },
  ],
  outputs: [
    {
      amount: new Uint8Array([0x01, 0, 0, 0, 0, 0, 0, 0]),
      script: new Uint8Array([0x51]),
    },
  ],
};

const ZCASH_SAPLING_TX1 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [
    {
      prevout: hexToBytes(
        "1d73f1a467297aab205ee7a4ed506f28ea558056401b4f6d308016c1b58d27f401000000",
      ),
      script: hexToBytes(
        "4730440220337050efe67689fdbdccd2058f6f7b7fe3b13070d91cd0d7ecb1f84e622a220b02201356d33259d64db1095879cfce666b016771cf4e239376497b7f82efedd9c54a01210396fcfd94e1bfb2949e0acbab934583c11ad29d14105d25528aff75673c50650c",
      ),
      sequence: hexToBytes("00000000"),
    },
  ],
  outputs: [
    {
      amount: hexToBytes("50c3000000000000"),
      script: hexToBytes("76a914de3542c396924ada3c5850225770f6dd3e2249b988ac"),
    },
    {
      amount: hexToBytes("3df2c20200000000"),
      script: hexToBytes("76a914fc0da061ca85923e01d97ac276aa8dc890a28efa88ac"),
    },
  ],
};

const ZCASH_SAPLING_TX2 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [
    {
      prevout: hexToBytes(
        "8c63f70704d9987dafffc5481b171dee900e9b6d71261fee880543bc96c41d1100000000",
      ),
      script: hexToBytes(
        "48304502210098a92ce696ff51d46233885e5ea7d0bc0bcd04621c6d79e4230e579f9b13f1480220772d04b65133859ef7fb146a41080b1187335fed9daf62a237b6bd54657f555d0121039402a22682e936ab3c1e2f649859ba13b39a59bd74212ac903a42b5aea503279",
      ),
      sequence: hexToBytes("00000000"),
    },
  ],
  outputs: [
    {
      amount: hexToBytes("404b4c0000000000"),
      script: hexToBytes("76a914c59ace9b52af703379f3f89ebbc8ec1813ca50ec88ac"),
    },
    {
      amount: hexToBytes("0e532a0000000000"),
      script: hexToBytes("76a9144cd6509f71020b6a9e890bef43c4d5e61f9c0dad88ac"),
    },
  ],
};

const ZCASH_SAPLING_DESHIELDED_TX1 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [
    {
      prevout: hexToBytes(
        "e1360c957489515ddfb5c564962e2c8cb2dc3c651c4a219e25e0b5e569f49d3300000000",
      ),
      script: hexToBytes(
        "4830450221008844cfb8d9983226f74cdd20cb63ee282360374def5de88d093df7f340775d65022072673cea8cd2092484c11c6e8c35ab765a9501024a96265bdd3b80d0c46f9190012102495e50ff5127b9b74083bad438208c7a39ddd83301cd04e40b",
      ),
      sequence: hexToBytes("00000000"),
    },
  ],
  outputs: [
    {
      amount: hexToBytes("a086010000000000"),
      script: hexToBytes("76a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388ac"),
    },
    {
      amount: hexToBytes("cedb0e0000000000"),
      script: hexToBytes("76a9142495eecd3d7ea979d2066da533f45956a3a6b5c888ac"),
    },
  ],
};

const ZCASH_SAPLING_DESHIELDED_TX2 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [],
  outputs: [
    {
      amount: hexToBytes("4095160000000000"),
      script: hexToBytes("76a9142767cba450ee8c78f42c151c2b0a89673686fb0988ac"),
    },
  ],
};

const ZCASH_ORCHARD_DESHIELDED_TX1 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [],
  outputs: [
    {
      amount: hexToBytes("488e100000000000"),
      script: hexToBytes("76a914e58749ee655c0e39ae3ce063a33fb9edc86d23dd88ac"),
    },
  ],
};

const ZCASH_ORCHARD_DESHIELDED_TX2 = {
  version: hexToBytes("05000080"),
  nVersionGroupId: hexToBytes("0a27a726"),
  locktime: hexToBytes("00000000"),
  nExpiryHeight: hexToBytes("00000000"),
  inputs: [],
  outputs: [
    {
      amount: hexToBytes("889b130000000000"),
      script: hexToBytes("76a914b108019156ddd648b20242a5999f87011f35eeff88ac"),
    },
  ],
};

describe("SignTransactionTask", () => {
  let apiMock: InternalApi;

  beforeEach(() => {
    apiMock = {
      sendCommand: vi.fn(),
    } as unknown as InternalApi;
  });

  it("returns validation error when expiryHeight length is not 4 bytes", async () => {
    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined]],
        associatedKeysets: ["44'/133'/0'/0/0"],
        outputScriptHex: "01",
        additionals: ["zcash"],
        expiryHeight: new Uint8Array([0x01, 0x02]),
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(false);
    if (!isSuccessDmkResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      expect(
        (result.error as InvalidStatusWordError).originalError?.message,
      ).toMatch(/expiryHeight must be 4 bytes/);
    }
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("returns validation error when additionals does not include zcash", async () => {
    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined]],
        associatedKeysets: ["44'/133'/0'/0/0"],
        outputScriptHex: "01",
        additionals: ["sapling"],
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(false);
    if (!isSuccessDmkResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      expect(
        (result.error as InvalidStatusWordError).originalError?.message,
      ).toMatch(/zcash/i);
    }
  });

  it("completes without Sapling output commit when additionals is zcash-only", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x24),
        },
      }) as never,
    );

    const commands: unknown[] = [];
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      commands.push(command);
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1test",
              chainCode: new Uint8Array(32).fill(0x02),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x45, 0x01]),
            },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined, 3000000]],
        associatedKeysets: ["44'/133'/0'/0/0"],
        outputScriptHex:
          "018b515300000000001976a914b650b82e9e136db22e3643e5a52380d2ac0e360888ac",
        additionals: ["zcash"],
        expiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(true);
    expect(
      commands.some((c) => c instanceof ZcashSaplingOutputCommitCommand),
    ).toBe(false);
  });

  it("skips change-path APDU for single-output payment (avoids SW 6986)", async () => {
    const buildSpy = vi
      .spyOn(
        legacyTransactionUtils,
        "buildP2pkhScriptPubKeyFromLedgerZcashPublicKey",
      )
      .mockReturnValue(
        Buffer.from(
          "76a914b650b82e9e136db22e3643e5a52380d2ac0e360888ac",
          "hex",
        ),
      );
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x24),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1test",
              chainCode: new Uint8Array(32).fill(0x02),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x45, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    try {
      await new SignTransactionTask(apiMock, {
        transactionArg: {
          inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined, 3000000]],
          associatedKeysets: ["44'/133'/0'/0/0"],
          changePath: "44'/133'/0'/0/0",
          outputScriptHex:
            "018b515300000000001976a914b650b82e9e136db22e3643e5a52380d2ac0e360888ac",
          additionals: ["zcash", "sapling"],
          expiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
        },
      }).run();
    } finally {
      buildSpy.mockRestore();
    }

    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.some(
          (c: SendCommandCall) =>
            c[0] instanceof ProvideOutputFullChangePathCommand,
        ),
    ).toBe(false);
  });

  it("returns signed transaction hex for legacy createTransaction-like input", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x42),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x01),
              address: "t1test",
              chainCode: new Uint8Array(32).fill(0x02),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x45, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined, 3000000]],
        associatedKeysets: ["44'/133'/0'/0/0"],
        changePath: "44'/133'/0'/1/0",
        outputScriptHex: "01",
        additionals: ["zcash", "sapling"],
        expiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.startsWith("0x")).toBe(true);
    }
  });

  it("propagates first command error", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x42),
        },
      }) as never,
    );

    const expectedError = new InvalidStatusWordError("cannot get address");
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            error: expectedError,
          }) as never,
        );
      }
      return Promise.resolve(
        CommandResultFactory({
          data: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array([]),
          },
        }) as never,
      );
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [[PREVIOUS_TRANSACTION, 0, undefined, undefined, 3000000]],
        associatedKeysets: ["44'/133'/0'/0/0"],
        outputScriptHex: "01",
        additionals: ["zcash"],
      },
    }).run();

    expect(result).toEqual(DmkResultFactory({ error: expectedError }));
  });

  it("handles zcash sapling createPaymentTransaction vector", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x24),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [
          [ZCASH_SAPLING_TX1, 0, null, 0, 1806010],
          [ZCASH_SAPLING_TX2, 0, null, 0, 2733284],
        ],
        associatedKeysets: ["0'/0/0", "0'/0/0"],
        changePath: undefined,
        blockHeight: 2812009,
        sigHashType: 1,
        outputScriptHex:
          "0210270000000000001976a9140fef7d9e0afcc8e198ac049945b6499b6fe7aef288ac1a314700000000001976a914d83e71f7a39b28a617c7bcedbd925c2a621952b288ac",
        additionals: ["zcash", "sapling"],
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(true);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) => call[0] instanceof SignTransactionCommand,
        ).length,
    ).toBe(2);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) =>
            call[0] instanceof StartUntrustedHashTransactionInputCommand,
        ).length,
    ).toBeGreaterThan(0);
  });

  it("still sends each prior input's scriptPubKey length when hashing a later input (multi-input regression)", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x24),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [
          [ZCASH_SAPLING_TX1, 0, null, 0, 1806010],
          [ZCASH_SAPLING_TX2, 0, null, 0, 2733284],
        ],
        associatedKeysets: ["0'/0/0", "0'/0/0"],
        changePath: undefined,
        blockHeight: 2812009,
        sigHashType: 1,
        outputScriptHex:
          "0210270000000000001976a9140fef7d9e0afcc8e198ac049945b6499b6fe7aef288ac1a314700000000001976a914d83e71f7a39b28a617c7bcedbd925c2a621952b288ac",
        additionals: ["zcash", "sapling"],
      },
    }).run();

    const startHashData = vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map((call: SendCommandCall) => call[0])
      .filter(
        (cmd): cmd is StartUntrustedHashTransactionInputCommand =>
          cmd instanceof StartUntrustedHashTransactionInputCommand,
      )
      .map((cmd) => Buffer.from(cmd.getApdu().getRawApdu().slice(5)));

    /** Per-input header: 0x01 + trustedLen (0x40) + 64-byte trusted + compactSize(scriptLen). */
    const trustedInputHeaders = startHashData.filter(
      (d) => d.length >= 67 && d[0] === 0x01 && d[1] === 0x40,
    );
    expect(trustedInputHeaders.length).toBeGreaterThan(0);
    for (const d of trustedInputHeaders) {
      expect(d[66]).toBe(0x19);
    }
  });

  it("handles zcash Sapling deshielded input vector", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x44),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1saplingdeshielded",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x02]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [
          [ZCASH_SAPLING_DESHIELDED_TX1, 1, null, 0, 2980249],
          [ZCASH_SAPLING_DESHIELDED_TX2, 0, null, 0, 2981031],
        ],
        associatedKeysets: ["44'/133'/0'/1/0", "44'/133'/0'/0/1"],
        changePath: "44'/133'/0'/1/1",
        blockHeight: 2984328,
        sigHashType: 1,
        outputScriptHex:
          "0280841e00000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388ac28360100000000001976a9141ed023c5e3414784b975c5ee2ec5378ed7c4fcd488ac",
        additionals: ["zcash", "sapling"],
        expiryHeight: new Uint8Array([0, 0, 0, 0]),
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(true);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) => call[0] instanceof SignTransactionCommand,
        ).length,
    ).toBe(2);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) =>
            call[0] instanceof ZcashSaplingOutputCommitCommand,
        ).length,
    ).toBe(1);
  });

  it("handles zcash Orchard deshielded input vector", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x55),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1orcharddeshielded",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x03]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const result = await new SignTransactionTask(apiMock, {
      transactionArg: {
        inputs: [
          [ZCASH_ORCHARD_DESHIELDED_TX1, 0, null, 0, 2941758],
          [ZCASH_ORCHARD_DESHIELDED_TX2, 0, null, 0, 2981033],
        ],
        associatedKeysets: ["44'/133'/1'/0/0", "44'/133'/1'/0/1"],
        changePath: undefined,
        blockHeight: 2984376,
        sigHashType: 1,
        outputScriptHex:
          "0180841e00000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388ac",
        additionals: ["zcash", "sapling"],
        expiryHeight: new Uint8Array([0, 0, 0, 0]),
      },
    }).run();

    expect(isSuccessDmkResult(result)).toBe(true);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) => call[0] instanceof SignTransactionCommand,
        ).length,
    ).toBe(2);
    expect(
      vi
        .mocked(apiMock.sendCommand)
        .mock.calls.filter(
          (call: SendCommandCall) =>
            call[0] instanceof ZcashSaplingOutputCommitCommand,
        ).length,
    ).toBe(1);
  });

  it("assembles signed tx hex from Ledger Wallet 2026-05-11 log fixture", async () => {
    const compressSpy = vi
      .spyOn(legacyTransactionUtils, "compressPublicKey")
      .mockReturnValue(
        Buffer.from(
          "02ebe6efbef8f02d8d4f2d2034139725874c662820a86a4239161816948b70f764",
          "hex",
        ),
      );

    try {
      vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
        DmkResultFactory({
          data: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: hexToBytes(trustedInputHexFromLogs),
          },
        }) as never,
      );

      vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
        if (command instanceof GetAddressCommand) {
          return Promise.resolve(
            CommandResultFactory({
              data: {
                publicKey: new Uint8Array(65).fill(0x04),
                address: "t1fixture",
                chainCode: new Uint8Array(32).fill(0x03),
              },
            }) as never,
          );
        }
        if (
          command instanceof StartUntrustedHashTransactionInputCommand ||
          command instanceof ProvideOutputFullChangePathCommand ||
          command instanceof HashOutputFullCommand
        ) {
          return Promise.resolve(
            CommandResultFactory({
              data: {
                statusCode: new Uint8Array([0x90, 0x00]),
                data: new Uint8Array([]),
              },
            }) as never,
          );
        }
        if (command instanceof SignTransactionCommand) {
          return Promise.resolve(
            CommandResultFactory({
              data: {
                signature: LEDGER_WALLET_LOG_20260511_INPUT_SIGNATURE,
              },
            }) as never,
          );
        }
        if (command instanceof ZcashSaplingOutputCommitCommand) {
          return Promise.resolve(
            CommandResultFactory({
              data: { committed: true },
            }) as never,
          );
        }
        return Promise.reject(new Error("Unexpected command"));
      });

      const logInput = createPaymentTransactionArgsFromLogs.inputs[0];
      const result = await new SignTransactionTask(apiMock, {
        transactionArg: {
          inputs: [
            [
              ledgerWalletLog20260511LegacyPreviousTransaction(),
              logInput[1],
              logInput[2],
              logInput[3],
              logInput[4],
            ],
          ],
          associatedKeysets: [
            ...createPaymentTransactionArgsFromLogs.associatedKeysets,
          ],
          changePath: createPaymentTransactionArgsFromLogs.changePath,
          blockHeight: createPaymentTransactionArgsFromLogs.blockHeight,
          sigHashType: createPaymentTransactionArgsFromLogs.sigHashType,
          outputScriptHex: createPaymentTransactionArgsFromLogs.outputScriptHex,
          additionals: [...createPaymentTransactionArgsFromLogs.additionals],
          expiryHeight: hexToBytes(
            createPaymentTransactionArgsFromLogs.expiryHeightHex,
          ),
        },
      }).run();

      expect(isSuccessDmkResult(result)).toBe(true);
      if (isSuccessDmkResult(result)) {
        expect(result.data).toBe(`0x${expectedSignedTransactionHexFromLogs}`);
      }
    } finally {
      compressSpy.mockRestore();
    }
  });

  it("matches Ledger Wallet 2026-05-11 fixture introduced command counts", async () => {
    const getTrustedInputSpy = vi
      .spyOn(GetTrustedInputTask.prototype, "run")
      .mockResolvedValue(
        DmkResultFactory({
          data: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array(64).fill(0x24),
          },
        }) as never,
      );

    const buildP2pkhSpy = vi
      .spyOn(
        legacyTransactionUtils,
        "buildP2pkhScriptPubKeyFromLedgerZcashPublicKey",
      )
      .mockReturnValue(
        Buffer.from(
          "76a91475850960de41df9ac39f04036d4a2133d13ee3e788ac",
          "hex",
        ),
      );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const expected =
      signTransactionFromLedgerWalletLogs20260511.introducedValues;
    const txArg = signTransactionFromLedgerWalletLogs20260511.transactionArg;

    try {
      const result = await new SignTransactionTask(apiMock, {
        transactionArg: { ...txArg },
      }).run();

      expect(isSuccessDmkResult(result)).toBe(true);
      expect(getTrustedInputSpy).toHaveBeenCalledTimes(
        expected.getTrustedInputTaskRunCount,
      );

      const commands = vi
        .mocked(apiMock.sendCommand)
        .mock.calls.map((call: SendCommandCall) => call[0]);
      expect(
        commands.filter((c) => c instanceof GetAddressCommand).length,
      ).toBe(expected.getAddressCommandCount);
      expect(
        commands.filter((c) => c instanceof SignTransactionCommand).length,
      ).toBe(expected.signTransactionCommandCount);
      expect(
        commands.filter((c) => c instanceof ZcashSaplingOutputCommitCommand)
          .length,
      ).toBe(expected.zcashSaplingOutputCommitCommandCount);
      expect(
        commands.filter(
          (c) => c instanceof StartUntrustedHashTransactionInputCommand,
        ).length,
      ).toBe(expected.startUntrustedHashTransactionInputCommandCount);
      expect(
        commands.filter((c) => c instanceof ProvideOutputFullChangePathCommand)
          .length,
      ).toBe(expected.provideOutputFullChangePathCommandCount);
      expect(
        commands.filter((c) => c instanceof HashOutputFullCommand).length,
      ).toBe(expected.hashOutputFullCommandCount);
    } finally {
      buildP2pkhSpy.mockRestore();
    }
  });

  it("matches Ledger Wallet 2026-05-12 fixture introduced command counts", async () => {
    const getTrustedInputSpy = vi
      .spyOn(GetTrustedInputTask.prototype, "run")
      .mockResolvedValue(
        DmkResultFactory({
          data: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array(64).fill(0x24),
          },
        }) as never,
      );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const expected =
      signTransactionFromLedgerWalletLogs20260512.introducedValues;
    const txArg = signTransactionFromLedgerWalletLogs20260512.transactionArg;

    try {
      const result = await new SignTransactionTask(apiMock, {
        transactionArg: { ...txArg },
      }).run();

      expect(isSuccessDmkResult(result)).toBe(true);
      expect(getTrustedInputSpy).toHaveBeenCalledTimes(
        expected.getTrustedInputTaskRunCount,
      );

      const commands = vi
        .mocked(apiMock.sendCommand)
        .mock.calls.map((call: SendCommandCall) => call[0]);
      expect(
        commands.filter((c) => c instanceof GetAddressCommand).length,
      ).toBe(expected.getAddressCommandCount);
      expect(
        commands.filter((c) => c instanceof SignTransactionCommand).length,
      ).toBe(expected.signTransactionCommandCount);
      expect(
        commands.filter((c) => c instanceof ZcashSaplingOutputCommitCommand)
          .length,
      ).toBe(expected.zcashSaplingOutputCommitCommandCount);
      expect(
        commands.filter(
          (c) => c instanceof StartUntrustedHashTransactionInputCommand,
        ).length,
      ).toBe(expected.startUntrustedHashTransactionInputCommandCount);
      expect(
        commands.filter((c) => c instanceof ProvideOutputFullChangePathCommand)
          .length,
      ).toBe(expected.provideOutputFullChangePathCommandCount);
      expect(
        commands.filter((c) => c instanceof HashOutputFullCommand).length,
      ).toBe(expected.hashOutputFullCommandCount);

      const startHashCommands = commands.filter(
        (c) => c instanceof StartUntrustedHashTransactionInputCommand,
      ) as StartUntrustedHashTransactionInputCommand[];
      expect(startHashCommands[0]?.getApdu().getRawApdu()[3]).toBe(0x05);
      expect(startHashCommands.at(-3)?.getApdu().getRawApdu()[3]).toBe(0x80);
    } finally {
      getTrustedInputSpy.mockRestore();
    }
  });

  it("sends Sapling output commit before per-input SIGN when expiryHeight is omitted", async () => {
    vi.spyOn(GetTrustedInputTask.prototype, "run").mockResolvedValue(
      DmkResultFactory({
        data: {
          statusCode: new Uint8Array([0x90, 0x00]),
          data: new Uint8Array(64).fill(0x24),
        },
      }) as never,
    );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: { committed: true },
          }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const { expiryHeight: _omit, ...txArgWithoutExpiry } =
      signTransactionFromLedgerWalletLogs20260512.transactionArg;

    await new SignTransactionTask(apiMock, {
      transactionArg: txArgWithoutExpiry,
    }).run();

    const commands = vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map((call: SendCommandCall) => call[0]);
    const hashOutputIdx = commands.findIndex(
      (c) => c instanceof HashOutputFullCommand,
    );
    const saplingCommitIdx = commands.findIndex(
      (c) => c instanceof ZcashSaplingOutputCommitCommand,
    );
    const firstSignIdx = commands.findIndex(
      (c) => c instanceof SignTransactionCommand,
    );

    expect(hashOutputIdx).toBeGreaterThanOrEqual(0);
    expect(saplingCommitIdx).toBeGreaterThan(hashOutputIdx);
    expect(firstSignIdx).toBeGreaterThan(saplingCommitIdx);
    expect(
      Buffer.from(
        (commands[saplingCommitIdx] as ZcashSaplingOutputCommitCommand)
          .getApdu()
          .getRawApdu(),
      ).toString("hex"),
    ).toBe("e04800000b0000000000000100000000");
  });

  // NOTE: independent invariant — the *spending* tx header is always v5 (NU5)
  // regardless of input versions. (The 2026-06-15 6a80 was a separate bug in the
  // v4 *previous*-tx framing for GET_TRUSTED_INPUT; see GetTrustedInputTask.test.ts.)
  it("pins the v5 (NU5) spending-transaction header even when the first input UTXO is a v4/Sapling transaction", async () => {
    const getTrustedInputSpy = vi
      .spyOn(GetTrustedInputTask.prototype, "run")
      .mockResolvedValue(
        DmkResultFactory({
          data: {
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array(64).fill(0x24),
          },
        }) as never,
      );

    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      if (command instanceof GetAddressCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              publicKey: new Uint8Array(65).fill(0x04),
              address: "t1sapling",
              chainCode: new Uint8Array(32).fill(0x03),
            },
          }) as never,
        );
      }
      if (
        command instanceof StartUntrustedHashTransactionInputCommand ||
        command instanceof ProvideOutputFullChangePathCommand ||
        command instanceof HashOutputFullCommand
      ) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              statusCode: new Uint8Array([0x90, 0x00]),
              data: new Uint8Array([]),
            },
          }) as never,
        );
      }
      if (command instanceof SignTransactionCommand) {
        return Promise.resolve(
          CommandResultFactory({
            data: {
              signature: new Uint8Array([0x30, 0x44, 0x02, 0x20, 0x01]),
            },
          }) as never,
        );
      }
      if (command instanceof ZcashSaplingOutputCommitCommand) {
        return Promise.resolve(
          CommandResultFactory({ data: { committed: true } }) as never,
        );
      }
      return Promise.reject(new Error("Unexpected command"));
    });

    const { transactionArg, regression } =
      signTransactionFromLedgerWalletLogs20260615;

    // Guard the fixture itself: the first input really is a v4/Sapling source tx,
    // which is exactly the shape that produced 6a80 in the deployed build.
    const firstInputSourceTx = transactionArg.inputs[0]![0];
    expect(Buffer.from(firstInputSourceTx.version).toString("hex")).toBe(
      regression.firstInputSourceVersionHex,
    );
    expect(
      Buffer.from(firstInputSourceTx.nVersionGroupId!).toString("hex"),
    ).toBe(regression.firstInputSourceVersionGroupIdHex);

    try {
      const result = await new SignTransactionTask(apiMock, {
        transactionArg: { ...transactionArg },
      }).run();

      expect(isSuccessDmkResult(result)).toBe(true);

      const startHashCommands = vi
        .mocked(apiMock.sendCommand)
        .mock.calls.map((call: SendCommandCall) => call[0])
        .filter(
          (c) => c instanceof StartUntrustedHashTransactionInputCommand,
        ) as StartUntrustedHashTransactionInputCommand[];

      // The first START is the global header carrying the spending-tx version.
      const header = startHashCommands[0]!.getApdu().getRawApdu();
      // APDU = [CLA, INS, P1, P2, Lc, version(4) | nVersionGroupId(4) | branchId(4) | count].
      const version = Buffer.from(header.slice(5, 9)).toString("hex");
      const versionGroupId = Buffer.from(header.slice(9, 13)).toString("hex");

      // Must be pinned to v5 / NU5 — NOT inherited from the v4/Sapling input.
      expect(version).toBe(regression.pinnedTransactionVersionHex);
      expect(versionGroupId).toBe(regression.pinnedVersionGroupIdHex);
      expect(version).not.toBe(regression.firstInputSourceVersionHex);
      expect(versionGroupId).not.toBe(
        regression.firstInputSourceVersionGroupIdHex,
      );
    } finally {
      getTrustedInputSpy.mockRestore();
    }
  });
});

import {
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
} from "@api/model/CreateTransactionArg";

/**
 * Parsed from Ledger Wallet export (2026-05-11, one transparent input, Sapling additionals).
 *
 * Log entries (hw channel):
 * - logIndex 621: `splitTransaction` + structured `data`
 * - logIndex 622: `splitTransaction` human-readable dump (same raw tx)
 * - logIndex 623: `createPaymentTransaction` + structured `data`
 *
 * DMK / Speculos replay: `apduRecordStore` matches `[exchange]` lines from
 * `live-dmk-logger` with tag `[WebHidApduSender]` between logIndex 616–836
 * (Zcash app 3.0.0, one transparent input, Sapling additionals).
 *
 * Expected signed tx: `actions-transaction-event` logIndex 842 `data.signedOperation.signature`.
 */

export const ledgerWalletLogMeta = {
  description:
    "Ledger Wallet export 2026-05-11 (one transparent input, Sapling additionals)",
  splitTransactionLogIndex: 621,
  createPaymentTransactionLogIndex: 623,
  zcashAppVersionFromGetVersion: "3.0.0",
} as const;

/** Arguments logged immediately before `splitTransaction` (Ledger Wallet channel). */
export const splitTransactionArgsFromLogs = {
  transactionHex:
    "050000800a27a726f04dec4d00000000000000000172729ddf1904c9e4633204e10de44ad79caed9398e96e21a64a39065117aeb480100000069463043021f2bc162c395091f29d3fa7d0fc08de3122c15b7d89e3fbc6274f8b77e9ab1b802200f5055233fed884729d31f1ed831a8176d9e1ed7b58931d78461714f09f835a60121030704c7f921547e05fd0c2224a865239d8bb40d62654feb833adf731846e8e400ffffffff02a0860100000000001976a914e58749ee655c0e39ae3ce063a33fb9edc86d23dd88ac9c4d0500000000001976a9142ac181448f8a2575bfedf34f79795f87fd0a71da88ac000000",
  isSegwitSupported: true,
  hasExtraData: true,
  additionals: ["zcash", "sapling"] as const,
} as const;

/**
 * `createPaymentTransaction` payload from logs (Buffer fields as hex for tests).
 * Shape matches `LegacyCreateTransactionArg` / `SignTransactionTask` inputs.
 */
export const createPaymentTransactionArgsFromLogs = {
  inputs: [
    [
      {
        note: "Parsed tx object after splitTransaction — consensusBranchId set for input height 3290695",
        versionHex: "05000080",
        nVersionGroupIdHex: "0a27a726",
        consensusBranchIdHex: "f04dec4d",
        nExpiryHeightHex: "00000000",
        extraDataHex: "",
        locktimeHex: "00000000",
        inputs: [
          {
            prevoutHex:
              "72729ddf1904c9e4633204e10de44ad79caed9398e96e21a64a39065117aeb4801000000",
            scriptHex:
              "463043021f2bc162c395091f29d3fa7d0fc08de3122c15b7d89e3fbc6274f8b77e9ab1b802200f5055233fed884729d31f1ed831a8176d9e1ed7b58931d78461714f09f835a60121030704c7f921547e05fd0c2224a865239d8bb40d62654feb833adf731846e8e400",
            sequenceHex: "ffffffff",
          },
        ],
        outputs: [
          {
            amountHex: "a086010000000000",
            scriptHex: "76a914e58749ee655c0e39ae3ce063a33fb9edc86d23dd88ac",
          },
          {
            amountHex: "9c4d050000000000",
            scriptHex: "76a9142ac181448f8a2575bfedf34f79795f87fd0a71da88ac",
          },
        ],
      },
      1,
      null,
      0xffffffff,
      3290695,
    ],
  ],
  associatedKeysets: ["44'/133'/0'/1/2"],
  changePath: "44'/133'/0'/1/3",
  blockHeight: 3338721,
  sigHashType: 1,
  outputScriptHex:
    "02a0860100000000001976a9140a773e79f573c395ebee90498d944dedd733e88988ac4a530000000000001976a91475850960de41df9ac39f04036d4a2133d13ee3e788ac",
  expiryHeightHex: "00000000",
  additionals: ["zcash", "sapling"] as const,
} as const;

/** Raw trusted input hex returned during flow (`got trustedInput=` logIndex 724). */
export const trustedInputHexFromLogs =
  "3200d1e16b10b6b4ab620e9286b2d0a7be164e8880cf51e37f90b828bac8ac0b88f760d3010000009c4d0500000000007554dcf4242df335";

/** Final signed transaction from wallet (`signedOperation.signature`, logIndex 842). */
export const expectedSignedTransactionHexFromLogs =
  "050000800a27a726f04dec4d0000000000000000016b10b6b4ab620e9286b2d0a7be164e8880cf51e37f90b828bac8ac0b88f760d3010000006a4730440220673139ab50de3fb7af1e7436fbcde38c2afe3751b090dc09c390e07a704e91a902200514b0e2c8b49c8e0ce7988e065ed06d8245631f9d0577cb041fb4a5f5a985a8012102ebe6efbef8f02d8d4f2d2034139725874c662820a86a4239161816948b70f764ffffffff02a0860100000000001976a9140a773e79f573c395ebee90498d944dedd733e88988ac4a530000000000001976a91475850960de41df9ac39f04036d4a2133d13ee3e788ac000000";

/**
 * `RecordStore.fromString` compatible block (WebHid exchanges only, no duplicates).
 * Use with `@ledgerhq/hw-transport-mocker` `openTransportReplayer`.
 */
export const apduRecordStoreFromLogs = `
=> b001000000
<= 01055a6361736805332e302e3001029000
=> e04200001100000001050000800a27a726f04dec4d01
<= 9000
=> e04280002572729ddf1904c9e4633204e10de44ad79caed9398e96e21a64a39065117aeb480100000069
<= 9000
=> e042800032463043021f2bc162c395091f29d3fa7d0fc08de3122c15b7d89e3fbc6274f8b77e9ab1b802200f5055233fed884729d31f1e
<= 9000
=> e042800032d831a8176d9e1ed7b58931d78461714f09f835a60121030704c7f921547e05fd0c2224a865239d8bb40d62654feb833adf73
<= 9000
=> e0428000091846e8e400ffffffff
<= 9000
=> e04280000102
<= 9000
=> e042800022a0860100000000001976a914e58749ee655c0e39ae3ce063a33fb9edc86d23dd88ac
<= 9000
=> e0428000229c4d0500000000001976a9142ac181448f8a2575bfedf34f79795f87fd0a71da88ac
<= 9000
=> e042800003000000
<= 9000
=> e042800009000000000400000000
<= 3200d1e16b10b6b4ab620e9286b2d0a7be164e8880cf51e37f90b828bac8ac0b88f760d3010000009c4d0500000000007554dcf4242df3359000
=> e040000015058000002c80000085800000000000000100000002
<= 4104ebe6efbef8f02d8d4f2d2034139725874c662820a86a4239161816948b70f764bdd8d04c1e09a85df40ff67aa197383f999554fdf19ffe2780fcf93ed159b72e2374314d6d67434d50456d70456b44563238514e3233484e6a4766774d4466326e474e53682fbcafa1b8e3d1f92de63b914aa4d9fe7af790b2e785f9a61fd4376e820f669000
=> e04400050d050000800a27a726f04dec4d01
<= 9000
=> e04480053b01383200d1e16b10b6b4ab620e9286b2d0a7be164e8880cf51e37f90b828bac8ac0b88f760d3010000009c4d0500000000007554dcf4242df33519
<= 9000
=> e04480051d76a9142ac181448f8a2575bfedf34f79795f87fd0a71da88acffffffff
<= 9000
=> e04aff0015058000002c80000085800000000000000100000003
<= 9000
=> e04a00003202a0860100000000001976a9140a773e79f573c395ebee90498d944dedd733e88988ac4a530000000000001976a914758509
<= 9000
=> e04a80001360de41df9ac39f04036d4a2133d13ee3e788ac
<= 9000
=> e04800000b0000000000000100000000
<= 9000
=> e04400800d050000800a27a726f04dec4d01
<= 9000
=> e04480803b01383200d1e16b10b6b4ab620e9286b2d0a7be164e8880cf51e37f90b828bac8ac0b88f760d3010000009c4d0500000000007554dcf4242df33519
<= 9000
=> e04480801d76a9142ac181448f8a2575bfedf34f79795f87fd0a71da88acffffffff
<= 9000
=> e04800001f058000002c8000008580000000000000010000000200000000000100000000
<= 30440220673139ab50de3fb7af1e7436fbcde38c2afe3751b090dc09c390e07a704e91a902200514b0e2c8b49c8e0ce7988e065ed06d8245631f9d0577cb041fb4a5f5a985a8019000
`;

/** Hex → bytes without `Buffer` (safe in Next.js client bundles). */
const fixtureHexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/i, "").replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

/** Previous tx as `LegacyTransaction` for the 2026-05-11 Ledger Wallet log replay. */
export const ledgerWalletLog20260511LegacyPreviousTransaction =
  (): LegacyTransaction => {
    const head = createPaymentTransactionArgsFromLogs.inputs[0][0];
    return {
      version: fixtureHexToBytes(head.versionHex),
      nVersionGroupId: fixtureHexToBytes(head.nVersionGroupIdHex),
      consensusBranchId: fixtureHexToBytes(head.consensusBranchIdHex),
      nExpiryHeight: fixtureHexToBytes(head.nExpiryHeightHex),
      ...(head.extraDataHex
        ? { extraData: fixtureHexToBytes(head.extraDataHex) }
        : {}),
      locktime: fixtureHexToBytes(head.locktimeHex),
      inputs: head.inputs.map((inp) => ({
        prevout: fixtureHexToBytes(inp.prevoutHex),
        script: fixtureHexToBytes(inp.scriptHex),
        sequence: fixtureHexToBytes(inp.sequenceHex),
      })),
      outputs: head.outputs.map((out) => ({
        amount: fixtureHexToBytes(out.amountHex),
        script: fixtureHexToBytes(out.scriptHex),
      })),
    };
  };

const OUTPUT_SCRIPT_HEX_LEDGER_WALLET_LOG_20260511 =
  "02a0860100000000001976a9140a773e79f573c395ebee90498d944dedd733e88988ac4a530000000000001976a91475850960de41df9ac39f04036d4a2133d13ee3e788ac";

export const signTransactionFromLedgerWalletLogs20260511 = {
  meta: {
    capturedAt: "2026-05-11",
    description:
      "Ledger Wallet export (one transparent input, Sapling additionals). Same vectors as `createPaymentTransactionArgsFromLogs` in this module.",
  },
  transactionArg: {
    inputs: [
      [
        ledgerWalletLog20260511LegacyPreviousTransaction(),
        1,
        null,
        0xffffffff,
        3290695,
      ],
    ],
    associatedKeysets: ["44'/133'/0'/1/2"],
    changePath: "44'/133'/0'/1/3",
    blockHeight: 3338721,
    sigHashType: 1,
    outputScriptHex: OUTPUT_SCRIPT_HEX_LEDGER_WALLET_LOG_20260511,
    additionals: ["zcash", "sapling"],
    expiryHeight: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
  } satisfies LegacyCreateTransactionArg,

  /**
   * Initial form state for sample app “Sign Transaction” (matches `transactionArg` above).
   */
  sampleSignTransactionFormInitialValues: {
    associatedKeysetsCsv: "44'/133'/0'/1/2",
    outputScriptHex: OUTPUT_SCRIPT_HEX_LEDGER_WALLET_LOG_20260511,
    changePath: "44'/133'/0'/1/3",
    additionalsCsv: "zcash,sapling",
    lockTime: 0,
    blockHeight: 3338721,
    sigHashType: 1,
    useExpiryHeight: false,
    expiryHeightHex: "",
    skipOpenApp: false,
    input1Enabled: true,
    input1PreviousTxJson: `{
  "version": "05000080",
  "nVersionGroupId": "0a27a726",
  "consensusBranchId": "f04dec4d",
  "nExpiryHeight": "00000000",
  "locktime": "00000000",
  "inputs": [
    {
      "prevout": "72729ddf1904c9e4633204e10de44ad79caed9398e96e21a64a39065117aeb4801000000",
      "script": "463043021f2bc162c395091f29d3fa7d0fc08de3122c15b7d89e3fbc6274f8b77e9ab1b802200f5055233fed884729d31f1ed831a8176d9e1ed7b58931d78461714f09f835a60121030704c7f921547e05fd0c2224a865239d8bb40d62654feb833adf731846e8e400",
      "sequence": "ffffffff"
    }
  ],
  "outputs": [
    {
      "amount": "a086010000000000",
      "script": "76a914e58749ee655c0e39ae3ce063a33fb9edc86d23dd88ac"
    },
    {
      "amount": "9c4d050000000000",
      "script": "76a9142ac181448f8a2575bfedf34f79795f87fd0a71da88ac"
    }
  ]
}`,
    input1OutputIndex: 1,
    input1ScriptHex: "",
    input1Sequence: 4294967295,
    input1UseBranchHeight: true,
    input1BranchHeight: 3290695,
    input1SerializedPreviousTxOverrideHex: "",
    input2Enabled: false,
    input2PreviousTxJson: "",
    input2OutputIndex: 0,
    input2ScriptHex: "",
    input2Sequence: 0,
    input2UseBranchHeight: true,
    input2BranchHeight: 0,
    input2SerializedPreviousTxOverrideHex: "",
    input3Enabled: false,
    input3PreviousTxJson: "",
    input3OutputIndex: 0,
    input3ScriptHex: "",
    input3Sequence: 4294967295,
    input3UseBranchHeight: true,
    input3BranchHeight: 0,
    input3SerializedPreviousTxOverrideHex: "",
  },

  /** Command-shape expectations when `SignTransactionTask` runs with `transactionArg`. */
  introducedValues: {
    getTrustedInputTaskRunCount: 1,
    /** Input key + change path (different from input keyset in this log). */
    getAddressCommandCount: 2,
    signTransactionCommandCount: 1,
    /** Short `SIGN` after global output hash (Sapling commit). */
    zcashSaplingOutputCommitCommandCount: 1,
    /** Global hash + per-input hash: (header + input header + script) × 2 for one P2PKH input. */
    startUntrustedHashTransactionInputCommandCount: 6,
    provideOutputFullChangePathCommandCount: 1,
    /** One output-hash pass: 69-byte script in two 50-byte `HashOutputFull` chunks. */
    hashOutputFullCommandCount: 2,
  },
} as const;

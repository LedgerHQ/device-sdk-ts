import {
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
} from "@api/model/CreateTransactionArg";

/**
 * Parsed from Ledger Wallet export (2026-06-15) — the send that FAILED with the
 * Zcash app returning `6a80` (`IncorrectDataError` → `ZcashAppCommandError`).
 *
 * Root cause: coin selection (`Deepfirst`) ordered a pre-NU5, **v4 / Sapling**
 * transparent UTXO (`c16f0e1f…`, 6 893 574 @ `t1VB78…`) as the **first** input.
 * The failing APDU is **GET_TRUSTED_INPUT** (`INS 0x42`), NOT the spending-tx
 * hash — the device choked while being streamed `inputs[0]`'s v4/Sapling
 * *previous* transaction.
 *
 * `serializeTransaction` framed that v4 prev tx with the **v5 header layout**
 * (`version|vgid|consensusBranchId|locktime|expiry` before the inputs). For v4
 * the device (and the trusted-input chunker) expect `locktime`/`expiry` to trail
 * the outputs, so the 8 extra header bytes shifted the input count onto the
 * `locktime` byte → the chunker read **0 inputs** → the device misparsed the
 * stream and returned `6a80`. Fixed in `serializeTransaction` (v4 branch).
 *
 * Decisive log evidence (hw / DMK channels):
 * - logIndex 2944: `splitTransaction` of `inputs[0]` source tx — `0400008085202f89…`
 *   (version `04000080` = v4, nVersionGroupId `85202f89` = Sapling).
 * - logIndex 2945/2946: `splitTransaction` of `inputs[1]` source tx — `050000800a27a726…` (v5/NU5).
 * - logIndex 2947: `createPaymentTransaction` — two transparent inputs, two keysets.
 * - logIndex 2950: `GET_TRUSTED_INPUT` first APDU for the v4 prev tx, mis-framed
 *   → `e042000011000000000400008085202f89f04dec4d00` (input count read as `00`).
 * - logIndex 2964: device `<= 6a80`.
 * - logIndex 2977: thrown via `DmkSignerZcash.mapError` (`ZcashAppCommandError`, 6a80).
 *
 * Contrast: the immediately preceding 2026-06-15 send (logIndex 707 / 959) spent
 * two v5 change UTXOs whose v5 prev txs frame correctly, so it succeeded.
 *
 * There is no expected signed transaction. This vector pins the regression: a v4
 * previous transaction must be framed for GET_TRUSTED_INPUT with the input count
 * directly after the branch id (`…f04dec4d03`, three inputs) — exercised in
 * `GetTrustedInputTask.test.ts`.
 */

export const ledgerWalletLogMeta = {
  description:
    "Ledger Wallet export 2026-06-15 — v4/Sapling prev tx mis-framed for GET_TRUSTED_INPUT → device 6a80",
  splitTransactionV4InputLogIndex: 2944,
  splitTransactionV5InputLogIndex: 2946,
  createPaymentTransactionLogIndex: 2947,
  failingTrustedInputApduLogIndex: 2950,
  deviceErrorResponseLogIndex: 2964,
  mappedErrorLogIndex: 2977,
  zcashAppVersionFromGetVersion: "3.0.1",
  /** Device error observed in the deployed (buggy) build. */
  deviceError: { errorCode: "6a80", name: "IncorrectDataError" },
  /**
   * GET_TRUSTED_INPUT (`INS 0x42`) first APDU as built by the buggy
   * `serializeTransaction` (logIndex 2950): after the indexLookup, the v4 header
   * `04000080 85202f89 f04dec4d` is followed by `00` — the input count read off
   * the injected `locktime` byte instead of the real `03`.
   */
  failingTrustedInputApduHex: "e042000011000000000400008085202f89f04dec4d00",
} as const;

/**
 * `createPaymentTransaction` payload from logs (Buffer fields as hex for tests).
 * Mirrors `@ledgerhq/hw-app-btc` `CreateTransactionArg` shape.
 *
 * `inputs[0]` is the **v4 / Sapling** UTXO that breaks the flow; `inputs[1]` is a
 * normal v5 change UTXO.
 */
export const createPaymentTransactionArgsFromLogs = {
  inputs: [
    [
      {
        note: "v4/Sapling source tx (c16f0e1f…, t1VB78…) — the input that triggers 6a80; height 3363685",
        versionHex: "04000080",
        nVersionGroupIdHex: "85202f89",
        consensusBranchIdHex: "f04dec4d",
        nExpiryHeightHex: "00000000",
        extraDataHex: "0000000000000000000000",
        locktimeHex: "00000000",
        inputs: [
          {
            prevoutHex:
              "82408554fb2a500ebe031e6a0a0265d8f3068e14ebf1508b351bf60142388c3900000000",
            scriptHex:
              "47304402203ab7d1e8fadb344bf8c4903ec741b048498ab15568007757d2894b37c720de0b02201d94abd82f6974f9603359360ac13c4ff6c17fb729e0e2332358da1d94b91b03012102106a2dcaaac2ae3b24358a03f4264e05db420c5b090399bc23885fa02fef7716",
            sequenceHex: "ffffffff",
          },
          {
            prevoutHex:
              "440461b63758819b115b4621886e158d7e7b1ccad87143b819abf4b6da095eac00000000",
            scriptHex:
              "47304402205f3161a994b848c63dc7b24836c68582b91649394f9134d651708f987c2e567e02204f15c5cd540d482c681217975e728dd0f26161bcf60239b48fe87e7c4148be8f012102106a2dcaaac2ae3b24358a03f4264e05db420c5b090399bc23885fa02fef7716",
            sequenceHex: "ffffffff",
          },
          {
            prevoutHex:
              "f6bbd8b5f5413ff1405539c1d70ea1a4a053813e9d92be34ad21733d603564c401000000",
            scriptHex:
              "4830450221009ef05270bd4fcdd640a6bd7e2f6545a856b57118e7579c2a2d5e73981082f8f802201af78b51bcd3f99d64ad1f9f93273bc612953a3c3742d317c2cf719421b79d45012102106a2dcaaac2ae3b24358a03f4264e05db420c5b090399bc23885fa02fef7716",
            sequenceHex: "ffffffff",
          },
        ],
        outputs: [
          {
            amountHex: "0630690000000000",
            scriptHex: "76a9147bf8c56b5c5c57e63e7d7cffffaeaa03e82f99ae88ac",
          },
          {
            amountHex: "b0bf8b7200000000",
            scriptHex: "76a9141634f5ff0b8f6603a17570436d6c12a91f4b1fed88ac",
          },
        ],
      },
      0,
      null,
      0xffffffff,
      3363685,
    ],
    [
      {
        note: "v5/NU5 change source tx (79fa0041…, t1ZjWw…); height 3378711",
        versionHex: "05000080",
        nVersionGroupIdHex: "0a27a726",
        consensusBranchIdHex: "30f33754",
        nExpiryHeightHex: "00000000",
        extraDataHex: "",
        locktimeHex: "00000000",
        inputs: [
          {
            prevoutHex:
              "95c61cb6fbce43ca6e910a9e95b0faf8aa3edbd2356fbb6cffb0cef01a42223601000000",
            scriptHex:
              "47304402204f7ae09c4343f41eced53d4d9249cc133850a2a934103db6ac3834f97e51d1220220402ab9338e26c27d0d3d59cde3d2a662c8c59c58bb4610430ecc51244240e64e012102bcecf522cc89b8624d153c77b8db90a08d9cfb6e379be60173f7688d84483b60",
            sequenceHex: "ffffffff",
          },
          {
            prevoutHex:
              "22d8ae584994e054232f6acfdbef0a1bf0b2d42030d8f5b776e6c423eec6de5801000000",
            scriptHex:
              "47304402205aa711418e1321a1f3b33983de533701a544e02ff5ae1027d5dd1558ef695edc02205ace391ca94ac96be8bd6072911f897f82924ee20635e899d0618824cf4f68b001210320e4aac1a4719a7e2d35ec9bb3a4b8122652dd59a3ed27cfef74bf358e0e7697",
            sequenceHex: "ffffffff",
          },
        ],
        outputs: [
          {
            amountHex: "808d5b0000000000",
            scriptHex: "76a914126f2d54c9c72423f2ece862ee1f348a0120316a88ac",
          },
          {
            amountHex: "e6c7210000000000",
            scriptHex: "76a914adfa746f9d843cbde9c29c4445fed0da30ce20cd88ac",
          },
        ],
      },
      1,
      null,
      0xffffffff,
      3378711,
    ],
  ],
  associatedKeysets: ["44'/133'/0'/0/5", "44'/133'/0'/1/6"],
  outputScriptHex:
    "0178c68500000000001976a914126f2d54c9c72423f2ece862ee1f348a0120316a88ac",
  blockHeight: 3378725,
  sigHashType: 1,
  expiryHeightHex: "00000000",
  additionals: ["zcash", "sapling"] as const,
} as const;

const fixtureHexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/i, "").replace(/\s+/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const legacyPreviousTransactionFromLogInput = (
  head: (typeof createPaymentTransactionArgsFromLogs.inputs)[number][0],
): LegacyTransaction => ({
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
});

export const signTransactionFromLedgerWalletLogs20260615 = {
  meta: {
    capturedAt: "2026-06-15",
    description:
      "Ledger Wallet export — v4/Sapling UTXO selected first; deployed build emitted a v4 header and device returned 6a80.",
  },
  transactionArg: {
    inputs: createPaymentTransactionArgsFromLogs.inputs.map((tuple) => {
      const [head, outputIndex, script, sequence, branchHeight] = tuple;
      return [
        legacyPreviousTransactionFromLogInput(head),
        outputIndex,
        script,
        sequence,
        branchHeight,
      ] as const;
    }),
    associatedKeysets: [
      ...createPaymentTransactionArgsFromLogs.associatedKeysets,
    ],
    outputScriptHex: createPaymentTransactionArgsFromLogs.outputScriptHex,
    blockHeight: createPaymentTransactionArgsFromLogs.blockHeight,
    sigHashType: createPaymentTransactionArgsFromLogs.sigHashType,
    additionals: [...createPaymentTransactionArgsFromLogs.additionals],
    expiryHeight: fixtureHexToBytes(
      createPaymentTransactionArgsFromLogs.expiryHeightHex,
    ),
  } satisfies LegacyCreateTransactionArg,

  /**
   * Regression expectations. The first input is v4/Sapling, but the signed
   * transaction header sent to the device must be pinned to v5 (NU5).
   */
  regression: {
    /** What the deployed build copied from `inputs[0]` source tx (the bug). */
    firstInputSourceVersionHex: "04000080",
    firstInputSourceVersionGroupIdHex: "85202f89",
    /** What the START header MUST carry regardless of input versions. */
    pinnedTransactionVersionHex: "05000080",
    pinnedVersionGroupIdHex: "0a27a726",
  },
} as const;

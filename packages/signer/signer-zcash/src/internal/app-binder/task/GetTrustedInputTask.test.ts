import {
  CommandResultFactory,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";

import { GetTrustedInputCommand } from "@internal/app-binder/command/GetTrustedInputCommand";
import {
  ironwoodV6OnChainTxHex,
  ironwoodV6ShieldedChunksHex,
  ironwoodV6StreamedHex,
} from "@internal/app-binder/task/__fixtures__/ironwoodV6TrustedInput";
import {
  apduRecordStoreFromLogs,
  splitTransactionArgsFromLogsSecond,
} from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-05-12";
import { signTransactionFromLedgerWalletLogs20260615 } from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-06-15";
import {
  getZcashBranchId,
  serializeTransaction,
  toInternalTransaction,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";

import { GetTrustedInputTask } from "./GetTrustedInputTask";

const TRANSPARENT_V5_TX_HEX =
  "050000800a27a7265510e7c8000000000000000001e1360c957489515ddfb5c564962e2c8cb2dc3c651c4a219e25e0b5e569f49d33000000006b4830450221008844cfb8d9983226f74cdd20cb63ee282360374def5de88d093df7f340775d65022072673cea8cd2092484c11c6e8c35ab765a9501024a96265bdd3b80d0c46f9190012102495e50ff5127b9b74083bad438208c7a39ddd83301cd04e40bff5556d3351ab30000000002a0860100000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388accedb0e00000000001976a9142495eecd3d7ea979d2066da533f45956a3a6b5c888ac000000";
const V4_NU6_TX_HEX =
  "0400008085202f89f04dec4d02ffc3d6a9f3ce6b33c05b7499746418b7bbcb17c9a866524a564987bc49b3e294010000006a47304402205adbc4bd6f79d13382f7164a45896c163061649eb39ad21eb7e59e7977f400c202203ade10c6b9a9807791fa6d0bf2c4c3d7bcb4215175e8f2145662a4e8e4c09bdd012103fa6cc45c6e74329a47794ed716525d4b13c4f939adc85e3349ef613eb351bf72feffffff8d191647f23b95ac8d4fd5cf33d946c24a6107046deeaae83704b832dac59217000000006b483045022100f3ca4de2dc6a5c3b00b2cfe31346c050485c65528f7baa24b77fb2507da00dfc0220593452243ded66620cbec5a698e8b2209e5d54c3106fc5ecbd7621bd1acb6f34012103fa6cc45c6e74329a47794ed716525d4b13c4f939adc85e3349ef613eb351bf72feffffff0270af8b00000000001976a9140a773e79f573c395ebee90498d944dedd733e88988acf9261a00000000001976a914657114e0abfc055161fcf9c95c5e238c59bc30cb88ac000000000000000f000000000000000000000000000000000000";

const EXPECTED_APDUS = [
  "e04200001100000001050000800a27a7265510e7c801",
  "e042800025e1360c957489515ddfb5c564962e2c8cb2dc3c651c4a219e25e0b5e569f49d33000000006b",
  "e0428000324830450221008844cfb8d9983226f74cdd20cb63ee282360374def5de88d093df7f340775d65022072673cea8cd2092484c1",
  "e0428000321c6e8c35ab765a9501024a96265bdd3b80d0c46f9190012102495e50ff5127b9b74083bad438208c7a39ddd83301cd04e40b",
  "e04280000bff5556d3351ab300000000",
  "e04280000102",
  "e042800022a0860100000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388ac",
  "e042800022cedb0e00000000001976a9142495eecd3d7ea979d2066da533f45956a3a6b5c888ac",
  "e042800003000000",
  "e042800009000000000400000000",
];

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hex, "hex"));
const bytesToHex = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("hex");
const concatBytes = (...parts: Uint8Array[]): Uint8Array =>
  Uint8Array.from(Buffer.concat(parts.map((part) => Buffer.from(part))));
const byteRun = (marker: number, length: number): Uint8Array =>
  new Uint8Array(length).fill(marker);
const runHex = (marker: number, length: number): string =>
  bytesToHex(byteRun(marker, length));

// Markers for the fields of the synthetic v5 Sapling transaction below. Every
// field gets its own byte, so a wrong offset or a mixed-up group is readable in
// the assertion instead of showing up as an opaque hex mismatch. AUTHORIZING
// fills the proofs and signatures, which the txid does not commit to: it must
// appear nowhere in the stream.
// Kept clear of every other byte in these transactions — including the transparent
// ones — so that finding one of them in the stream can only mean the trailer leaked.
const VALUE_BALANCE_MARKER = 0xb1;
const ANCHOR_MARKER = 0xb2;
const FLAGS_MARKER = 0xb3;
const AUTHORIZING_MARKER = 0xee;
const SPEND_CV_MARKER = 0x11;
const SPEND_NULLIFIER_MARKER = 0x12;
const SPEND_RK_MARKER = 0x13;

// Sizes the device app reads per field (see `sapling.rs`): a compact output is
// cmu | ephemeralKey | 52 compact bytes, and a non-compact one is cv | the
// 16-byte tag of encCiphertext | outCiphertext.
const SAPLING_SPEND_SIZE = 96;
const SAPLING_OUTPUTS_COMPACT_SIZE = 116;
const SAPLING_OUTPUTS_NONCOMPACT_SIZE = 128;
const SAPLING_MEMO_SIZE = 512;
const MEMO_CHUNK_SIZE = 128;
const SAPLING_SPEND_PROOF_AND_SIG_SIZE = 192 + 64;
const SAPLING_OUTPUT_PROOF_SIZE = 192;
const SAPLING_BINDING_SIG_SIZE = 64;

const V5_HEADER_HEX = "050000800a27a7265510e7c8"; // version | versionGroupId | branchId
const V5_LOCK_TIME_HEX = "01020304";
const V5_EXPIRY_HEX = "05060708";
// One transparent input and one transparent output, deliberately small so the
// assertions stay focused on the shielded groups.
const TRANSPARENT_BODY_HEX =
  "01" + // tx_in count
  "51".repeat(32) +
  "00000000" + // prevout
  "02" +
  "5152" + // scriptSig
  "ffffffff" + // sequence
  "01" + // tx_out count
  "40420f0000000000" + // value
  "02" +
  "5354"; // scriptPubKey

/** OutputDescriptionV5 on chain: cv | cmu | ephemeralKey | encCiphertext | outCiphertext. */
const saplingOutputFields = (base: number) => ({
  cv: byteRun(base + 0x01, 32),
  cmu: byteRun(base + 0x02, 32),
  ephemeralKey: byteRun(base + 0x03, 32),
  encCompact: byteRun(base + 0x04, 52),
  memo: byteRun(base + 0x05, SAPLING_MEMO_SIZE),
  encTag: byteRun(base + 0x06, 16),
  outCiphertext: byteRun(base + 0x07, 80),
});
type SaplingOutputFields = ReturnType<typeof saplingOutputFields>;

const serializeSaplingOutput = (output: SaplingOutputFields): Uint8Array =>
  concatBytes(
    output.cv,
    output.cmu,
    output.ephemeralKey,
    output.encCompact,
    output.memo,
    output.encTag,
    output.outCiphertext,
  );

/**
 * Builds a v5 transaction whose Sapling bundle follows the ZIP-225 on-chain
 * layout: the descriptions first, then the value balance and the anchor, then
 * the proofs and signatures that belong to the authorizing data commitment
 * rather than to the txid.
 */
const buildV5TxWithSaplingBundle = (
  spendCount: number,
  outputs: SaplingOutputFields[],
): Uint8Array => {
  const hasBundle = spendCount > 0 || outputs.length > 0;

  return concatBytes(
    hexToBytes(V5_HEADER_HEX),
    hexToBytes(V5_LOCK_TIME_HEX),
    hexToBytes(V5_EXPIRY_HEX),
    hexToBytes(TRANSPARENT_BODY_HEX),
    new Uint8Array([spendCount]),
    ...Array.from({ length: spendCount }, () =>
      concatBytes(
        byteRun(SPEND_CV_MARKER, 32),
        byteRun(SPEND_NULLIFIER_MARKER, 32),
        byteRun(SPEND_RK_MARKER, 32),
      ),
    ),
    new Uint8Array([outputs.length]),
    ...outputs.map(serializeSaplingOutput),
    hasBundle ? byteRun(VALUE_BALANCE_MARKER, 8) : new Uint8Array(),
    spendCount > 0 ? byteRun(ANCHOR_MARKER, 32) : new Uint8Array(),
    byteRun(
      AUTHORIZING_MARKER,
      spendCount * SAPLING_SPEND_PROOF_AND_SIG_SIZE +
        outputs.length * SAPLING_OUTPUT_PROOF_SIZE +
        (hasBundle ? SAPLING_BINDING_SIG_SIZE : 0),
    ),
    new Uint8Array([0x00]), // no Orchard action
  );
};

const V6_HEADER_HEX = "0600008098b684d85b16a537"; // version | versionGroupId | branchId
const ORCHARD_PROOF_SIZE = 2720;

/** OrchardAction on chain: cv | nullifier | rk | cmx | ephemeralKey | encCiphertext | outCiphertext. */
const orchardActionFields = (base: number) => ({
  cv: byteRun(base + 0x01, 32),
  nullifier: byteRun(base + 0x02, 32),
  rk: byteRun(base + 0x03, 32),
  cmx: byteRun(base + 0x04, 32),
  ephemeralKey: byteRun(base + 0x05, 32),
  encCompact: byteRun(base + 0x06, 52),
  memo: byteRun(base + 0x07, SAPLING_MEMO_SIZE),
  encTag: byteRun(base + 0x08, 16),
  outCiphertext: byteRun(base + 0x09, 80),
});
type OrchardActionFields = ReturnType<typeof orchardActionFields>;

const serializeOrchardAction = (action: OrchardActionFields): Uint8Array =>
  concatBytes(
    action.cv,
    action.nullifier,
    action.rk,
    action.cmx,
    action.ephemeralKey,
    action.encCompact,
    action.memo,
    action.encTag,
    action.outCiphertext,
  );

/**
 * Serializes an action bundle the way ZIP-230 lays it out on chain: the count, the
 * actions, then a trailer of flags, value balance and anchor followed by the proofs
 * and signatures. Only the flags and the value balance belong to the v6 txid digest.
 */
const serializeV6ActionBundle = (actions: OrchardActionFields[]): Uint8Array =>
  concatBytes(
    new Uint8Array([actions.length]),
    ...actions.map(serializeOrchardAction),
    ...(actions.length === 0
      ? []
      : [
          byteRun(FLAGS_MARKER, 1),
          byteRun(VALUE_BALANCE_MARKER, 8),
          byteRun(ANCHOR_MARKER, 32),
          new Uint8Array([
            0xfd,
            ORCHARD_PROOF_SIZE & 0xff,
            ORCHARD_PROOF_SIZE >> 8,
          ]),
          byteRun(AUTHORIZING_MARKER, ORCHARD_PROOF_SIZE),
          byteRun(AUTHORIZING_MARKER, actions.length * 64), // spendAuthSigs
          byteRun(AUTHORIZING_MARKER, 64), // bindingSig
        ]),
  );

/** A v6 transaction carrying both action pools, with no Sapling bundle. */
const buildV6TxWithActionBundles = (
  orchardActions: OrchardActionFields[],
  ironwoodActions: OrchardActionFields[],
): Uint8Array =>
  concatBytes(
    hexToBytes(V6_HEADER_HEX),
    hexToBytes(V5_LOCK_TIME_HEX),
    hexToBytes(V5_EXPIRY_HEX),
    hexToBytes(TRANSPARENT_BODY_HEX),
    new Uint8Array([0x00, 0x00]), // no Sapling spend, no Sapling output
    serializeV6ActionBundle(orchardActions),
    serializeV6ActionBundle(ironwoodActions),
  );

const memoChunksHex = (memo: Uint8Array): string[] =>
  Array.from({ length: memo.length / MEMO_CHUNK_SIZE }, () =>
    runHex(memo[0] ?? 0, MEMO_CHUNK_SIZE),
  );
const compactHex = (output: SaplingOutputFields): string =>
  bytesToHex(concatBytes(output.cmu, output.ephemeralKey, output.encCompact));
const nonCompactHex = (output: SaplingOutputFields): string =>
  bytesToHex(concatBytes(output.cv, output.encTag, output.outCiphertext));
const compactActionHex = (action: OrchardActionFields): string =>
  bytesToHex(
    concatBytes(
      action.nullifier,
      action.cmx,
      action.ephemeralKey,
      action.encCompact,
    ),
  );
const nonCompactActionHex = (action: OrchardActionFields): string =>
  bytesToHex(
    concatBytes(action.cv, action.rk, action.encTag, action.outCiphertext),
  );

const makeSuccessResponse = (byte: number) => ({
  statusCode: new Uint8Array([0x90, 0x00]),
  data: new Uint8Array([byte]),
});

/**
 * GET_TRUSTED_INPUT APDUs recorded in the 2026-05-12 log, grouped per call (P1=00
 * starts a new one). They were produced by the pre-DMK implementation, and the
 * device answered them with the ZIP-244 txids kept in `trustedInputHexesFromLogs`,
 * which match the chain — so they are the reference framing for a previous
 * transaction, including the second call whose source carries an Orchard bundle.
 */
const trustedInputApduCallsFromLogs = (): string[][] => {
  const calls: string[][] = [];

  apduRecordStoreFromLogs
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("=> e042"))
    .map((line) => line.slice(3))
    .forEach((apdu) => {
      if (apdu.startsWith("e04200")) {
        calls.push([]);
      }
      calls.at(-1)?.push(apdu);
    });

  return calls;
};

describe("GetTrustedInputTask", () => {
  let apiMock: InternalApi;

  beforeEach(() => {
    apiMock = {
      sendCommand: vi.fn(),
    } as unknown as InternalApi;
  });

  /** Data sent per APDU, the 5-byte APDU header aside. */
  const sentApduData = (): string[] =>
    vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map(([command]) =>
        bytesToHex(
          (command as GetTrustedInputCommand).getApdu().getRawApdu().slice(5),
        ),
      );

  it("sends the expected trusted-input APDU sequence and returns the last response", async () => {
    const txBytes = hexToBytes(TRANSPARENT_V5_TX_HEX);
    const lastResponse = makeSuccessResponse(0x09);

    EXPECTED_APDUS.forEach((_, index) => {
      const response =
        index === EXPECTED_APDUS.length - 1
          ? lastResponse
          : makeSuccessResponse(index);
      vi.mocked(apiMock.sendCommand).mockResolvedValueOnce(
        CommandResultFactory({ data: response }),
      );
    });

    const result = await new GetTrustedInputTask(apiMock, {
      transaction: txBytes,
      indexLookup: 1,
    }).run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(EXPECTED_APDUS.length);
    EXPECTED_APDUS.forEach((expectedApduHex, index) => {
      const command = vi.mocked(apiMock.sendCommand).mock.calls[index]?.[0];
      expect(command).toBeInstanceOf(GetTrustedInputCommand);
      const apdu = (command as GetTrustedInputCommand).getApdu().getRawApdu();
      expect(apdu).toEqual(hexToBytes(expectedApduHex));
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data).toEqual(lastResponse);
    }
  });

  it("returns the first command error without sending remaining chunks", async () => {
    const txBytes = hexToBytes(TRANSPARENT_V5_TX_HEX);
    const expectedError = new InvalidStatusWordError("Command failed");

    vi.mocked(apiMock.sendCommand)
      .mockResolvedValueOnce(
        CommandResultFactory({ data: makeSuccessResponse(0x01) }),
      )
      .mockResolvedValueOnce(CommandResultFactory({ error: expectedError }));

    const result = await new GetTrustedInputTask(apiMock, {
      transaction: txBytes,
      indexLookup: 1,
    }).run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toEqual(DmkResultFactory({ error: expectedError }));
  });

  it("uses the v4 trailing bytes as the final chunk", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    await new GetTrustedInputTask(apiMock, {
      transaction: hexToBytes(V4_NU6_TX_HEX),
      indexLookup: 1,
    }).run();

    const sentCommands = vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map(([command]) => command as GetTrustedInputCommand);

    const firstChunkData = sentCommands[0]?.getApdu().getRawApdu().slice(5);
    expect(firstChunkData).toBeDefined();
    expect(bytesToHex(firstChunkData ?? new Uint8Array())).toBe(
      "000000010400008085202f89f04dec4d02",
    );

    const lastChunkData = sentCommands.at(-1)?.getApdu().getRawApdu().slice(5);
    expect(lastChunkData).toBeDefined();
    expect(bytesToHex(lastChunkData ?? new Uint8Array())).toBe(
      "000000000f000000000000000000000000000000000000",
    );
  });

  it("frames a v4/Sapling previous transaction with the input count right after the branch id (regression: 2026-06-15 device 6a80)", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    // Reproduce SignTransactionTask's prep for input[0]: the v4/Sapling prev tx
    // with a (valid) consensus branch id attached, then serialized for GetTrustedInput.
    const [legacyPrevTx, , , , branchHeight] =
      signTransactionFromLedgerWalletLogs20260615.transactionArg.inputs[0]!;
    const prevTx = toInternalTransaction(legacyPrevTx);
    prevTx.consensusBranchId = getZcashBranchId(branchHeight);
    const serialized = serializeTransaction(prevTx, prevTx.timestamp);

    await new GetTrustedInputTask(apiMock, {
      transaction: serialized,
      indexLookup: 0,
    }).run();

    const firstChunkData = vi.mocked(apiMock.sendCommand).mock
      .calls[0]?.[0] as GetTrustedInputCommand;
    const header = bytesToHex(firstChunkData.getApdu().getRawApdu().slice(5));

    // indexLookup(00000000) | version(04000080) | vgid(85202f89) | branchId | vin_count.
    // The prev tx has 3 transparent inputs, so the count MUST be 03.
    // Before the fix, serializeTransaction put locktime/expiry in the v4 header,
    // so the chunker read the count off the locktime byte → "...f04dec4d00" (0 inputs)
    // → the device misparsed the stream and returned 6a80.
    expect(header).toBe("000000000400008085202f89f04dec4d03");
  });

  it("regroups the shielded fields of a v5 Orchard previous transaction by ZIP-244 digest (regression: wrong txid, then 504 on broadcast)", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    await new GetTrustedInputTask(apiMock, {
      transaction: hexToBytes(
        splitTransactionArgsFromLogsSecond.transactionHex,
      ),
      indexLookup: 0,
    }).run();

    const sentApdus = vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map(([command]) =>
        bytesToHex((command as GetTrustedInputCommand).getApdu().getRawApdu()),
      );

    // On chain an Orchard action keeps its own fields together, while the device
    // hashes one digest per stream — compact parts, then memos, then non-compact
    // parts — and rejects any digest block split across two APDUs. Streaming the
    // raw bytes in their on-chain order made it commit to a txid that no output
    // carried, so the signed transaction spent an unknown input and the broadcast
    // timed out.
    expect(sentApdus).toEqual(trustedInputApduCallsFromLogs()[1]);
  });

  it("regroups a v5 Sapling bundle per ZIP-244 digest and leaves the authorizing data out", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );
    const outputs = [saplingOutputFields(0x20), saplingOutputFields(0x30)];

    await new GetTrustedInputTask(apiMock, {
      transaction: buildV5TxWithSaplingBundle(1, outputs),
      indexLookup: 0,
    }).run();

    const [firstChunk, ...nextChunks] = sentApduData();
    expect(firstChunk).toBe(`00000000${V5_HEADER_HEX}01`);
    expect(nextChunks).toEqual([
      `${"51".repeat(32)}0000000002`, // prevout | scriptSig length
      "5152ffffffff", // scriptSig | sequence
      "01", // tx_out count
      "40420f0000000000025354", // value | scriptPubKey
      "010200", // one spend, two outputs, no action
      runHex(VALUE_BALANCE_MARKER, 8) + runHex(ANCHOR_MARKER, 32),
      // A spend keeps its on-chain layout, since the app reads cv, nullifier and
      // rk one by one and routes each to the digest it belongs to.
      runHex(SPEND_CV_MARKER, 32) +
        runHex(SPEND_NULLIFIER_MARKER, 32) +
        runHex(SPEND_RK_MARKER, 32),
      // Outputs, on the other hand, are regrouped: every compact part, then
      // every memo, then every non-compact part.
      compactHex(outputs[0]!),
      compactHex(outputs[1]!),
      ...memoChunksHex(outputs[0]!.memo),
      ...memoChunksHex(outputs[1]!.memo),
      nonCompactHex(outputs[0]!),
      nonCompactHex(outputs[1]!),
      `${V5_LOCK_TIME_HEX}04${V5_EXPIRY_HEX}`,
    ]);

    // The app reads these three blocks with `hash_reader_exact`, which rejects a
    // block split across two APDUs — hence the sizes it expects.
    expect(compactHex(outputs[0]!).length / 2).toBe(
      SAPLING_OUTPUTS_COMPACT_SIZE,
    );
    expect(nonCompactHex(outputs[0]!).length / 2).toBe(
      SAPLING_OUTPUTS_NONCOMPACT_SIZE,
    );
    expect(nextChunks[6]!.length / 2).toBe(SAPLING_SPEND_SIZE);

    // Proofs and signatures are authorizing data, which the txid does not commit
    // to: not one of their bytes may reach the device.
    expect(concatBytes(...sentApduData().map(hexToBytes))).not.toContain(
      AUTHORIZING_MARKER,
    );
  });

  it("omits the Sapling anchor when the bundle has outputs but no spend", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );
    const output = saplingOutputFields(0x20);

    await new GetTrustedInputTask(apiMock, {
      transaction: buildV5TxWithSaplingBundle(0, [output]),
      indexLookup: 0,
    }).run();

    // ZIP-225 writes the anchor only for a bundle that has spends, and the app
    // likewise reads the value balance alone before the compact outputs.
    expect(sentApduData().slice(5)).toEqual([
      "000100", // no spend, one output, no action
      runHex(VALUE_BALANCE_MARKER, 8),
      compactHex(output),
      ...memoChunksHex(output.memo),
      nonCompactHex(output),
      `${V5_LOCK_TIME_HEX}04${V5_EXPIRY_HEX}`,
    ]);
  });

  it("streams a v6 Ironwood previous transaction the way the device app was validated against", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    await new GetTrustedInputTask(apiMock, {
      transaction: hexToBytes(ironwoodV6OnChainTxHex),
      indexLookup: 0,
    }).run();

    // Fed these bytes, the device app answered with the txid this transaction has on
    // chain. Spending a UTXO it created depends on that match: a trusted input built on
    // any other stream commits to a txid no output carries.
    const sent = sentApduData();
    expect(sent.join("")).toBe(`00000000${ironwoodV6StreamedHex}`);

    // Within the shielded section the boundaries matter too, since the app reads each
    // action block with `hash_reader_exact` and rejects one split across two APDUs.
    expect(sent.slice(-ironwoodV6ShieldedChunksHex.length)).toEqual(
      ironwoodV6ShieldedChunksHex,
    );
  });

  it("regroups a v6 Orchard bundle and the Ironwood bundle behind it, anchors excluded", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );
    // Bases chosen clear of the bundle-trailer markers, so that finding one of those in
    // the stream can only mean the trailer leaked.
    const orchardAction = orchardActionFields(0x20);
    const ironwoodAction = orchardActionFields(0x60);

    await new GetTrustedInputTask(apiMock, {
      transaction: buildV6TxWithActionBundles(
        [orchardAction],
        [ironwoodAction],
      ),
      indexLookup: 0,
    }).run();

    expect(sentApduData().slice(5)).toEqual([
      "00000101", // no Sapling, one Orchard action, one Ironwood action
      // Each bundle is streamed in turn, regrouped per ZIP-244 digest.
      compactActionHex(orchardAction),
      ...memoChunksHex(orchardAction.memo),
      nonCompactActionHex(orchardAction),
      // ZIP-230 moved the anchor to the authorizing digest, so a v6 bundle commits
      // to its flags and value balance alone — 9 bytes where a v5 one sends 41.
      runHex(FLAGS_MARKER, 1) + runHex(VALUE_BALANCE_MARKER, 8),
      compactActionHex(ironwoodAction),
      ...memoChunksHex(ironwoodAction.memo),
      nonCompactActionHex(ironwoodAction),
      runHex(FLAGS_MARKER, 1) + runHex(VALUE_BALANCE_MARKER, 8),
      `${V5_LOCK_TIME_HEX}04${V5_EXPIRY_HEX}`,
    ]);

    // Anchors, proofs and signatures are authorizing data: the txid does not commit
    // to them, so not one of their bytes may reach the device.
    const streamed = concatBytes(...sentApduData().map(hexToBytes));
    expect(streamed).not.toContain(ANCHOR_MARKER);
    expect(streamed).not.toContain(AUTHORIZING_MARKER);
  });

  it("rejects a v6 transaction whose version group id is not the one the app expects", async () => {
    // The app keys its v6 detection on both words and would parse this as a v5.
    const wrongGroupId = `06000080${"0a27a726"}5b16a53700000000a6233300`;

    await expect(
      new GetTrustedInputTask(apiMock, {
        transaction: hexToBytes(wrongGroupId),
        indexLookup: 0,
      }).run(),
    ).rejects.toThrow(
      "Unexpected version group id for a v6 transaction while splitting trusted input chunks",
    );

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("rejects a transaction version the device app does not handle in this flow", async () => {
    const v7Header = "070000800a27a726f04dec4d00000000a6233300";

    await expect(
      new GetTrustedInputTask(apiMock, {
        transaction: hexToBytes(v7Header),
        indexLookup: 0,
      }).run(),
    ).rejects.toThrow(
      "Unsupported transaction version 7 while splitting trusted input chunks",
    );

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("throws for malformed transaction input before sending any command", async () => {
    await expect(
      new GetTrustedInputTask(apiMock, {
        transaction: new Uint8Array([0x01, 0x02, 0x03]),
      }).run(),
    ).rejects.toThrow(
      "Malformed transaction while splitting trusted input chunks",
    );

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});

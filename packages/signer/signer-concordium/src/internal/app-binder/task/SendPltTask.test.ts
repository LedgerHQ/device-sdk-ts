import {
  APDU_MAX_PAYLOAD,
  type Command,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import {
  type ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { INS, LEDGER_CLA, P1 } from "@internal/app-binder/constants";
import { SendPltTask } from "@internal/app-binder/task/SendPltTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";
const HEADER = new Uint8Array(60).fill(0x11);
const KIND_TOKEN_UPDATE = 0x1b;
const SIGNATURE = new Uint8Array(64).fill(0xab);

/**
 * Builds a serialized TokenUpdate transaction:
 * [header:60][kind:1][tokenIdLength:1][tokenId:N][cborTotalLength:4 BE][cbor]
 */
function buildTransaction({
  kind = KIND_TOKEN_UPDATE,
  tokenId = new TextEncoder().encode("PLT"),
  cbor = new Uint8Array([0x81, 0xa1, 0x65, 0x70, 0x61, 0x75, 0x73, 0x65, 0xa0]),
  tokenIdLengthByte,
  declaredCborLength,
}: {
  kind?: number;
  tokenId?: Uint8Array;
  cbor?: Uint8Array;
  tokenIdLengthByte?: number;
  declaredCborLength?: number;
} = {}): Uint8Array {
  const declared = declaredCborLength ?? cbor.length;
  const tx = new Uint8Array(60 + 1 + 1 + tokenId.length + 4 + cbor.length);
  tx.set(HEADER, 0);
  tx[60] = kind;
  tx[61] = tokenIdLengthByte ?? tokenId.length;
  tx.set(tokenId, 62);
  const view = new DataView(tx.buffer, tx.byteOffset);
  view.setUint32(62 + tokenId.length, declared, false);
  tx.set(cbor, 62 + tokenId.length + 4);
  return tx;
}

function makeApiMock(responses?: ReturnType<typeof CommandResultFactory>[]) {
  const sentCommands: Command<unknown, unknown>[] = [];
  let call = 0;
  const sendCommand = vi.fn((cmd: Command<unknown, unknown>) => {
    sentCommands.push(cmd);
    const canned = responses?.[call++];
    return Promise.resolve(canned ?? CommandResultFactory({ data: SIGNATURE }));
  });
  return {
    api: { sendCommand } as unknown as InternalApi,
    sentCommands,
  };
}

function makeLogger(): LoggerPublisherService {
  return { debug: vi.fn() } as unknown as LoggerPublisherService;
}

function apduOf(cmd: Command<unknown, unknown>) {
  const raw = cmd.getApdu().getRawApdu();
  return {
    cla: raw[0]!,
    ins: raw[1]!,
    p1: raw[2]!,
    p2: raw[3]!,
    data: raw.slice(5),
  };
}

describe("SendPltTask", () => {
  it("should send one INIT frame and one CONT frame for a small payload", async () => {
    const { api, sentCommands } = makeApiMock();
    const transaction = buildTransaction();

    const result = await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction },
      makeLogger(),
    ).run();

    expect(sentCommands).toHaveLength(2);
    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(SIGNATURE);
    }
  });

  it("should build the INIT frame as path + header + kind + tokenIdLength + tokenId + cborLength", async () => {
    const { api, sentCommands } = makeApiMock();
    const tokenId = new TextEncoder().encode("PLT");
    const cbor = new Uint8Array(9).fill(0x01);
    const transaction = buildTransaction({ tokenId, cbor });

    await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction },
      makeLogger(),
    ).run();

    const init = apduOf(sentCommands[0]!);
    const pathBytes = encodeDerivationPath(DERIVATION_PATH);
    const expected = new Uint8Array([
      ...pathBytes,
      ...HEADER,
      KIND_TOKEN_UPDATE,
      tokenId.length,
      ...tokenId,
      0x00,
      0x00,
      0x00,
      cbor.length,
    ]);

    expect(init.cla).toBe(LEDGER_CLA);
    expect(init.ins).toBe(INS.SIGN_PLT);
    expect(init.p1).toBe(P1.PLT_INIT);
    expect(init.data).toStrictEqual(expected);
  });

  it("should carry P2=0x00 on the INIT frame and append no fee suffix", async () => {
    const { api, sentCommands } = makeApiMock();
    const transaction = buildTransaction();

    await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction },
      makeLogger(),
    ).run();

    const init = apduOf(sentCommands[0]!);
    const pathBytes = encodeDerivationPath(DERIVATION_PATH);
    const tokenIdLength = 3;

    expect(init.p2).toBe(0x00);
    // Ends exactly at cbor_total_length: no trailing 8-byte fee.
    expect(init.data).toHaveLength(
      pathBytes.length + 60 + 1 + 1 + tokenIdLength + 4,
    );
  });

  it("should send the CBOR payload as CONT frames of at most APDU_MAX_PAYLOAD bytes", async () => {
    const { api, sentCommands } = makeApiMock();
    const cbor = new Uint8Array(300);
    cbor.forEach((_, i) => (cbor[i] = i & 0xff));
    const transaction = buildTransaction({ cbor });

    await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction },
      makeLogger(),
    ).run();

    expect(sentCommands).toHaveLength(3);
    const first = apduOf(sentCommands[1]!);
    const second = apduOf(sentCommands[2]!);

    expect(first.p1).toBe(P1.PLT_CONT);
    expect(second.p1).toBe(P1.PLT_CONT);
    expect(first.data).toStrictEqual(cbor.slice(0, APDU_MAX_PAYLOAD));
    expect(second.data).toStrictEqual(cbor.slice(APDU_MAX_PAYLOAD));
  });

  it("should split a CBOR field across a frame boundary without realigning", async () => {
    const { api, sentCommands } = makeApiMock();
    // Index 254 is the last byte of the first frame, index 255 the first byte
    // of the second, so these two markers straddle the boundary.
    const cbor = new Uint8Array(260).fill(0x5a);
    cbor[APDU_MAX_PAYLOAD - 1] = 0xf0;
    cbor[APDU_MAX_PAYLOAD] = 0xf1;
    const transaction = buildTransaction({ cbor });

    await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction },
      makeLogger(),
    ).run();

    const first = apduOf(sentCommands[1]!);
    const second = apduOf(sentCommands[2]!);

    expect(first.data[APDU_MAX_PAYLOAD - 1]).toBe(0xf0);
    expect(second.data[0]).toBe(0xf1);
  });

  it("should fit a 128-byte token id in the INIT frame", async () => {
    const { api, sentCommands } = makeApiMock();
    const tokenId = new Uint8Array(128).fill(0x41);
    const transaction = buildTransaction({ tokenId });

    const result = await new SendPltTask(
      api,
      { derivationPath: "44'/919'/0'/0'/0'", transaction },
      makeLogger(),
    ).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    const init = apduOf(sentCommands[0]!);
    expect(init.data.length).toBeLessThanOrEqual(APDU_MAX_PAYLOAD);
    const pathLength = encodeDerivationPath("44'/919'/0'/0'/0'").length;
    expect(init.data[pathLength + 60 + 1]).toBe(128);
  });

  it("should propagate an INIT frame failure without sending CONT frames", async () => {
    const failure = CommandResultFactory({
      error: { errorCode: ConcordiumErrorCodes.PLT_DATA_ERROR },
    } as never);
    const { api, sentCommands } = makeApiMock([failure]);

    const result = await new SendPltTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction: buildTransaction() },
      makeLogger(),
    ).run();

    expect(sentCommands).toHaveLength(1);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("should propagate a CONT frame failure and stop streaming", async () => {
    const success = CommandResultFactory({ data: new Uint8Array() });
    const failure = CommandResultFactory({
      error: { errorCode: ConcordiumErrorCodes.PLT_CBOR_ERROR },
    } as never);
    const { api, sentCommands } = makeApiMock([success, failure]);
    const cbor = new Uint8Array(300).fill(0x00);

    const result = await new SendPltTask(
      api,
      {
        derivationPath: DERIVATION_PATH,
        transaction: buildTransaction({ cbor }),
      },
      makeLogger(),
    ).run();

    expect(sentCommands).toHaveLength(2);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  describe("firmware fixture parity", () => {
    // Fixtures from app-concordium/tests/standalone/test_sign_plt.py.
    // _HEADER_60: sender[32] + seq_num[8]=10 + energy[8]=100 + payload_size[4]
    // + expiry[8]=0x63de5da7.
    const FIXTURE_HEADER = Uint8Array.from(
      Buffer.from(
        "20a845815bd43a1999e90fbf971537a70392eb38f89e6bd32b3dd70e1a9551d7" +
          "000000000000000a" +
          "0000000000000064" +
          "00000000" +
          "0000000063de5da7",
        "hex",
      ),
    );
    // _TOKEN_ID_MIN = b"T"
    const FIXTURE_TOKEN_ID = new Uint8Array([0x54]);
    // _CBOR_SMALL = array(1) [ map(1) { "pause": map(0) } ]
    const FIXTURE_CBOR = new Uint8Array([
      0x81, 0xa1, 0x65, 0x70, 0x61, 0x75, 0x73, 0x65, 0xa0,
    ]);
    // Fixture path, without the "m/" prefix that encodeDerivationPath rejects.
    const FIXTURE_PATH = "1105/0/0/0/0/2/0/0";
    // Expected wire bytes for FIXTURE_PATH, written out literally so that a
    // regression in encodeDerivationPath fails this test rather than being
    // cancelled out by using the same function on both sides.
    //
    // [depth:1 = 8][node:4 BE] x 8, every node hardened. The firmware fixture
    // sends these nodes UNhardened, because ragger's pack_derivation_path only
    // sets the hardened bit for elements written with a "\'" suffix. That is not
    // a divergence in practice: parse_derivation_path() calls
    // harden_derivation_path() unconditionally (derivation_path.c:119), so the
    // device hardens every node whatever arrives on the wire.
    const FIXTURE_PATH_BYTES = Uint8Array.from(
      Buffer.from(
        "08" +
          "80000451" + // 1105'
          "80000000" + // 0'
          "80000000" + // 0'
          "80000000" + // 0'
          "80000000" + // 0'
          "80000002" + // 2'
          "80000000" + // 0'
          "80000000", // 0'
        "hex",
      ),
    );

    function fixtureTransaction(cbor: Uint8Array): Uint8Array {
      const tx = new Uint8Array(60 + 1 + 1 + 1 + 4 + cbor.length);
      tx.set(FIXTURE_HEADER, 0);
      tx[60] = KIND_TOKEN_UPDATE;
      tx[61] = FIXTURE_TOKEN_ID.length;
      tx.set(FIXTURE_TOKEN_ID, 62);
      new DataView(tx.buffer, tx.byteOffset).setUint32(63, cbor.length, false);
      tx.set(cbor, 67);
      return tx;
    }

    it("should match the INIT frame bytes the firmware fixture sends", async () => {
      const { api, sentCommands } = makeApiMock();

      await new SendPltTask(
        api,
        {
          derivationPath: FIXTURE_PATH,
          transaction: fixtureTransaction(FIXTURE_CBOR),
        },
        makeLogger(),
      ).run();

      const init = apduOf(sentCommands[0]!);
      // test_sign_plt_ui.py:450 —
      // pack_derivation_path(path) + header_60 + [0x1B, len(token_id)]
      // + token_id + len(cbor).to_bytes(4, "big")
      const expected = new Uint8Array([
        ...FIXTURE_PATH_BYTES,
        ...FIXTURE_HEADER,
        0x1b,
        FIXTURE_TOKEN_ID.length,
        ...FIXTURE_TOKEN_ID,
        0x00,
        0x00,
        0x00,
        FIXTURE_CBOR.length,
      ]);

      expect(init.data).toStrictEqual(expected);
    });

    it("should encode the fixture derivation path as the firmware parses it", () => {
      expect(encodeDerivationPath(FIXTURE_PATH)).toStrictEqual(
        FIXTURE_PATH_BYTES,
      );
    });

    it("should split a 512-byte payload as 255 + 255 + 2, matching test_sign_plt_exact_cbor_max", async () => {
      const { api, sentCommands } = makeApiMock();
      const cbor = new Uint8Array(512);

      await new SendPltTask(
        api,
        { derivationPath: FIXTURE_PATH, transaction: fixtureTransaction(cbor) },
        makeLogger(),
      ).run();

      const contLengths = sentCommands
        .slice(1)
        .map((cmd) => apduOf(cmd).data.length);

      expect(contLengths).toStrictEqual([255, 255, 2]);
    });

    it("should send a 300-byte payload as two CONT frames, matching test_sign_plt_multi_cont_frame", async () => {
      const { api, sentCommands } = makeApiMock();
      const cbor = new Uint8Array(300);

      await new SendPltTask(
        api,
        { derivationPath: FIXTURE_PATH, transaction: fixtureTransaction(cbor) },
        makeLogger(),
      ).run();

      const contLengths = sentCommands
        .slice(1)
        .map((cmd) => apduOf(cmd).data.length);

      expect(contLengths).toStrictEqual([255, 45]);
    });
  });

  describe("local validation", () => {
    async function expectRejection(transaction: Uint8Array) {
      const { api, sentCommands } = makeApiMock();

      const result = await new SendPltTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction },
        makeLogger(),
      ).run();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(
          (result.error as ConcordiumAppCommandError).errorCode,
        ).toStrictEqual(ConcordiumErrorCodes.INVALID_PLT_TRANSACTION);
      }
      return result;
    }

    it("should reject a transaction shorter than the minimum layout", async () => {
      await expectRejection(new Uint8Array(66).fill(0x00));
    });

    it("should reject a transaction kind other than 27", async () => {
      await expectRejection(buildTransaction({ kind: 22 }));
    });

    it("should reject a token id length of 0", async () => {
      await expectRejection(buildTransaction({ tokenIdLengthByte: 0 }));
    });

    it("should reject a token id length above 128", async () => {
      await expectRejection(
        buildTransaction({
          tokenId: new Uint8Array(129).fill(0x41),
        }),
      );
    });

    it("should reject a declared CBOR length of 0", async () => {
      await expectRejection(buildTransaction({ declaredCborLength: 0 }));
    });

    it("should reject a declared CBOR length above 512", async () => {
      await expectRejection(buildTransaction({ declaredCborLength: 513 }));
    });

    it("should reject a declared CBOR length that disagrees with the payload", async () => {
      await expectRejection(buildTransaction({ declaredCborLength: 8 }));
    });

    it("should reject a transaction truncated before the CBOR length field", async () => {
      // Declares a 60-byte token id but carries only 70 bytes in total, so the
      // length field starts past the end of the buffer.
      const tx = new Uint8Array(70).fill(0x00);
      tx[60] = KIND_TOKEN_UPDATE;
      tx[61] = 60;
      await expectRejection(tx);
    });
  });
});

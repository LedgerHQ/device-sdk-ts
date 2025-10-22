/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import {
  MAX_MESSAGE_LENGTH,
  MessageFormat,
  SendSignMessageTask,
} from "@internal/app-binder/task/SendSignMessageTask";

const DERIVATION_PATH = "44'/501'/0'/0'";
const PUBKEY = new Uint8Array(32).fill(0x11);
const PUBKEY_BASE58 = DefaultBs58Encoder.encode(PUBKEY);

function solanaHeaderErr() {
  return {
    _tag: "SolanaAppCommandError",
    errorCode: "6a81",
    message: "Invalid off-chain message header",
  } as const;
}

describe("SendSignMessageTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run()", () => {
    it("errors on empty message before any device call", async () => {
      const result = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: new Uint8Array([]),
      }).run();

      expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
      expect((result as any).error).toEqual(
        new InvalidStatusWordError("Message cannot be empty"),
      );
    });

    it("errors when GET_PUBKEY fails", async () => {
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("pubkey error"),
        }),
      );

      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: new Uint8Array([1, 2, 3]),
      }).run();

      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect((res as any).error).toEqual(
        new InvalidStatusWordError("Error getting public key from device"),
      );
    });

    it("surfaces command error when signing fails", async () => {
      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 })) // pubkey
        .mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("no signature returned"),
          }),
        );

      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: new Uint8Array([0xaa, 0xbb]),
      }).run();

      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((res as any).error).toEqual(
        new InvalidStatusWordError("no signature returned"),
      );
    });

    it("returns base58 envelope when signing succeeds", async () => {
      // given
      const msg = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);
      const rawSig = new Uint8Array(64).fill(0x33); // mock 64-byte signature

      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 })) // pubkey
        .mockResolvedValueOnce(CommandResultFactory({ data: rawSig })); // v0 last chunk

      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: msg,
      });
      const v0OCM: Uint8Array = task._buildFullMessage(msg, PUBKEY, false);

      // when
      const res = await task.run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect("data" in res).toBe(true);
      const b58 = (res as any).data.signature as string;

      // expected envelope = [1][rawSig][v0OCM]
      const expected = new Uint8Array(1 + rawSig.length + v0OCM.length);
      expected.set(Uint8Array.of(1), 0);
      expected.set(rawSig, 1);
      expected.set(v0OCM, 1 + rawSig.length);

      expect(DefaultBs58Encoder.decode(b58)).toEqual(expected);
    });

    it("rejects invalid derivation path", async () => {
      const args = {
        derivationPath: "not/a/path",
        sendingData: new Uint8Array([1]),
      };
      await expect(
        new SendSignMessageTask(apiMock, args).run(),
      ).rejects.toThrow();
    });

    it("builds APDU command with correct structure (prefix + tail)", () => {
      const msg = new Uint8Array([1, 2, 3]);
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: msg,
      });

      const fullMsg = task._buildFullMessage(msg, PUBKEY, false);
      const paths = [44 | 0x80000000, 501 | 0x80000000, 0 | 0x80000000, 0];
      const apdu = task._buildApduCommand(fullMsg, paths);

      // first byte: number of signers
      expect(apdu[0]).toBe(1);
      // second byte: number of derivation indices
      expect(apdu[1]).toBe(paths.length);
      // tail equals the serialized OCM
      expect(apdu.slice(apdu.length - fullMsg.length)).toEqual(fullMsg);
    });

    it("handles large messages via chunking (no exact call count assertion)", async () => {
      const bigMsg = new Uint8Array(4000).fill(0x01);
      const rawSig = new Uint8Array(64).fill(0x44);

      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 })) // pubkey
        .mockResolvedValue(CommandResultFactory({ data: rawSig })); // all subsequent chunks

      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: bigMsg,
      }).run();

      expect("data" in res).toBe(true);
    });

    it("errors on message exceeding v0 max (65515)", async () => {
      const tooBig = new Uint8Array(MAX_MESSAGE_LENGTH + 1).fill(0xaa);
      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: tooBig,
      }).run();

      expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
      expect((res as any).error).toEqual(
        new InvalidStatusWordError(
          `Message too long: ${tooBig.length} bytes (max is ${MAX_MESSAGE_LENGTH})`,
        ),
      );
    });

    it("falls back to legacy when v0 returns 6a81 (header error)", async () => {
      // given
      const msg = new Uint8Array([0x61, 0x62, 0x63]); // "abc"
      const rawSig = new Uint8Array(64).fill(0x55);

      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 })) // pubkey
        .mockResolvedValueOnce(
          CommandResultFactory({ error: solanaHeaderErr() as any }),
        ) // v0 -> 6a81
        .mockResolvedValueOnce(CommandResultFactory({ data: rawSig })); // legacy -> OK

      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: msg,
      });

      // build expected LEGACY OCM to verify envelope
      const legacyOCM: Uint8Array = task._buildFullMessage(msg, PUBKEY, true);

      // when
      const res = await task.run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3); // pubkey + v0 + legacy
      const b58 = (res as any).data.signature as string;

      const expected = new Uint8Array(1 + rawSig.length + legacyOCM.length);
      expected.set(Uint8Array.of(1), 0);
      expected.set(rawSig, 1);
      expected.set(legacyOCM, 1 + rawSig.length);

      expect(DefaultBs58Encoder.decode(b58)).toEqual(expected);
    });

    it("does NOT fallback on non-6a81 errors", async () => {
      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
        .mockResolvedValueOnce(
          CommandResultFactory({ error: new InvalidStatusWordError("oups") }),
        );

      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: new Uint8Array([1, 2]),
      }).run();

      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
    });

    it("propagates 6a81 if body is too large for legacy", async () => {
      const msg = new Uint8Array(2000).fill(0x31); // > 1232 legacy limit

      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 })) // pubkey
        .mockResolvedValueOnce(
          CommandResultFactory({ error: solanaHeaderErr() as any }),
        ); // v0 -> 6a81

      const res = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: msg,
      }).run();

      // no legacy retry
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((res as any).error).toEqual(solanaHeaderErr());
    });
  });

  describe("message format detection (indirect via header byte)", () => {
    it("sets format=0 for ASCII ≤ maxLedgerLen (v0 header)", () => {
      const ascii = new TextEncoder().encode("hello\nworld"); // newline allowed in non-legacy
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: ascii,
      });
      const v0 = task._buildFullMessage(ascii, PUBKEY, false);
      // in v0 format byte is at offset: 16 (domain) + 1 (ver) + 32 (app) = 49
      expect(v0[49]).toBe(MessageFormat.Ascii);
    });

    it("sets format=1 for short UTF-8 non-ASCII (v0 header)", () => {
      const utf8 = new TextEncoder().encode("héllø");
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: utf8,
      });
      const v0 = task._buildFullMessage(utf8, PUBKEY, false);
      expect(v0[49]).toBe(MessageFormat.Utf8);
    });

    it("sets format=2 for long UTF-8 (v0 header)", () => {
      // must exceed OFFCM_MAX_LEDGER_LEN to get format=2
      const longUtf8 = new TextEncoder().encode("x".repeat(15313));
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: longUtf8,
      });
      const v0 = task._buildFullMessage(longUtf8, PUBKEY, false);
      expect(v0[49]).toBe(MessageFormat.Utf8LongV0);
    });

    it("legacy header forbids newline in ASCII (so format becomes UTF-8=1)", () => {
      const asciiWithNl = new TextEncoder().encode("hello\nworld");
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: asciiWithNl,
      });
      const legacy = task._buildFullMessage(asciiWithNl, PUBKEY, true);
      // in legacy: format byte is at offset 16 (domain) + 1 (ver) = 17
      expect(legacy[17]).toBe(MessageFormat.Utf8);
    });

    it("legacy header sets format=0 for plain ASCII (no newline)", () => {
      const ascii = new TextEncoder().encode("HELLO_123");
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: ascii,
      });
      const legacy = task._buildFullMessage(ascii, PUBKEY, true);
      expect(legacy[17]).toBe(MessageFormat.Ascii);
    });

    it("message length is little-endian in both headers", () => {
      const body = new Uint8Array([1, 2, 3]); // length = 3
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: body,
      });

      // v0 offsets:
      // length starts at: 16(domain) + 1(ver) + 32(app) + 1(format) + 1(count) + 32(pubkey) = 83
      const v0 = task._buildFullMessage(body, PUBKEY, false);
      expect(v0[83]).toBe(3); // LSB (0x03)
      expect(v0[84]).toBe(0); // MSB (0x00)

      // legacy offsets:
      // length starts at: 16(domain) + 1(ver) + 1(format) = 18
      const legacy = task._buildFullMessage(body, PUBKEY, true);
      expect(legacy[18]).toBe(3); // LSB (0x03)
      expect(legacy[19]).toBe(0); // MSB (0x00)
    });
  });

  it("returns error when device returns non-64-byte signature on final chunk", async () => {
    const msg = new Uint8Array([1, 2, 3]);

    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
      .mockResolvedValueOnce(CommandResultFactory({ data: new Uint8Array(0) }));

    const res = await new SendSignMessageTask(apiMock, {
      derivationPath: DERIVATION_PATH,
      sendingData: msg,
    }).run();

    expect("error" in res).toBe(true);

    const err = (res as any).error as unknown;
    expect(err).toBeInstanceOf(InvalidStatusWordError);
  });
});

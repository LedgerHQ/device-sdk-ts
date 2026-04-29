/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { SignMessageVersion } from "@api/model/MessageOptions";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import {
  OffchainMessageBuilder,
  OFFCHAINMSG_MAX_V0_LEN,
} from "@internal/app-binder/services/OffchainMessageBuilder";
import { SendSignMessageTask } from "@internal/app-binder/task/SendSignMessageTask";

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

function makeTask(
  apiMock: ReturnType<typeof makeDeviceActionInternalApiMock>,
  overrides: Partial<ConstructorParameters<typeof SendSignMessageTask>[1]> = {},
): any {
  return new SendSignMessageTask(apiMock, {
    derivationPath: DERIVATION_PATH,
    sendingData: new Uint8Array([1, 2, 3]),
    ...overrides,
  });
}

describe("SendSignMessageTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const builder = new OffchainMessageBuilder();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // run()
  // ──────────────────────────────────────────────────────────────────────────

  describe("run()", () => {
    describe("common guards", () => {
      it("rejects Raw mode with a string message", async () => {
        const res = await makeTask(apiMock, {
          sendingData: "not a Uint8Array",
          version: SignMessageVersion.Raw,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
        expect((res as any).error.originalError.message).toContain(
          "Raw mode requires",
        );
      });

      it("accepts a string message for non-Raw modes", async () => {
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("pubkey error"),
          }),
        );

        const res = await makeTask(apiMock, {
          sendingData: "Hello World",
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
        expect((res as any).error).toEqual(
          new InvalidStatusWordError("Error getting public key from device"),
        );
      });

      it("errors on empty message before any device call", async () => {
        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array([]),
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toEqual(
          new InvalidStatusWordError("Message cannot be empty"),
        );
      });

      it("errors when GET_PUBKEY fails", async () => {
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("pubkey error"),
          }),
        );

        const res = await makeTask(apiMock).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
        expect((res as any).error).toEqual(
          new InvalidStatusWordError("Error getting public key from device"),
        );
      });

      it("rejects invalid derivation path", async () => {
        await expect(
          makeTask(apiMock, { derivationPath: "not/a/path" }).run(),
        ).rejects.toThrow();
      });

      it("enforces V0 size limit (65515 bytes)", async () => {
        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(OFFCHAINMSG_MAX_V0_LEN + 1).fill(0xaa),
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("accepts V0 message at exactly 65515 bytes (not rejected by guard)", async () => {
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("pubkey error"),
          }),
        );

        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(OFFCHAINMSG_MAX_V0_LEN).fill(0x41),
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
        expect((res as any).error).toEqual(
          new InvalidStatusWordError("Error getting public key from device"),
        );
      });

      it("rejects V0 message at 65516 bytes", async () => {
        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(OFFCHAINMSG_MAX_V0_LEN + 1).fill(0x41),
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("enforces Legacy size limit (1232 bytes)", async () => {
        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(1300).fill(0xcc),
          version: SignMessageVersion.Legacy,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("enforces V1 size limit (65535 bytes)", async () => {
        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(65536).fill(0xbb),
          version: SignMessageVersion.V1,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("accepts V1 message at exactly 65535 bytes", async () => {
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("pubkey error"),
          }),
        );

        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(65535).fill(0x41),
          version: SignMessageVersion.V1,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
        expect((res as any).error).toEqual(
          new InvalidStatusWordError("Error getting public key from device"),
        );
      });
    });

    describe("V0 (default)", () => {
      it("defaults to V0 and embeds V0 OCM in envelope", async () => {
        const msg = new TextEncoder().encode("A");
        const rawSig = new Uint8Array(64).fill(0x77);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const res = await makeTask(apiMock, { sendingData: msg }).run();
        expect("data" in res).toBe(true);

        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        // version byte = 0 at OCM offset 16 (after [sigCount(1)][sig(64)])
        expect(envelope[1 + 64 + 16]).toBe(0);
      });

      it("handles large messages via chunking", async () => {
        const rawSig = new Uint8Array(64).fill(0x44);
        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValue(CommandResultFactory({ data: rawSig }));

        const res = await makeTask(apiMock, {
          sendingData: new Uint8Array(4000).fill(0x01),
        }).run();

        expect("data" in res).toBe(true);
      });

      it("surfaces command error when signing fails", async () => {
        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({
              error: new InvalidStatusWordError("device error"),
            }),
          );

        const res = await makeTask(apiMock).run();

        expect((res as any).error).toEqual(
          new InvalidStatusWordError("device error"),
        );
      });

      it("returns error on non-64-byte signature", async () => {
        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ data: new Uint8Array(0) }),
          );

        const res = await makeTask(apiMock).run();

        expect("error" in res).toBe(true);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });
    });

    describe("V0", () => {
      it("returns base58 envelope with V0 OCM", async () => {
        const msg = new TextEncoder().encode("test");
        const rawSig = new Uint8Array(64).fill(0x33);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const v0OCM = builder.buildV0(msg, PUBKEY);
        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V0,
        }).run();

        expect("data" in res).toBe(true);
        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        const expected = new Uint8Array(1 + 64 + v0OCM.length);
        expected.set(Uint8Array.of(1), 0);
        expected.set(rawSig, 1);
        expected.set(v0OCM, 65);
        expect(envelope).toEqual(expected);
      });

      it("threads appDomain into the V0 envelope", async () => {
        const msg = new TextEncoder().encode("hi");
        const rawSig = new Uint8Array(64).fill(0x33);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V0,
          appDomain: "example.com",
        }).run();

        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        const domainBytes = envelope.slice(65 + 17, 65 + 49);
        const expected = new Uint8Array(32);
        expected.set(new TextEncoder().encode("example.com"));
        expect(domainBytes).toEqual(expected);
      });

      it("does NOT fallback on non-6a81 errors", async () => {
        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({
              error: new InvalidStatusWordError("oops"),
            }),
          );

        const res = await makeTask(apiMock, {
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });
    });

    describe("Legacy", () => {
      it("builds compact legacy OCM and wraps in envelope", async () => {
        const msg = new Uint8Array([0x41, 0x42]);
        const rawSig = new Uint8Array(64).fill(0x66);

        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: rawSig }),
        );

        const legacyOCM = builder.buildLegacy(msg);
        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.Legacy,
        }).run();

        expect("data" in res).toBe(true);
        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        const expected = new Uint8Array(1 + 64 + legacyOCM.length);
        expected.set(Uint8Array.of(1), 0);
        expected.set(rawSig, 1);
        expected.set(legacyOCM, 65);
        expect(envelope).toEqual(expected);
      });

      it("does not call GET_PUBKEY", async () => {
        const rawSig = new Uint8Array(64).fill(0x66);
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: rawSig }),
        );

        await makeTask(apiMock, {
          sendingData: new Uint8Array([0x41]),
          version: SignMessageVersion.Legacy,
        }).run();

        const calls = apiMock.sendCommand.mock.calls;
        expect(
          calls.every(
            ([cmd]: any[]) => !(cmd?.constructor?.name === "GetPubKeyCommand"),
          ),
        ).toBe(true);
      });
    });

    describe("Raw", () => {
      it("sends raw bytes with no header, returns base58 signature", async () => {
        const msg = new Uint8Array([0xde, 0xad]);
        const rawSig = new Uint8Array(64).fill(0x88);

        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: rawSig }),
        );

        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.Raw,
        }).run();

        expect("data" in res).toBe(true);
        const b58 = (res as any).data.signature as string;
        expect(DefaultBs58Encoder.decode(b58)).toEqual(rawSig);
      });

      it("does not call GET_PUBKEY", async () => {
        const rawSig = new Uint8Array(64).fill(0x88);
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: rawSig }),
        );

        await makeTask(apiMock, {
          version: SignMessageVersion.Raw,
        }).run();

        const calls = apiMock.sendCommand.mock.calls;
        expect(
          calls.every(
            ([cmd]: any[]) => !(cmd?.constructor?.name === "GetPubKeyCommand"),
          ),
        ).toBe(true);
      });

      it("returns error when signature is not 64 bytes", async () => {
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(32) }),
        );

        const res = await makeTask(apiMock, {
          version: SignMessageVersion.Raw,
        }).run();

        expect("error" in res).toBe(true);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });
    });

    describe("fallback cascade", () => {
      it("V0 -> Legacy on 6a81", async () => {
        const msg = new Uint8Array([0x61, 0x62, 0x63]);
        const rawSig = new Uint8Array(64).fill(0x55);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          )
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const legacyOCM = builder.buildLegacy(msg);
        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        expect(envelope.slice(65)).toEqual(legacyOCM);
      });

      it("V0 -> size error when body exceeds legacy limit", async () => {
        const msg = new Uint8Array(2000).fill(0x31);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          );

        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V0,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("V1 -> V0 on 6a81", async () => {
        const msg = new Uint8Array([0x61, 0x62]);
        const rawSig = new Uint8Array(64).fill(0x99);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          )
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const v0OCM = builder.buildV0(msg, PUBKEY);
        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V1,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        expect(envelope.slice(65)).toEqual(v0OCM);
      });

      it("V1 -> V0 size error when message exceeds V0 limit", async () => {
        const msg = new Uint8Array(65520).fill(0x41);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          );

        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V1,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
        expect((res as any).error).toBeInstanceOf(InvalidStatusWordError);
      });

      it("V1 -> V0 -> Legacy on double 6a81", async () => {
        const msg = new Uint8Array([0x63]);
        const rawSig = new Uint8Array(64).fill(0xaa);

        apiMock.sendCommand
          .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          )
          .mockResolvedValueOnce(
            CommandResultFactory({ error: solanaHeaderErr() as any }),
          )
          .mockResolvedValueOnce(CommandResultFactory({ data: rawSig }));

        const legacyOCM = builder.buildLegacy(msg);
        const res = await makeTask(apiMock, {
          sendingData: msg,
          version: SignMessageVersion.V1,
        }).run();

        expect(apiMock.sendCommand).toHaveBeenCalledTimes(4);
        const envelope = DefaultBs58Encoder.decode(
          (res as any).data.signature as string,
        );
        expect(envelope.slice(65)).toEqual(legacyOCM);
      });
    });
  });
});

import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import {
  type GetFullViewingKeyCommand,
  P2_VK,
} from "@internal/app-binder/command/GetFullViewingKeyCommand";

import {
  GetFullViewingKeyTask,
  ORCHARD_FVK_BYTE_LENGTH,
} from "./GetFullViewingKeyTask";

/**
 * Decodes the prefixed derivation path groups from a GET_VK APDU data field.
 * The layout is `[len][elem*4]...` repeated, so UFVK exports return the orchard
 * path followed by the transparent path.
 */
function readPathsFromApdu(command: GetFullViewingKeyCommand): string[] {
  const raw = command.getApdu().getRawApdu();
  const data = raw.slice(5);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const paths: string[] = [];
  let i = 0;
  while (i < data.length) {
    const len = data[i]!;
    i += 1;
    const elements: string[] = [];
    for (let e = 0; e < len; e += 1) {
      const value = view.getUint32(i, false);
      i += 4;
      const hardened = (value & 0x80000000) !== 0;
      elements.push(`${value & 0x7fffffff}${hardened ? "'" : ""}`);
    }
    paths.push(elements.join("/"));
  }
  return paths;
}

describe("GetFullViewingKeyTask", () => {
  const path = "44'/133'/0'/0/0";

  const okUfvk = () => {
    const utf8 = new TextEncoder().encode("uviewtest");
    const data = new Uint8Array(2 + utf8.length);
    new DataView(data.buffer).setUint16(0, utf8.length, false);
    data.set(utf8, 2);
    return CommandResultFactory({ data: { data } });
  };

  it("should send 32'/coin'/account' orchard and 44'/coin'/account' transparent paths for a BIP-44 UFVK input", async () => {
    const sendCommand = vi.fn().mockResolvedValue(okUfvk());
    const api = { sendCommand } as unknown as InternalApi;

    await new GetFullViewingKeyTask(api, {
      derivationPath: "44'/133'/0'/0/0",
      mode: "ufvk",
    }).run();

    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    expect(readPathsFromApdu(c1)).toEqual(["32'/133'/0'", "44'/133'/0'"]);
  });

  it("should send 32'/coin'/account' orchard and 44'/coin'/account' transparent paths for a ZIP-32 UFVK input", async () => {
    const sendCommand = vi.fn().mockResolvedValue(okUfvk());
    const api = { sendCommand } as unknown as InternalApi;

    await new GetFullViewingKeyTask(api, {
      derivationPath: "32'/133'/0'",
      mode: "ufvk",
    }).run();

    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    expect(readPathsFromApdu(c1)).toEqual(["32'/133'/0'", "44'/133'/0'"]);
  });

  it("should reject a UFVK request when the derivation path has fewer than three levels", async () => {
    const sendCommand = vi.fn();
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: "32'/133'",
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toContain(
        "must have at least purpose/coin/account levels",
      );
    }
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("should parse single-chunk UFVK (u16 length + UTF-8)", async () => {
    const ufvk = "uviewtest";
    const te = new TextEncoder();
    const utf8 = te.encode(ufvk);
    const data = new Uint8Array(2 + utf8.length);
    new DataView(data.buffer).setUint16(0, utf8.length, false);
    data.set(utf8, 2);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result) && result.data.mode === "ufvk") {
      expect(result.data.fullViewingKey).toBe(ufvk);
    }
    expect(sendCommand).toHaveBeenCalledOnce();
  });

  it("should not send CONTINUE when UFVK assembled size is exactly 255 bytes (one full chunk)", async () => {
    const strLen = 253;
    const assembled = new Uint8Array(255);
    new DataView(assembled.buffer).setUint16(0, strLen, false);
    assembled.fill(0x61, 2, 2 + strLen);
    const expectedKey = "a".repeat(strLen);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data: assembled },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result) && result.data.mode === "ufvk") {
      expect(result.data.fullViewingKey).toBe(expectedKey);
    }
    expect(sendCommand).toHaveBeenCalledOnce();
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.UFVK);
  });

  it("should not send CONTINUE after the last UFVK chunk when assembled size is exactly 510 bytes (two full chunks)", async () => {
    const strLen = 508;
    const assembled = new Uint8Array(510);
    new DataView(assembled.buffer).setUint16(0, strLen, false);
    assembled.fill(0x62, 2, 2 + strLen);
    const chunk0 = assembled.slice(0, APDU_MAX_PAYLOAD);
    const chunk1 = assembled.slice(APDU_MAX_PAYLOAD);
    expect(chunk0.length).toBe(255);
    expect(chunk1.length).toBe(255);
    const expectedKey = "b".repeat(strLen);

    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: chunk0 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: chunk1 } }));

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result) && result.data.mode === "ufvk") {
      expect(result.data.fullViewingKey).toBe(expectedKey);
    }
    expect(sendCommand).toHaveBeenCalledTimes(2);
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    const c2 = sendCommand.mock.calls[1]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.UFVK);
    expect(c2.getApdu().getRawApdu()[2]).toBe(0x80);
    expect(c2.getApdu().getRawApdu()[3]).toBe(P2_VK.UFVK);
  });

  it("should reject UFVK when declared string length exceeds available bytes", async () => {
    const assembled = new Uint8Array([0x00, 0x05, 0x61, 0x62, 0x63]);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data: assembled },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        "UFVK string is truncated",
      );
    }
  });

  it("should reject UFVK when payload is not valid UTF-8", async () => {
    const assembled = new Uint8Array([0x00, 0x02, 0xc3, 0x28]);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data: assembled },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        "UFVK is not valid UTF-8",
      );
    }
  });

  it("should reject UFVK when response contains trailing bytes after declared string", async () => {
    const ufvk = "uviewtest";
    const utf8 = new TextEncoder().encode(ufvk);
    const assembled = new Uint8Array(2 + utf8.length + 1);
    new DataView(assembled.buffer).setUint16(0, utf8.length, false);
    assembled.set(utf8, 2);
    assembled[assembled.length - 1] = 0xff;

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data: assembled },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "ufvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        "UFVK response has extra trailing bytes",
      );
    }
  });

  it("should return a single-chunk Orchard FVK when length is exactly 96 bytes", async () => {
    const data = new Uint8Array(ORCHARD_FVK_BYTE_LENGTH).fill(0xab);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result) && result.data.mode === "orchardFvk") {
      expect(result.data.fullViewingKey.length).toBe(ORCHARD_FVK_BYTE_LENGTH);
      expect(result.data.fullViewingKey.at(0)).toBe(0xab);
      expect(result.data.fullViewingKey.at(-1)).toBe(0xab);
    }
    expect(sendCommand).toHaveBeenCalledOnce();
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[1]).toBe(0x50);
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });

  it("should hint UFVK framing when Orchard mode receives u16-length-prefixed payload (device returned UFVK bytes)", async () => {
    const strLen = 302;
    const assembled = new Uint8Array(2 + strLen);
    new DataView(assembled.buffer).setUint16(0, strLen, false);
    assembled.fill(0x61, 2, 2 + strLen);

    const chunk0 = assembled.slice(0, APDU_MAX_PAYLOAD);
    const chunk1 = assembled.slice(APDU_MAX_PAYLOAD);
    expect(chunk0.length).toBe(255);
    expect(chunk1.length).toBe(49);
    expect(chunk0.length + chunk1.length).toBe(304);

    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: chunk0 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: chunk1 } }));

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toContain(
        "Payload matches UFVK framing",
      );
      expect((err.originalError as { message: string }).message).toContain(
        "302",
      );
    }
  });

  it("should reject Orchard FVK when assembled length is not 96 bytes", async () => {
    const data = new Uint8Array(ORCHARD_FVK_BYTE_LENGTH - 1).fill(0xcd);

    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        data: { data },
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${ORCHARD_FVK_BYTE_LENGTH - 1})`,
      );
    }
  });

  it("should reassemble multiple chunks then validate Orchard FVK length", async () => {
    const a = new Uint8Array(APDU_MAX_PAYLOAD).fill(0xab);
    const b = new Uint8Array(10).fill(0xcd);

    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: a } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: b } }));

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${APDU_MAX_PAYLOAD + 10})`,
      );
    }
    expect(sendCommand).toHaveBeenCalledTimes(2);
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    const c2 = sendCommand.mock.calls[1]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[1]).toBe(0x50);
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
    expect(c2.getApdu().getRawApdu()[2]).toBe(0x80);
    expect(c2.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });

  it("should issue another GET_VK continue when a chunk is exactly APDU_MAX_PAYLOAD and more data follows", async () => {
    const full1 = new Uint8Array(APDU_MAX_PAYLOAD).fill(0x11);
    const full2 = new Uint8Array(APDU_MAX_PAYLOAD).fill(0x22);
    const tail = new Uint8Array(12).fill(0x33);

    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: full1 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: full2 } }))
      .mockResolvedValueOnce(CommandResultFactory({ data: { data: tail } }));

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      const err = result.error as InvalidStatusWordError;
      expect((err.originalError as { message: string }).message).toBe(
        `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${APDU_MAX_PAYLOAD * 2 + tail.length})`,
      );
    }
    expect(sendCommand).toHaveBeenCalledTimes(3);
    const c3 = sendCommand.mock.calls[2]![0] as GetFullViewingKeyCommand;
    expect(c3.getApdu().getRawApdu()[2]).toBe(0x80);
    expect(c3.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });

  it("should return initial GET_VK error without requesting continuation", async () => {
    const failingResult = CommandResultFactory({
      error: new InvalidStatusWordError("first GET_VK failed"),
    });
    const sendCommand = vi.fn().mockResolvedValueOnce(failingResult);

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(result).toStrictEqual(failingResult);
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sendCommand).toHaveBeenCalledOnce();
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });

  it("should return continuation GET_VK error immediately without extra continuation calls", async () => {
    const firstChunk = new Uint8Array(APDU_MAX_PAYLOAD).fill(0x42);
    const failingResult = CommandResultFactory({
      error: new InvalidStatusWordError("continuation GET_VK failed"),
    });
    const sendCommand = vi
      .fn()
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { data: firstChunk } }),
      )
      .mockResolvedValueOnce(failingResult);

    const api = { sendCommand } as unknown as InternalApi;
    const result = await new GetFullViewingKeyTask(api, {
      derivationPath: path,
      mode: "orchardFvk",
    }).run();

    expect(result).toStrictEqual(failingResult);
    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sendCommand).toHaveBeenCalledTimes(2);
    const c1 = sendCommand.mock.calls[0]![0] as GetFullViewingKeyCommand;
    const c2 = sendCommand.mock.calls[1]![0] as GetFullViewingKeyCommand;
    expect(c1.getApdu().getRawApdu()[2]).toBe(0x00);
    expect(c1.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
    expect(c2.getApdu().getRawApdu()[2]).toBe(0x80);
    expect(c2.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });
});

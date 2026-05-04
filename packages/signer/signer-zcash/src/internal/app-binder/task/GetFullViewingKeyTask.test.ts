import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type GetFullViewingKeyCommand } from "@internal/app-binder/command/GetFullViewingKeyCommand";
import {
  P2_VK,
  VK_RESPONSE_CHUNK_SIZE,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import {
  GetFullViewingKeyTask,
  ORCHARD_FVK_BYTE_LENGTH,
} from "./GetFullViewingKeyTask";

describe("GetFullViewingKeyTask", () => {
  const path = "44'/133'/0'/0/0";

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

    const chunk0 = assembled.slice(0, VK_RESPONSE_CHUNK_SIZE);
    const chunk1 = assembled.slice(VK_RESPONSE_CHUNK_SIZE);
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
    const a = new Uint8Array(VK_RESPONSE_CHUNK_SIZE).fill(0xab);
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
        `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${VK_RESPONSE_CHUNK_SIZE + 10})`,
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

  it("should issue another GET_VK continue when a chunk is exactly VK_RESPONSE_CHUNK_SIZE and more data follows", async () => {
    const full1 = new Uint8Array(VK_RESPONSE_CHUNK_SIZE).fill(0x11);
    const full2 = new Uint8Array(VK_RESPONSE_CHUNK_SIZE).fill(0x22);
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
        `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${VK_RESPONSE_CHUNK_SIZE * 2 + tail.length})`,
      );
    }
    expect(sendCommand).toHaveBeenCalledTimes(3);
    const c3 = sendCommand.mock.calls[2]![0] as GetFullViewingKeyCommand;
    expect(c3.getApdu().getRawApdu()[2]).toBe(0x80);
    expect(c3.getApdu().getRawApdu()[3]).toBe(P2_VK.ORCHARD_FVK);
  });
});

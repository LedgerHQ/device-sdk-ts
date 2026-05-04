import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { type GetFullViewingKeyCommand } from "@internal/app-binder/command/GetFullViewingKeyCommand";
import {
  P2_VK,
  VK_RESPONSE_CHUNK_SIZE,
} from "@internal/app-binder/command/utils/apduHeaderUtils";

import { GetFullViewingKeyTask } from "./GetFullViewingKeyTask";

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

  it("should reassemble multiple chunks in orchardFvk mode", async () => {
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

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result) && result.data.mode === "orchardFvk") {
      expect(result.data.fullViewingKey.length).toBe(
        VK_RESPONSE_CHUNK_SIZE + 10,
      );
      expect(result.data.fullViewingKey.at(0)).toBe(0xab);
      expect(result.data.fullViewingKey.at(-1)).toBe(0xcd);
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
});

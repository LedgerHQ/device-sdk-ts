import { ApduResponse } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { SignPersonalMessageTask } from "./SignPersonalMessageTask";

function makeResponse(
  instructionByte: number,
  payload: Uint8Array,
): ApduResponse {
  const data = new Uint8Array(1 + payload.length);
  data[0] = instructionByte;
  data.set(payload, 1);
  return new ApduResponse({
    statusCode: new Uint8Array([0x90, 0x00]),
    data,
  });
}

describe("SignPersonalMessageTask", () => {
  it("should return 64-byte signature", async () => {
    const sendApdu = vi.fn();
    const signature = new Uint8Array(64).fill(0xcd);

    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, signature)),
    );

    const task = new SignPersonalMessageTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      message: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello"
    });
    const result = await task.run();

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.length).toBe(64);
      expect(result.data).toEqual(signature);
    }
  });

  it("should use INS 0x03 (same as signTransaction)", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array(64))),
    );

    const task = new SignPersonalMessageTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      message: new Uint8Array([0x01]),
    });
    await task.run();

    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[1]).toBe(0x03);
  });

  it("should send 2 params (message + path) in START", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array(64))),
    );

    const task = new SignPersonalMessageTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      message: new Uint8Array([0x01]),
    });
    await task.run();

    // START payload: [0x00] [hash1 (32)] [hash2 (32)] = 65 bytes
    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[4]).toBe(65); // data length = 1 + 32 + 32
  });
});

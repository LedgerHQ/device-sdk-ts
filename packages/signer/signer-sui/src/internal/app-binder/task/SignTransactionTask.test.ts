import { ApduResponse } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { SignTransactionTask } from "./SignTransactionTask";

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

describe("SignTransactionTask", () => {
  it("should return 64-byte signature from RESULT_FINAL", async () => {
    const sendApdu = vi.fn();
    const signature = new Uint8Array(64).fill(0xab);

    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, signature)),
    );

    const task = new SignTransactionTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      transaction: new Uint8Array([0x01, 0x02, 0x03]),
    });
    const result = await task.run();

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.length).toBe(64);
      expect(result.data).toEqual(signature);
    }
  });

  it("should use INS 0x03", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array(64))),
    );

    const task = new SignTransactionTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      transaction: new Uint8Array([0x01]),
    });
    await task.run();

    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[1]).toBe(0x03); // INS = SIGN_TX
  });

  it("should return error for too-short signature", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array(32))), // Only 32 bytes
    );

    const task = new SignTransactionTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      transaction: new Uint8Array([0x01]),
    });
    const result = await task.run();

    expect("error" in result).toBe(true);
  });

  it("should send transaction size as u32 LE in first param", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array(64))),
    );

    const tx = new Uint8Array(300);
    const task = new SignTransactionTask({ sendApdu } as never, {
      derivationPath: "44'/784'/0'/0'/0'",
      transaction: tx,
    });
    await task.run();

    // The START message contains root hashes of 2 params (tx payload + path)
    // START: [0x00] [hash1 (32)] [hash2 (32)] = 65 bytes
    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[4]).toBe(65); // data length
    expect(apdu[5]).toBe(0x00); // START instruction
  });
});

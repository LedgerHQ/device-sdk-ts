import { ApduResponse } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { GetAddressTask } from "./GetAddressTask";

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

describe("GetAddressTask", () => {
  const defaultArgs = {
    derivationPath: "44'/784'/0'/0'/0'",
    checkOnDevice: false,
  };

  it("should parse pubkey and address from response", async () => {
    const sendApdu = vi.fn();

    // Build response: [keySize=32] [32 bytes pubkey] [addrSize=32] [32 bytes addr]
    const pubkey = new Uint8Array(32).fill(0xaa);
    const addr = new Uint8Array(32).fill(0xbb);
    const responsePayload = new Uint8Array(1 + 32 + 1 + 32);
    responsePayload[0] = 32; // keySize
    responsePayload.set(pubkey, 1);
    responsePayload[33] = 32; // addressSize
    responsePayload.set(addr, 34);

    // Block protocol: START -> GET_CHUNK -> RESULT_FINAL with address data
    sendApdu
      .mockResolvedValueOnce(
        Right(makeResponse(0x01, responsePayload)), // Immediate RESULT_FINAL
      );

    const task = new GetAddressTask({ sendApdu } as never, defaultArgs);
    const result = await task.run();

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.publicKey).toEqual(pubkey);
      expect(result.data.address).toEqual(addr);
    }
  });

  it("should use INS 0x02 when checkOnDevice is false", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array([32, ...new Array(32).fill(0), 32, ...new Array(32).fill(0)]))),
    );

    const task = new GetAddressTask({ sendApdu } as never, {
      ...defaultArgs,
      checkOnDevice: false,
    });
    await task.run();

    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[1]).toBe(0x02); // INS = GET_PUBKEY
  });

  it("should use INS 0x01 when checkOnDevice is true", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array([32, ...new Array(32).fill(0), 32, ...new Array(32).fill(0)]))),
    );

    const task = new GetAddressTask({ sendApdu } as never, {
      ...defaultArgs,
      checkOnDevice: true,
    });
    await task.run();

    const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
    expect(apdu[1]).toBe(0x01); // INS = VERIFY_ADDRESS
  });
});

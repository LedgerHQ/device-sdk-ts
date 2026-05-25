import { ApduResponse } from "@ledgerhq/device-management-kit";
import { Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { GetVersionTask } from "./GetVersionTask";

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

describe("GetVersionTask", () => {
  it("should parse version from block protocol response", async () => {
    const sendApdu = vi.fn();
    // First call: START -> immediate RESULT_FINAL with version bytes
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array([1, 3, 5]))),
    );

    const task = new GetVersionTask({ sendApdu } as never);
    const result = await task.run();

    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data).toEqual({ major: 1, minor: 3, patch: 5 });
    }
  });

  it("should return error for too-short response", async () => {
    const sendApdu = vi.fn();
    sendApdu.mockResolvedValue(
      Right(makeResponse(0x01, new Uint8Array([1, 2]))),
    );

    const task = new GetVersionTask({ sendApdu } as never);
    const result = await task.run();

    expect("error" in result).toBe(true);
  });
});

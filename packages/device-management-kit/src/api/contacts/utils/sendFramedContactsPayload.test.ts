import { InvalidStatusWordError } from "@api/command/Errors";
import { CommandResultFactory } from "@api/command/model/CommandResult";
import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";

import { sendFramedContactsPayload } from "./sendFramedContactsPayload";

describe("sendFramedContactsPayload", () => {
  beforeEach(() => {
    // makeDeviceActionInternalApiMock returns shared module-level mocks —
    // clear call history between tests so per-test assertions are clean.
    vi.clearAllMocks();
  });

  function makePayload(byteCount: number, fillByte = 0x42): Uint8Array {
    return new Uint8Array(byteCount).fill(fillByte);
  }

  it("single-chunk: prepends BE length, uses P2=0x00, returns command result", async () => {
    const api = makeDeviceActionInternalApiMock();
    const finalResult = CommandResultFactory({
      data: { hmacRestHex: "aa".repeat(32) },
    });
    api.sendCommand.mockResolvedValueOnce(finalResult);

    const makeCommand = vi.fn((chunk: Uint8Array, p2: number) => ({
      name: "test",
      args: { chunk, p2 },
      getApdu: vi.fn(),
      parseResponse: vi.fn(),
    }));

    const payload = makePayload(100);
    const result = await sendFramedContactsPayload(api, {
      payload,
      p1: 0x04,
      makeCommand,
    });

    expect(makeCommand).toHaveBeenCalledTimes(1);
    const [chunk, p2] = makeCommand.mock.calls[0]!;
    expect(p2).toBe(0x00);
    // 2-byte BE length prefix = 100 → 0x00, 0x64
    expect(chunk[0]).toBe(0x00);
    expect(chunk[1]).toBe(0x64);
    expect(chunk.length).toBe(102);
    expect(result).toBe(finalResult);
  });

  it("multi-chunk: splits into ≤255B pieces, P2 sequence 0x00 then 0x80, frame prefix on first only", async () => {
    const api = makeDeviceActionInternalApiMock();
    const intermediateOk = CommandResultFactory({ data: {} });
    const finalResult = CommandResultFactory({
      data: { hmacRestHex: "bb".repeat(32) },
    });
    api.sendCommand
      .mockResolvedValueOnce(intermediateOk)
      .mockResolvedValueOnce(intermediateOk)
      .mockResolvedValueOnce(finalResult);

    const makeCommand = vi.fn((chunk: Uint8Array, p2: number) => ({
      name: "test",
      args: { chunk, p2 },
      getApdu: vi.fn(),
      parseResponse: vi.fn(),
    }));

    // 600 bytes payload → 602 with frame prefix → 3 chunks (255 + 255 + 92).
    const payload = makePayload(600, 0x55);
    const result = await sendFramedContactsPayload(api, {
      payload,
      p1: 0x03,
      makeCommand,
    });

    expect(makeCommand).toHaveBeenCalledTimes(3);
    const [chunk0, p20] = makeCommand.mock.calls[0]!;
    const [chunk1, p21] = makeCommand.mock.calls[1]!;
    const [chunk2, p22] = makeCommand.mock.calls[2]!;
    expect(p20).toBe(0x00);
    expect(p21).toBe(0x80);
    expect(p22).toBe(0x80);
    expect(chunk0.length).toBe(255);
    expect(chunk1.length).toBe(255);
    expect(chunk2.length).toBe(92);
    // Frame prefix (600 = 0x0258) only on the first chunk.
    expect(chunk0[0]).toBe(0x02);
    expect(chunk0[1]).toBe(0x58);
    // Continuation chunks begin with raw payload bytes.
    expect(chunk1[0]).toBe(0x55);
    expect(result).toBe(finalResult);
  });

  it("short-circuits on intermediate-chunk error without dispatching remaining chunks", async () => {
    const api = makeDeviceActionInternalApiMock();
    const errorResult = CommandResultFactory({
      error: new InvalidStatusWordError("kaboom"),
    });
    api.sendCommand.mockResolvedValueOnce(errorResult);

    const makeCommand = vi.fn((chunk: Uint8Array, p2: number) => ({
      name: "test",
      args: { chunk, p2 },
      getApdu: vi.fn(),
      parseResponse: vi.fn(),
    }));

    const payload = makePayload(600);
    const result = await sendFramedContactsPayload(api, {
      payload,
      p1: 0x03,
      makeCommand,
    });

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(makeCommand).toHaveBeenCalledTimes(1);
    expect(result).toBe(errorResult);
  });
});

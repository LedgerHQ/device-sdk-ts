import {
  type Command,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { sendFramedContactsPayload } from "./sendFramedContactsPayload";

function makeApiMock(): InternalApi & {
  sendCommand: ReturnType<typeof vi.fn>;
} {
  return {
    sendCommand: vi.fn(),
  } as unknown as InternalApi & { sendCommand: ReturnType<typeof vi.fn> };
}

function makePayload(byteCount: number, fillByte = 0x42): Uint8Array {
  return new Uint8Array(byteCount).fill(fillByte);
}

const makeCommandFactory = () =>
  vi.fn(
    (chunk: Uint8Array, p2: number) =>
      ({
        name: "test",
        args: { chunk, p2 },
        getApdu: vi.fn(),
        parseResponse: vi.fn(),
      }) as unknown as Command<unknown, unknown, unknown>,
  );

describe("sendFramedContactsPayload", () => {
  it("single-chunk: prepends BE length, uses P2=0x00, returns command result", async () => {
    const api = makeApiMock();
    const finalResult = CommandResultFactory({ data: { ok: true } });
    api.sendCommand.mockResolvedValueOnce(finalResult);
    const makeCommand = makeCommandFactory();

    const result = await sendFramedContactsPayload(api, {
      payload: makePayload(100),
      p1: 0x01,
      makeCommand,
    });

    expect(makeCommand).toHaveBeenCalledTimes(1);
    const [chunk, p2] = makeCommand.mock.calls[0]!;
    expect(p2).toBe(0x00);
    // 2-byte BE length prefix = 100 → 0x00, 0x64.
    expect(chunk[0]).toBe(0x00);
    expect(chunk[1]).toBe(0x64);
    expect(chunk.length).toBe(102);
    expect(result).toBe(finalResult);
  });

  it("multi-chunk: splits into <=255B pieces, P2 0x00 then 0x80, prefix on first only", async () => {
    const api = makeApiMock();
    const intermediateOk = CommandResultFactory({ data: {} });
    const finalResult = CommandResultFactory({ data: { ok: true } });
    api.sendCommand
      .mockResolvedValueOnce(intermediateOk)
      .mockResolvedValueOnce(intermediateOk)
      .mockResolvedValueOnce(finalResult);
    const makeCommand = makeCommandFactory();

    // 600 bytes payload → 602 with frame prefix → 3 chunks (255 + 255 + 92).
    const result = await sendFramedContactsPayload(api, {
      payload: makePayload(600, 0x55),
      p1: 0x01,
      makeCommand,
    });

    expect(makeCommand).toHaveBeenCalledTimes(3);
    const [chunk0, p20] = makeCommand.mock.calls[0]!;
    const [chunk1, p21] = makeCommand.mock.calls[1]!;
    const [chunk2, p22] = makeCommand.mock.calls[2]!;
    expect([p20, p21, p22]).toEqual([0x00, 0x80, 0x80]);
    expect([chunk0.length, chunk1.length, chunk2.length]).toEqual([
      255, 255, 92,
    ]);
    // Frame prefix (600 = 0x0258) only on the first chunk.
    expect(chunk0[0]).toBe(0x02);
    expect(chunk0[1]).toBe(0x58);
    // Continuation chunks begin with raw payload bytes.
    expect(chunk1[0]).toBe(0x55);
    expect(result).toBe(finalResult);
  });

  it("short-circuits on intermediate-chunk error without dispatching remaining chunks", async () => {
    const api = makeApiMock();
    const errorResult: CommandResult<unknown> = CommandResultFactory({
      error: new InvalidStatusWordError("kaboom"),
    });
    api.sendCommand.mockResolvedValueOnce(errorResult);
    const makeCommand = makeCommandFactory();

    const result = await sendFramedContactsPayload(api, {
      payload: makePayload(600),
      p1: 0x01,
      makeCommand,
    });

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(makeCommand).toHaveBeenCalledTimes(1);
    expect(result).toBe(errorResult);
  });
});

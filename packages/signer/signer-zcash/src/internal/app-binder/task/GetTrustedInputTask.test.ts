import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { GetTrustedInputTask } from "./GetTrustedInputTask";

describe("GetTrustedInputTask", () => {
  const TRANSPARENT_V5_TX = Uint8Array.from(
    Buffer.from(
      "050000800a27a726b4d0d6c200000000a8841e00021111111111111111111111111111111111111111111111111111111111111111000000006b483045022100e35dd2be5e5aeccce0ff7ff892db278047685bc11d34692fd72a9c1914d05f8e0220426dd0a98b39eb6051df9706e4ff9fba4a8be5cd6ef5c3fdd6f2200c709b2bad01210228d06186c26df6afa96076b0ac64cf0d8caf212937f328a52894183cc36e5dd8ffffffff2222222222222222222222222222222222222222222222222222222222222222010000006b483045022100abb1831a7c59bd893420bfe51df0627f239ac2c1524de86958fe84f122c5344d022046ef451e009e500c12516f082a03ffafd3743f522790b866af88ef202fc83a1d0121037e0c5efb047f692c0c89ea9a817f577dc086303aed2f662df4879c89448287c7ffffffff01a0860100000000001976a914b1630abe4ac3749ca5b0ea4c30a7eae5abab19be88ac000000",
      "hex",
    ),
  );

  const apiMock = {
    sendCommand: vi.fn(),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends parser-aligned trusted input chunks", async () => {
    const response = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x01]),
    });
    apiMock.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: response }),
    );

    const task = new GetTrustedInputTask(apiMock as unknown as InternalApi, {
      transaction: TRANSPARENT_V5_TX,
      indexLookup: 1,
    });

    await task.run();

    const rawApdus = apiMock.sendCommand.mock.calls.map(([command]) =>
      command.getApdu().getRawApdu(),
    );
    const expectedLcByChunk = [
      0x11, 0x25, 0x6f, 0x25, 0x6f, 0x01, 0x09, 0x19, 0x03, 0x09,
    ];

    expect(rawApdus).toHaveLength(expectedLcByChunk.length);

    rawApdus.forEach((rawApdu, index) => {
      expect(rawApdu[2]).toBe(index === 0 ? 0x00 : 0x80);
      expect(rawApdu[4]).toBe(expectedLcByChunk[index]);
    });

    const firstRawApdu = rawApdus[0];
    if (!firstRawApdu) {
      throw new Error("Expected first APDU to be defined");
    }

    const firstData = Buffer.from(firstRawApdu.slice(5)).toString("hex");
    expect(firstRawApdu[2]).toBe(0x00);
    expect(firstData.slice(0, 8)).toBe("00000001");
    expect(firstData.slice(8)).toBe("050000800a27a726b4d0d6c202");
  });

  it("returns last command response after sending all chunks", async () => {
    const firstResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x01]),
    });
    const finalResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x02]),
    });
    for (let i = 0; i < 9; i += 1) {
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({ data: firstResponse }),
      );
    }
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: finalResponse }),
    );

    const task = new GetTrustedInputTask(apiMock as unknown as InternalApi, {
      transaction: TRANSPARENT_V5_TX,
      indexLookup: 0,
    });

    const result = await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(10);
    expect(result).toEqual(CommandResultFactory({ data: finalResponse }));
  });

  it("returns continuation command errors", async () => {
    const firstResponse = new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: new Uint8Array([0x01]),
    });
    const error = new UnknownDeviceExchangeError("send command failed");
    apiMock.sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: firstResponse }))
      .mockResolvedValueOnce(CommandResultFactory({ error }));

    const task = new GetTrustedInputTask(apiMock as unknown as InternalApi, {
      transaction: TRANSPARENT_V5_TX,
      indexLookup: 2,
    });

    const result = await task.run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toEqual(CommandResultFactory({ error }));
  });
});

import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  type ChunkableCommandArgs,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

type DummyResponse = { value: string };
type DummyErrorCodes = "4224";

class DummyCommand {
  readonly name = "dummy";
  constructor(readonly args: ChunkableCommandArgs) {}
  getApdu() {
    throw new Error("not used in tests");
  }
  parseResponse() {
    throw new Error("not used in tests");
  }
}

const makeApiMock = () =>
  ({
    sendCommand: vi.fn(),
  }) as unknown as InternalApi & {
    sendCommand: ReturnType<typeof vi.fn>;
  };

describe("SendCommandInChunksTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends a payload smaller than APDU_MAX_PAYLOAD in a single chunk with more=false, extend=false", async () => {
    const api = makeApiMock();
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory<DummyResponse, DummyErrorCodes>({
        data: { value: "ok" },
      }),
    );

    const result = await new SendCommandInChunksTask<
      DummyResponse,
      DummyErrorCodes
    >(api, {
      data: payload,
      commandFactory: (args) => new DummyCommand(args) as never,
    }).run();

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    const sent = api.sendCommand.mock.calls[0]?.[0] as DummyCommand;
    expect(sent.args).toEqual({
      chunkedData: payload,
      more: false,
      extend: false,
    });
    expect(isSuccessCommandResult(result)).toBe(true);
  });

  it("splits a payload larger than APDU_MAX_PAYLOAD into ordered chunks with proper flags", async () => {
    const api = makeApiMock();
    const totalLength = APDU_MAX_PAYLOAD * 2 + 10;
    const payload = new Uint8Array(totalLength).map((_, i) => i & 0xff);

    api.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory<DummyResponse, DummyErrorCodes>({
          data: { value: "chunk1" },
        }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory<DummyResponse, DummyErrorCodes>({
          data: { value: "chunk2" },
        }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory<DummyResponse, DummyErrorCodes>({
          data: { value: "final" },
        }),
      );

    const result = await new SendCommandInChunksTask<
      DummyResponse,
      DummyErrorCodes
    >(api, {
      data: payload,
      commandFactory: (args) => new DummyCommand(args) as never,
    }).run();

    expect(api.sendCommand).toHaveBeenCalledTimes(3);

    const call1 = api.sendCommand.mock.calls[0]?.[0] as DummyCommand;
    expect(call1.args.chunkedData).toEqual(payload.slice(0, APDU_MAX_PAYLOAD));
    expect(call1.args.more).toBe(true);
    expect(call1.args.extend).toBe(false);

    const call2 = api.sendCommand.mock.calls[1]?.[0] as DummyCommand;
    expect(call2.args.chunkedData).toEqual(
      payload.slice(APDU_MAX_PAYLOAD, APDU_MAX_PAYLOAD * 2),
    );
    expect(call2.args.more).toBe(true);
    expect(call2.args.extend).toBe(true);

    const call3 = api.sendCommand.mock.calls[2]?.[0] as DummyCommand;
    expect(call3.args.chunkedData).toEqual(payload.slice(APDU_MAX_PAYLOAD * 2));
    expect(call3.args.more).toBe(false);
    expect(call3.args.extend).toBe(true);

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toEqual({ value: "final" });
    }
  });

  it("stops sending and returns the error result when a chunk fails", async () => {
    const api = makeApiMock();
    const payload = new Uint8Array(APDU_MAX_PAYLOAD * 3);
    const error = new InvalidStatusWordError("chunk failed");

    api.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory<DummyResponse, DummyErrorCodes>({
          data: { value: "chunk1" },
        }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory<DummyResponse, DummyErrorCodes>({ error }),
      );

    const result = await new SendCommandInChunksTask<
      DummyResponse,
      DummyErrorCodes
    >(api, {
      data: payload,
      commandFactory: (args) => new DummyCommand(args) as never,
    }).run();

    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ error });
  });
});

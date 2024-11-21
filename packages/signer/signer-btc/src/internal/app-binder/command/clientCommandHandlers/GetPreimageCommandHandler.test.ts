import { Just, Nothing } from "purify-ts/Maybe";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlerTypes";
import { GetPreimageCommandHandler } from "./GetPreimageCommandHandler";

const CMD_CODE = ClientCommandCodes.GET_PREIMAGE;

jest.mock("@internal/utils/Varint", () => ({
  encodeVarint: jest.fn(),
}));

describe("GetPreimageCommandHandler", () => {
  let handler: GetPreimageCommandHandler;
  let context: CommandHandlerContext;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStore = {
      getPreimage: jest.fn(),
    } as unknown as jest.Mocked<DataStore>;

    context = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };

    handler = new GetPreimageCommandHandler();
  });

  it("should return the preimage when it is found and its length is within the max payload size", () => {
    // given
    const hash = new Uint8Array(32).fill(0x01);
    const preimage = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const preimageLength = preimage.length;

    (encodeVarint as jest.Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0x03]), // varint for 3
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([CMD_CODE, 0x00, ...hash]);

    // when
    const result = handler.execute(request, context);

    // then
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(hash);
    expect(encodeVarint).toHaveBeenCalledWith(preimageLength);

    const expectedResponse = new Uint8Array([0x03, 0x03, 0xaa, 0xbb, 0xcc]);
    expect(result).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should handle preimage longer than max payload size by queuing the remaining bytes", () => {
    // given
    const hash = new Uint8Array(32).fill(0x02);
    const preimage = new Uint8Array(300).fill(0xff);
    const preimageLength = preimage.length;

    (encodeVarint as jest.Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0xac, 0x02]),
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([CMD_CODE, 0x00, ...hash]);

    // when
    const result = handler.execute(request, context);

    // prepare expected response
    const varint = new Uint8Array([0xac, 0x02]); // varint for 300
    const b = Math.min(255 - varint.length - 1, preimage.length);
    const expectedResponse = new Uint8Array(varint.length + 1 + b);
    expectedResponse.set(varint, 0); // varint
    expectedResponse.set([b], varint.length); // b
    expectedResponse.set(preimage.slice(0, b), varint.length + 1);

    const expectedQueue = [];
    for (let i = b; i < preimage.length; i++) {
      expectedQueue.push(preimage.slice(i, i + 1));
    }

    // then
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(hash);
    expect(encodeVarint).toHaveBeenCalledWith(preimageLength);
    expect(result).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(preimage.length - b);
    expect(context.queue[0]).toEqual(new Uint8Array([0xff]));
    expect(context.queue[context.queue.length - 1]).toEqual(
      new Uint8Array([0xff]),
    );
  });

  it("should throw an error when preimage is not found", () => {
    // given
    const hash = new Uint8Array(32).fill(0x03);

    mockDataStore.getPreimage.mockReturnValue(Nothing);

    const request = new Uint8Array([CMD_CODE, 0x00, ...hash]);

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Preimage not found in dataStore",
    );
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(hash);
    expect(encodeVarint).not.toHaveBeenCalled();
    expect(context.queue).toHaveLength(0);
  });

  it("should not modify the original request array", () => {
    // given
    const hash = new Uint8Array(32).fill(0x04);
    const preimage = new Uint8Array([0x11, 0x22, 0x33]);

    (encodeVarint as jest.Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0x03]),
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([CMD_CODE, 0x00, ...hash]);
    const originalRequest = Uint8Array.from(request);

    // when
    handler.execute(request, context);

    // then
    expect(request).toEqual(originalRequest);
  });

  it("should handle preimage length that results in maxPayloadSize exactly matching the preimage length", () => {
    // given
    const hash = new Uint8Array(32).fill(0x05);
    const preimage = new Uint8Array(252);
    preimage.fill(0x77);

    (encodeVarint as jest.Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0xfc]),
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([CMD_CODE, 0x00, ...hash]);

    // when
    const result = handler.execute(request, context);

    const varint = new Uint8Array([0xfc]);
    const b = Math.min(255 - varint.length - 1, preimage.length);
    const expectedResponse = new Uint8Array(varint.length + 1 + b);
    expectedResponse.set(varint, 0);
    expectedResponse.set([b], varint.length);
    expectedResponse.set(preimage, varint.length + 1);

    // then
    expect(result).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });
});

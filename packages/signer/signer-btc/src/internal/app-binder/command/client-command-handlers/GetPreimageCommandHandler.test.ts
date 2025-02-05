import { type DmkError } from "@ledgerhq/device-management-kit";
import { Either, Just, Nothing } from "purify-ts";
import { type Mock, type Mocked } from "vitest";

import {
  ClientCommandCodes,
  SHA256_SIZE,
} from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";
import { GetPreimageCommandHandler } from "./GetPreimageCommandHandler";

const COMMAND_CODE = ClientCommandCodes.GET_PREIMAGE;

vi.mock("@internal/utils/Varint", () => ({
  encodeVarint: vi.fn(),
}));

describe("GetPreimageCommandHandler", () => {
  let commandHandlerContext: CommandHandlerContext;
  let mockDataStore: Mocked<DataStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataStore = {
      getPreimage: vi.fn(),
    } as unknown as Mocked<DataStore>;

    commandHandlerContext = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  it("should return the preimage when it is found and its length is within the maximum payload size", () => {
    // given
    const requestHash = new Uint8Array(SHA256_SIZE).fill(0x01);
    const preimage = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const preimageLength = preimage.length;

    // when
    (encodeVarint as Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0x03]), // varint for 3
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([COMMAND_CODE, 0x00, ...requestHash]);

    const handlerResult = GetPreimageCommandHandler(
      request,
      commandHandlerContext,
    );

    const expectedResponse = new Uint8Array([0x03, 0x03, 0xaa, 0xbb, 0xcc]);

    // then
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(requestHash);
    expect(encodeVarint).toHaveBeenCalledWith(preimageLength);
    handlerResult.caseOf({
      Left: (_) => {
        throw new Error("Expected Right, got Left");
      },
      Right: (response) => {
        expect(response).toEqual(expectedResponse);
        expect(commandHandlerContext.queue).toHaveLength(0);
      },
    });
  });

  it("should handle a preimage longer than the maximum payload size by queuing the remaining bytes", () => {
    // given
    const requestHash = new Uint8Array(SHA256_SIZE).fill(0x02);
    const preimage = new Uint8Array(300).fill(0xff);
    const preimageLength = preimage.length;

    // when
    (encodeVarint as Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0xac, 0x02]),
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([COMMAND_CODE, 0x00, ...requestHash]);

    const handlerResult = GetPreimageCommandHandler(
      request,
      commandHandlerContext,
    );

    const varintEncodedLength = new Uint8Array([0xac, 0x02]); // varint for 300
    const maximumBytesInResponse = Math.min(
      255 - varintEncodedLength.length - 1,
      preimage.length,
    );
    const expectedResponse = new Uint8Array(
      varintEncodedLength.length + 1 + maximumBytesInResponse,
    );
    expectedResponse.set(varintEncodedLength, 0); // varint
    expectedResponse.set([maximumBytesInResponse], varintEncodedLength.length); // bytes in response
    expectedResponse.set(
      preimage.slice(0, maximumBytesInResponse),
      varintEncodedLength.length + 1,
    );

    // then
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(requestHash);
    expect(encodeVarint).toHaveBeenCalledWith(preimageLength);
    handlerResult.caseOf({
      Left: (_) => {
        throw new Error("Expected Right, got Left");
      },
      Right: (response) => {
        expect(response).toEqual(expectedResponse);
        expect(commandHandlerContext.queue).toHaveLength(
          preimage.length - maximumBytesInResponse,
        );
        expect(commandHandlerContext.queue[0]).toEqual(new Uint8Array([0xff]));
        expect(
          commandHandlerContext.queue[commandHandlerContext.queue.length - 1],
        ).toEqual(new Uint8Array([0xff]));
      },
    });
  });

  it("should return an error when the preimage is not found", () => {
    // given
    const requestHash = new Uint8Array(SHA256_SIZE).fill(0x03);

    // when
    mockDataStore.getPreimage.mockReturnValue(Nothing);

    const request = new Uint8Array([COMMAND_CODE, 0x00, ...requestHash]);

    const handlerResult = GetPreimageCommandHandler(
      request,
      commandHandlerContext,
    );

    // then
    expect(mockDataStore.getPreimage).toHaveBeenCalledWith(requestHash);
    expect(encodeVarint).not.toHaveBeenCalled();
    expect(commandHandlerContext.queue).toHaveLength(0);
    handlerResult.caseOf({
      Left: (error: DmkError) => {
        expect(error).toBeInstanceOf(ClientCommandHandlerError);
      },
      Right: (_) => {
        throw new Error("Expected Left, got Right");
      },
    });
  });

  it("should handle a preimage length where the maximum payload size exactly matches the preimage length", () => {
    // given
    const requestHash = new Uint8Array(SHA256_SIZE).fill(0x05);
    const preimage = new Uint8Array(252);
    preimage.fill(0x77);

    // when
    (encodeVarint as Mock).mockReturnValue({
      unsafeCoerce: () => new Uint8Array([0xfc]),
    });

    mockDataStore.getPreimage.mockReturnValue(Just(preimage));

    const request = new Uint8Array([COMMAND_CODE, 0x00, ...requestHash]);

    const handlerResult = GetPreimageCommandHandler(
      request,
      commandHandlerContext,
    );

    const varintEncodedLength = new Uint8Array([0xfc]);
    const maximumBytesInResponse = Math.min(
      255 - varintEncodedLength.length - 1,
      preimage.length,
    );
    const expectedResponse = new Uint8Array(
      varintEncodedLength.length + 1 + maximumBytesInResponse,
    );
    expectedResponse.set(varintEncodedLength, 0);
    expectedResponse.set([maximumBytesInResponse], varintEncodedLength.length);
    expectedResponse.set(preimage, varintEncodedLength.length + 1);

    // then
    expect(handlerResult).toStrictEqual(Either.of(expectedResponse));
    expect(commandHandlerContext.queue).toHaveLength(0);
  });
});

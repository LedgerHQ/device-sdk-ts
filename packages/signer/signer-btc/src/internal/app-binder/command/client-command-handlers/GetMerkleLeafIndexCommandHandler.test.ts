import { Just, Nothing } from "purify-ts";

import {
  ClientCommandCodes,
  SHA256_SIZE,
} from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlersTypes";
import { GetMerkleLeafIndexCommandHandler } from "./GetMerkleLeafIndexCommandHandler";

const COMMAND_CODE = ClientCommandCodes.GET_MERKLE_LEAF_INDEX;

describe("GetMerkleLeafIndexCommandHandler", () => {
  let commandHandlerContext: CommandHandlerContext;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStore = {
      getMerkleLeafIndex: jest.fn(),
    } as unknown as jest.Mocked<DataStore>;

    commandHandlerContext = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  const createRequest = (
    commandCode: number,
    merkleRootHash: Uint8Array,
    leafNodeHash: Uint8Array,
  ): Uint8Array =>
    new Uint8Array([commandCode, ...merkleRootHash, ...leafNodeHash]);

  it("should return the index when the Merkle leaf is found", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0xaa);
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xff);
    const handlerRequest = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      leafNodeHash,
    );
    const leafIndex = 123456;
    const encodedLeafIndexVarint = encodeVarint(leafIndex).unsafeCoerce();

    // when
    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(leafIndex));

    const handlerResponse = GetMerkleLeafIndexCommandHandler(
      handlerRequest,
      commandHandlerContext,
    );

    const expectedResponseBuffer = new Uint8Array(
      1 + encodedLeafIndexVarint.length,
    );
    expectedResponseBuffer[0] = 1; // index found
    expectedResponseBuffer.set(encodedLeafIndexVarint, 1);

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      merkleRootHash,
      leafNodeHash,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(expectedResponseBuffer);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should return a failure response when the Merkle leaf is not found", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0xaa);
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xff);
    const handlerRequest = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      leafNodeHash,
    );

    // when
    mockDataStore.getMerkleLeafIndex.mockReturnValue(Nothing);

    const handlerResponse = GetMerkleLeafIndexCommandHandler(
      handlerRequest,
      commandHandlerContext,
    );

    const expectedFailureResponseBuffer = Uint8Array.from([0]);

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      merkleRootHash,
      leafNodeHash,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(
      expectedFailureResponseBuffer,
    );
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should correctly handle a leaf index of zero", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0xaa);
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xff);
    const handlerRequest = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      leafNodeHash,
    );
    const leafIndex = 0;
    const encodedLeafIndexVarint = encodeVarint(leafIndex).unsafeCoerce();

    // when
    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(leafIndex));

    const handlerResponse = GetMerkleLeafIndexCommandHandler(
      handlerRequest,
      commandHandlerContext,
    );

    const expectedResponseBuffer = new Uint8Array(
      1 + encodedLeafIndexVarint.length,
    );
    expectedResponseBuffer[0] = 1; // index found
    expectedResponseBuffer.set(encodedLeafIndexVarint, 1);

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      merkleRootHash,
      leafNodeHash,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(expectedResponseBuffer);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should correctly handle the maximum SHA256_SIZE-bit unsigned integer as a leaf index", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0xaa);
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xff);
    const handlerRequest = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      leafNodeHash,
    );
    const maximumLeafIndex = 0xffffffff; // maximum value of a SHA256_SIZE-bit unsigned integer
    const encodedLeafIndexVarint =
      encodeVarint(maximumLeafIndex).unsafeCoerce();

    // when
    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(maximumLeafIndex));

    const handlerResponse = GetMerkleLeafIndexCommandHandler(
      handlerRequest,
      commandHandlerContext,
    );

    const expectedResponseBuffer = new Uint8Array(
      1 + encodedLeafIndexVarint.length,
    );
    expectedResponseBuffer[0] = 1; // index found
    expectedResponseBuffer.set(encodedLeafIndexVarint, 1);

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      merkleRootHash,
      leafNodeHash,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(expectedResponseBuffer);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });
});

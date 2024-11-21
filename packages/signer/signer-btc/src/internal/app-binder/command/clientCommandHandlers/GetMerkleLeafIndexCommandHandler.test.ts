import { Just, Nothing } from "purify-ts/Maybe";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlerTypes";
import { GetMerkleLeafIndexCommandHandler } from "./GetMerkleLeafIndexCommandHandler";

const CMD_CODE = ClientCommandCodes.GET_MERKLE_LEAF_INDEX;

describe("GetMerkleLeafIndexCommandHandler", () => {
  let handler: GetMerkleLeafIndexCommandHandler;
  let context: CommandHandlerContext;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStore = {
      getMerkleLeafIndex: jest.fn(),
    } as unknown as jest.Mocked<DataStore>;

    context = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };

    handler = new GetMerkleLeafIndexCommandHandler();
  });

  const buildRequest = (
    commandCode: number,
    rootHash: Uint8Array,
    leafHash: Uint8Array,
  ): Uint8Array => new Uint8Array([commandCode, ...rootHash, ...leafHash]);

  it("should return the index when Merkle leaf is found", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0xaa);
    const leafHash = new Uint8Array(32).fill(0xff);
    const request = buildRequest(CMD_CODE, rootHash, leafHash);

    const index = 123456;
    const encodedIndex = encodeVarint(index);

    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(index));

    // when
    const response = handler.execute(request, context);

    const expectedResponse = encodedIndex
      .map((indexArray) => {
        const res = new Uint8Array(1 + indexArray.length);
        res[0] = 1; // index was found
        res.set(indexArray, 1);
        return res;
      })
      .orDefault(new Uint8Array([0]));

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      rootHash,
      leafHash,
    );
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should return failure when Merkle leaf is not found", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0xaa);
    const leafHash = new Uint8Array(32).fill(0xff);
    const request = buildRequest(CMD_CODE, rootHash, leafHash);

    mockDataStore.getMerkleLeafIndex.mockReturnValue(Nothing);

    // when
    const response = handler.execute(request, context);

    const expectedResponse = new Uint8Array([0]);

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      rootHash,
      leafHash,
    );
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error for invalid request length (too short)", () => {
    // given
    const invalidRequest = new Uint8Array([CMD_CODE, ...new Uint8Array(32)]); // Only rootHash provided, missing leafHash

    // then
    expect(() => handler.execute(invalidRequest, context)).toThrowError(
      "Invalid GET_MERKLE_LEAF_INDEX request length",
    );
    expect(mockDataStore.getMerkleLeafIndex).not.toHaveBeenCalled();
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error for invalid request length (too long)", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0xaa);
    const leafHash = new Uint8Array(32).fill(0xff);
    const extraBytes = new Uint8Array(1).fill(0xaa);
    const invalidRequest = new Uint8Array([
      CMD_CODE,
      ...rootHash,
      ...leafHash,
      ...extraBytes,
    ]);

    // then
    expect(() => handler.execute(invalidRequest, context)).toThrowError(
      "Invalid GET_MERKLE_LEAF_INDEX request length",
    );
    expect(mockDataStore.getMerkleLeafIndex).not.toHaveBeenCalled();
    expect(context.queue).toHaveLength(0);
  });

  it("should correctly handle index zero", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0xaa);
    const leafHash = new Uint8Array(32).fill(0xff);
    const request = buildRequest(CMD_CODE, rootHash, leafHash);

    const index = 0; // edge case: index zero
    const encodedIndex = encodeVarint(index); // should handle zero correctly

    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(index));

    // when
    const response = handler.execute(request, context);

    const expectedResponse = encodedIndex
      .map((indexArray) => {
        const res = new Uint8Array(1 + indexArray.length);
        res[0] = 1; // index was found
        res.set(indexArray, 1);
        return res;
      })
      .orDefault(new Uint8Array([0]));

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      rootHash,
      leafHash,
    );
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should correctly handle maximum varint value", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0xaa);
    const leafHash = new Uint8Array(32).fill(0xff);
    const request = buildRequest(CMD_CODE, rootHash, leafHash);

    const index = 0xffffffff; // max 32-bit unsigned int
    const encodedIndex = encodeVarint(index);

    mockDataStore.getMerkleLeafIndex.mockReturnValue(Just(index));

    // when
    const response = handler.execute(request, context);

    const expectedResponse = encodedIndex
      .map((indexArray) => {
        const res = new Uint8Array(1 + indexArray.length);
        res[0] = 1; // index was found
        res.set(indexArray, 1);
        return res;
      })
      .orDefault(new Uint8Array([0]));

    // then
    expect(mockDataStore.getMerkleLeafIndex).toHaveBeenCalledWith(
      rootHash,
      leafHash,
    );
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });
});

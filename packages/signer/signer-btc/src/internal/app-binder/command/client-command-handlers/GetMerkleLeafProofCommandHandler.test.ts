import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import {
  ClientCommandCodes,
  SHA256_SIZE,
} from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";
import { GetMerkleLeafProofCommandHandler } from "./GetMerkleLeafProofCommandHandler";

const COMMAND_CODE = ClientCommandCodes.GET_MERKLE_LEAF_PROOF;

describe("GetMerkleLeafProofCommandHandler", () => {
  let commandHandlerContext: CommandHandlerContext;
  let mockDataStore: vi.Mocked<DataStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDataStore = {
      getMerkleProof: vi.fn(),
    } as unknown as vi.Mocked<DataStore>;

    commandHandlerContext = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };
  });

  const createRequest = (
    commandCode: number,
    merkleRootHash: Uint8Array,
    totalElements: number,
    proofElementIndex: number,
  ): Uint8Array =>
    new Uint8Array([
      commandCode,
      ...merkleRootHash,
      ...encodeVarint(totalElements).unsafeCoerce(),
      ...encodeVarint(proofElementIndex).unsafeCoerce(),
    ]);

  it("should return the Merkle leaf and proof when found and proof length is less than or equal to the maximum allowed", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0x01);
    const totalElements = 1;
    const proofElementIndex = 2;
    const request = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      totalElements,
      proofElementIndex,
    );
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xaa);
    const proofElements = [
      new Uint8Array(SHA256_SIZE).fill(0xbb),
      new Uint8Array(SHA256_SIZE).fill(0xcc),
    ];

    // when
    mockDataStore.getMerkleProof.mockReturnValue(
      Just({ leafHash: leafNodeHash, proof: proofElements }),
    );

    const handlerResponse = GetMerkleLeafProofCommandHandler(
      request,
      commandHandlerContext,
    );

    const maximumPayloadSize = APDU_MAX_PAYLOAD - SHA256_SIZE - 1 - 1;
    const maximumProofElements = Math.floor(maximumPayloadSize / SHA256_SIZE);
    const proofElementsToInclude = Math.min(
      proofElements.length,
      maximumProofElements,
    );

    const expectedResponse = new Uint8Array(
      SHA256_SIZE + 1 + 1 + SHA256_SIZE * proofElementsToInclude,
    );
    let responseBufferOffset = 0;
    expectedResponse.set(leafNodeHash, responseBufferOffset); // leafHash
    responseBufferOffset += SHA256_SIZE;
    expectedResponse[responseBufferOffset++] = proofElements.length; // total proof length
    expectedResponse[responseBufferOffset++] = proofElementsToInclude;
    for (
      let proofElementIndex = 0;
      proofElementIndex < proofElementsToInclude;
      proofElementIndex++
    ) {
      expectedResponse.set(
        proofElements[proofElementIndex] as Uint8Array,
        responseBufferOffset,
      );
      responseBufferOffset += SHA256_SIZE;
    }

    // then
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(
      merkleRootHash,
      proofElementIndex,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(0);
  });

  it("should handle proof longer than the maximum allowed by queuing the remaining proof elements", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0x02);
    const totalElements = 1;
    const proofElementIndex = 3;
    const request = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      totalElements,
      proofElementIndex,
    );
    const leafNodeHash = new Uint8Array(SHA256_SIZE).fill(0xdd);
    const totalProofLength = 10;
    const proofElements = Array.from(
      { length: totalProofLength },
      (_, proofIndex) => new Uint8Array(SHA256_SIZE).fill(0xee + proofIndex),
    );

    // when
    mockDataStore.getMerkleProof.mockReturnValue(
      Just({ leafHash: leafNodeHash, proof: proofElements }),
    );

    const handlerResponse = GetMerkleLeafProofCommandHandler(
      request,
      commandHandlerContext,
    );

    const maximumPayloadSize = APDU_MAX_PAYLOAD - SHA256_SIZE - 1 - 1;
    const maximumProofElements = Math.floor(maximumPayloadSize / SHA256_SIZE);
    const proofElementsToInclude = Math.min(
      proofElements.length,
      maximumProofElements,
    );

    const expectedResponse = new Uint8Array(
      SHA256_SIZE + 1 + 1 + SHA256_SIZE * proofElementsToInclude,
    );
    let responseBufferOffset = 0;
    expectedResponse.set(leafNodeHash, responseBufferOffset); // leafHash
    responseBufferOffset += SHA256_SIZE;
    expectedResponse[responseBufferOffset++] = proofElements.length; // total proof length
    expectedResponse[responseBufferOffset++] = proofElementsToInclude;
    for (
      let proofElementIndex = 0;
      proofElementIndex < proofElementsToInclude;
      proofElementIndex++
    ) {
      expectedResponse.set(
        proofElements[proofElementIndex] as Uint8Array,
        responseBufferOffset,
      );
      responseBufferOffset += SHA256_SIZE;
    }

    // then
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(
      merkleRootHash,
      proofElementIndex,
    );
    expect(handlerResponse.isRight()).toBe(true);
    expect(handlerResponse.unsafeCoerce()).toEqual(expectedResponse);
    expect(commandHandlerContext.queue).toHaveLength(
      proofElements.length - proofElementsToInclude,
    );
    for (
      let queuedProofIndex = 0;
      queuedProofIndex < commandHandlerContext.queue.length;
      queuedProofIndex++
    ) {
      expect(commandHandlerContext.queue[queuedProofIndex]).toEqual(
        proofElements[proofElementsToInclude + queuedProofIndex],
      );
    }
  });

  it("should return an error when the Merkle proof is not found in the data store", () => {
    // given
    const merkleRootHash = new Uint8Array(SHA256_SIZE).fill(0x04);
    const totalElements = 1;
    const proofElementIndex = 5;
    const request = createRequest(
      COMMAND_CODE,
      merkleRootHash,
      totalElements,
      proofElementIndex,
    );

    // when
    mockDataStore.getMerkleProof.mockReturnValue(Nothing);

    const handlerResponse = GetMerkleLeafProofCommandHandler(
      request,
      commandHandlerContext,
    );

    // then
    expect(handlerResponse.isLeft()).toBe(true);
    //@ts-ignore
    const errorResponse = handlerResponse.leftOrDefault(undefined);
    expect(errorResponse).toBeDefined();
    expect(errorResponse instanceof ClientCommandHandlerError).toBe(true);
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(
      merkleRootHash,
      proofElementIndex,
    );
    expect(commandHandlerContext.queue).toHaveLength(0);
  });
});

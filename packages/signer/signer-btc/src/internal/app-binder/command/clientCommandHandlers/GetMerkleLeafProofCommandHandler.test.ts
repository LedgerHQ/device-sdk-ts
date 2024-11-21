import { Just, Nothing } from "purify-ts/Maybe";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { type CommandHandlerContext } from "./ClientCommandHandlerTypes";
import { GetMerkleLeafProofCommandHandler } from "./GetMerkleLeafProofCommandHandler";

const CMD_CODE = ClientCommandCodes.GET_MERKLE_LEAF_PROOF;

describe("GetMerkleLeafProofCommandHandler", () => {
  let handler: GetMerkleLeafProofCommandHandler;
  let context: CommandHandlerContext;
  let mockDataStore: jest.Mocked<DataStore>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataStore = {
      getMerkleProof: jest.fn(),
    } as unknown as jest.Mocked<DataStore>;

    context = {
      dataStore: mockDataStore,
      queue: [],
      yieldedResults: [],
    };

    handler = new GetMerkleLeafProofCommandHandler();
  });

  const buildRequest = (
    commandCode: number,
    rootHash: Uint8Array,
    n: number,
    i: number,
  ): Uint8Array =>
    new Uint8Array([
      commandCode,
      ...rootHash,
      ...encodeVarint(n).unsafeCoerce(),
      ...encodeVarint(i).unsafeCoerce(),
    ]);

  it("should return the Merkle leaf and proof when found and proof length ≤ maxP", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0x01);
    const n = 1;
    const i = 2;

    const request = buildRequest(CMD_CODE, rootHash, n, i);

    const leafHash = new Uint8Array(32).fill(0xaa);
    const proof = [
      new Uint8Array(32).fill(0xbb),
      new Uint8Array(32).fill(0xcc),
    ];

    mockDataStore.getMerkleProof.mockReturnValue(Just({ leafHash, proof }));

    // when
    const response = handler.execute(request, context);

    // calc expected response
    const maxPayloadSize = 255 - 32 - 1 - 1;
    const maxP = Math.floor(maxPayloadSize / 32);
    const p = Math.min(proof.length, maxP);

    // prepare expected response
    const expectedResponse = new Uint8Array(32 + 1 + 1 + 32 * p);
    let offsetResp = 0;
    expectedResponse.set(leafHash, offsetResp); // leafHash
    offsetResp += 32;
    expectedResponse[offsetResp++] = proof.length; // proof.length
    expectedResponse[offsetResp++] = p; // p
    for (let j = 0; j < p; j++) {
      expectedResponse.set(proof[j] as Uint8Array, offsetResp);
      offsetResp += 32;
    }

    // then
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(rootHash, i);
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(0);
  });

  it("should handle proof longer than maxP by queuing remaining proof elements", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0x02);
    const n = 1;
    const i = 3;

    const request = buildRequest(CMD_CODE, rootHash, n, i);

    const leafHash = new Uint8Array(32).fill(0xdd);
    const proofLength = 10;
    const proof = Array.from({ length: proofLength }, (_, idx) =>
      new Uint8Array(32).fill(0xee + idx),
    );

    mockDataStore.getMerkleProof.mockReturnValue(Just({ leafHash, proof }));

    // when
    const response = handler.execute(request, context);

    // calc expected response
    const maxPayloadSize = 255 - 32 - 1 - 1;
    const maxP = Math.floor(maxPayloadSize / 32);
    const p = Math.min(proof.length, maxP);

    // prep expected response
    const expectedResponse = new Uint8Array(32 + 1 + 1 + 32 * p);
    let offsetResp = 0;
    expectedResponse.set(leafHash, offsetResp); // leafHash
    offsetResp += 32;
    expectedResponse[offsetResp++] = proof.length; // proof.length
    expectedResponse[offsetResp++] = p; // p
    for (let j = 0; j < p; j++) {
      expectedResponse.set(proof[j] as Uint8Array, offsetResp);
      offsetResp += 32;
    }

    // then
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(rootHash, i);
    expect(response).toEqual(expectedResponse);
    expect(context.queue).toHaveLength(proof.length - p);
    for (let j = 0; j < context.queue.length; j++) {
      expect(context.queue[j]).toEqual(proof[p + j]);
    }
  });

  it("should throw an error for invalid request length", () => {
    // given
    const rootHash = new Uint8Array(31).fill(0x03);
    const n = 1;
    const i = 4;

    const request = buildRequest(CMD_CODE, rootHash as Uint8Array, n, i); // force incorrect length

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Buffer underflow in decodeBitcoinVarint",
    );
    expect(mockDataStore.getMerkleProof).not.toHaveBeenCalled();
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error when Merkle proof is not found in dataStore", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0x04);
    const n = 1;
    const i = 5;

    const request = buildRequest(CMD_CODE, rootHash, n, i);

    mockDataStore.getMerkleProof.mockReturnValue(Nothing);

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Merkle proof not found in dataStore",
    );
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(rootHash, i);
    expect(context.queue).toHaveLength(0);
  });

  it("should throw an error if a proof element is undefined", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0x05);
    const n = 1;
    const i = 6;

    const request = buildRequest(CMD_CODE, rootHash, n, i);

    const leafHash = new Uint8Array(32).fill(0xff);
    const proof = [
      new Uint8Array(32).fill(0x11),
      undefined,
      new Uint8Array(32).fill(0x13),
    ] as unknown as Uint8Array[];

    mockDataStore.getMerkleProof.mockReturnValue(Just({ leafHash, proof }));

    // then
    expect(() => handler.execute(request, context)).toThrowError(
      "Proof element is undefined",
    );
    expect(mockDataStore.getMerkleProof).toHaveBeenCalledWith(rootHash, i);
    expect(context.queue).toHaveLength(0);
  });

  it("should not modify the original request array", () => {
    // given
    const rootHash = new Uint8Array(32).fill(0x06);
    const n = 1;
    const i = 7;

    const request = buildRequest(CMD_CODE, rootHash, n, i);
    const originalRequest = Uint8Array.from(request);

    const leafHash = new Uint8Array(32).fill(0x22);
    const proof = [
      new Uint8Array(32).fill(0x33),
      new Uint8Array(32).fill(0x44),
    ];

    mockDataStore.getMerkleProof.mockReturnValue(Just({ leafHash, proof }));

    // when
    handler.execute(request, context);

    // then
    expect(request).toEqual(originalRequest);
  });
});

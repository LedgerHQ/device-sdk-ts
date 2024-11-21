import { clientCommandsMap } from "@internal/app-binder/command/clientCommandHandlers/index";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { encodeVarint } from "@internal/utils/Varint";

import { ClientCommandInterpreter } from "./ClientCommandInterpreter";
import { ClientCommandCodes } from "./constants";

describe("ClientCommandInterpreter", () => {
  let interpreter: ClientCommandInterpreter;
  let mockDataStore: DataStore;

  beforeEach(() => {
    mockDataStore = {
      getPreimage: jest.fn(),
      getMerkleProof: jest.fn(),
    } as unknown as DataStore;

    interpreter = new ClientCommandInterpreter(
      mockDataStore,
      clientCommandsMap,
    );
  });

  describe("YIELD command", () => {
    it("should handle YIELD command and store data in yieldedResults", () => {
      const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const request = new Uint8Array([ClientCommandCodes.YIELD, ...data]);

      const response = interpreter.execute(request);

      expect(response).toEqual(new Uint8Array([]));
      expect(interpreter.getYieldedResults()).toEqual([data]);
    });

    it("should handle multiple YIELD commands and accumulate data", () => {
      const data1 = new Uint8Array([0x05, 0x06]);
      const data2 = new Uint8Array([0x07, 0x08, 0x09]);

      const request1 = new Uint8Array([ClientCommandCodes.YIELD, ...data1]);
      const request2 = new Uint8Array([ClientCommandCodes.YIELD, ...data2]);

      interpreter.execute(request1);
      interpreter.execute(request2);

      expect(interpreter.getYieldedResults()).toEqual([data1, data2]);
    });
  });

  describe("GET_PREIMAGE command", () => {
    it("should return the preimage when found in dataStore and use queue correctly", () => {
      const hash = new Uint8Array(32).fill(0xaa);
      // create a preimage longer than the maximum payload size to test the queue
      const preimage = new Uint8Array(300).fill(0xff);

      (mockDataStore.getPreimage as jest.Mock).mockReturnValue({
        isJust: () => true,
        extract: () => preimage,
      });

      const request = new Uint8Array(34);
      request[0] = ClientCommandCodes.GET_PREIMAGE;
      request[1] = 0x00;
      request.set(hash, 2);

      const response = interpreter.execute(request);

      const preimageLenVarint = encodeVarint(preimage.length).unsafeCoerce();

      // calc the maximum payload size
      const maxPayloadSize = 255 - preimageLenVarint.length - 1;
      const b = Math.min(maxPayloadSize, preimage.length);

      // build the expected response
      const expectedResponse = new Uint8Array(preimageLenVarint.length + 1 + b);
      let offset = 0;
      expectedResponse.set(preimageLenVarint, offset);
      offset += preimageLenVarint.length;
      expectedResponse[offset++] = b;
      expectedResponse.set(preimage.slice(0, b), offset);

      expect(response).toEqual(expectedResponse);

      // the remaining bytes should be in the queue
      const remainingBytes = [];
      for (let i = b; i < preimage.length; i++) {
        remainingBytes.push(preimage.slice(i, i + 1));
      }
      expect(interpreter.getQueue()).toEqual(remainingBytes);
    });

    it("should return the entire preimage in response when it fits", () => {
      const hash = new Uint8Array(32).fill(0xaa);
      // create a preimage shorter than the maximum payload size
      const preimage = new Uint8Array(50).fill(0xff);

      (mockDataStore.getPreimage as jest.Mock).mockReturnValue({
        isJust: () => true,
        extract: () => preimage,
      });

      const request = new Uint8Array(34);
      request[0] = ClientCommandCodes.GET_PREIMAGE;
      request[1] = 0x00;
      request.set(hash, 2);

      const response = interpreter.execute(request);

      const preimageLenVarint = encodeVarint(preimage.length).unsafeCoerce();
      const maxPayloadSize = 255 - preimageLenVarint.length - 1;
      const b = Math.min(maxPayloadSize, preimage.length);

      const expectedResponse = new Uint8Array(preimageLenVarint.length + 1 + b);
      let offset = 0;
      expectedResponse.set(preimageLenVarint, offset);
      offset += preimageLenVarint.length;
      expectedResponse[offset++] = b;
      expectedResponse.set(preimage.slice(0, b), offset);

      expect(response).toEqual(expectedResponse);
      expect(interpreter.getQueue()).toEqual([]);
    });

    it("should throw an error when preimage is not found in dataStore", () => {
      const hash = new Uint8Array(32).fill(0xaa);

      (mockDataStore.getPreimage as jest.Mock).mockReturnValue({
        isJust: () => false,
      });

      const request = new Uint8Array(34);
      request[0] = ClientCommandCodes.GET_PREIMAGE;
      request[1] = 0x00;
      request.set(hash, 2);

      expect(() => interpreter.execute(request)).toThrow(
        "Preimage not found in dataStore",
      );
      expect(interpreter.getQueue()).toEqual([]);
    });
  });

  describe("GET_MERKLE_LEAF_PROOF command", () => {
    it("should return the merkle leaf proof when found and use queue correctly", () => {
      const rootHash = new Uint8Array(32).fill(0xaa);
      const n = 5;
      const i = 2;
      const leafHash = new Uint8Array(32).fill(0xff);
      // create a proof longer than the maximum number of proof elements that can be returned
      const proof = [
        new Uint8Array(32).fill(0xde),
        new Uint8Array(32).fill(0xf1),
        new Uint8Array(32).fill(0xde),
        new Uint8Array(32).fill(0xf1),
        new Uint8Array(32).fill(0xde),
        new Uint8Array(32).fill(0xf1),
      ];

      (mockDataStore.getMerkleProof as jest.Mock).mockReturnValue({
        isJust: () => true,
        extract: () => ({ leafHash, proof }),
      });

      const nVarint = encodeVarint(n).unsafeCoerce();
      const iVarint = encodeVarint(i).unsafeCoerce();

      const requestLength = 1 + 32 + nVarint.length + iVarint.length;
      const request = new Uint8Array(requestLength);
      let offset = 0;
      request[offset++] = ClientCommandCodes.GET_MERKLE_LEAF_PROOF;
      request.set(rootHash, offset);
      offset += 32;
      request.set(nVarint, offset);
      offset += nVarint.length;
      request.set(iVarint, offset);

      const response = interpreter.execute(request);

      const maxPayloadSize = 255 - 32 - 1 - 1;
      const maxP = Math.floor(maxPayloadSize / 32);
      const p = Math.min(proof.length, maxP);

      const expectedResponseLength = 32 + 1 + 1 + 32 * p;
      const expectedResponse = new Uint8Array(expectedResponseLength);
      let respOffset = 0;
      expectedResponse.set(leafHash, respOffset);
      respOffset += 32;
      expectedResponse[respOffset++] = proof.length; // total number of proof elements
      expectedResponse[respOffset++] = p; // number of proof elements included in this response
      for (let j = 0; j < p; j++) {
        expectedResponse.set(proof[j] as Uint8Array, respOffset);
        respOffset += 32;
      }

      expect(response).toEqual(expectedResponse);
      const remainingProofElements = proof.slice(p);
      expect(interpreter.getQueue()).toEqual(remainingProofElements);
    });

    it("should return the entire proof in response when it fits", () => {
      const rootHash = new Uint8Array(32).fill(0xaa);
      const n = 5;
      const i = 2;
      const leafHash = new Uint8Array(32).fill(0xff);
      // create a proof that fits entirely in the response
      const proof = [
        new Uint8Array(32).fill(0xde),
        new Uint8Array(32).fill(0xf1),
      ];

      (mockDataStore.getMerkleProof as jest.Mock).mockReturnValue({
        isJust: () => true,
        extract: () => ({ leafHash, proof }),
      });

      const nVarint = encodeVarint(n).unsafeCoerce();
      const iVarint = encodeVarint(i).unsafeCoerce();

      const requestLength = 1 + 32 + nVarint.length + iVarint.length;
      const request = new Uint8Array(requestLength);
      let offset = 0;
      request[offset++] = ClientCommandCodes.GET_MERKLE_LEAF_PROOF;
      request.set(rootHash, offset);
      offset += 32;
      request.set(nVarint, offset);
      offset += nVarint.length;
      request.set(iVarint, offset);

      const response = interpreter.execute(request);

      const maxPayloadSize = 255 - 32 - 1 - 1;
      const maxP = Math.floor(maxPayloadSize / 32);
      const p = Math.min(proof.length, maxP);

      const expectedResponseLength = 32 + 1 + 1 + 32 * p;
      const expectedResponse = new Uint8Array(expectedResponseLength);
      let respOffset = 0;
      expectedResponse.set(leafHash, respOffset);
      respOffset += 32;
      expectedResponse[respOffset++] = proof.length; // total number of proof elements
      expectedResponse[respOffset++] = p; // number of proof elements included in this response
      for (let j = 0; j < p; j++) {
        expectedResponse.set(proof[j] as Uint8Array, respOffset);
        respOffset += 32;
      }

      expect(response).toEqual(expectedResponse);
      expect(interpreter.getQueue()).toEqual([]);
    });

    it("should throw an error when merkle proof is not found in dataStore", () => {
      const rootHash = new Uint8Array(32).fill(0xaa);
      const n = 5;
      const i = 2;

      (mockDataStore.getMerkleProof as jest.Mock).mockReturnValue({
        isJust: () => false,
      });

      const nVarint = encodeVarint(n).unsafeCoerce();
      const iVarint = encodeVarint(i).unsafeCoerce();

      const requestLength = 1 + 32 + nVarint.length + iVarint.length;
      const request = new Uint8Array(requestLength);
      let offset = 0;
      request[offset++] = ClientCommandCodes.GET_MERKLE_LEAF_PROOF;
      request.set(rootHash, offset);
      offset += 32;
      request.set(nVarint, offset);
      offset += nVarint.length;
      request.set(iVarint, offset);

      expect(() => interpreter.execute(request)).toThrow(
        "Merkle proof not found in dataStore",
      );
      expect(interpreter.getQueue()).toEqual([]);
    });

    it("should throw an error when request length is invalid", () => {
      const request = new Uint8Array([
        ClientCommandCodes.GET_MERKLE_LEAF_PROOF,
      ]);

      expect(() => interpreter.execute(request)).toThrow(
        "Invalid GET_MERKLE_LEAF_PROOF request length",
      );
      expect(interpreter.getQueue()).toEqual([]);
    });
  });
});

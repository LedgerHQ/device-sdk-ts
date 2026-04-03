import { ApduResponse } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { BlockProtocolTask, type BlockProtocolTaskArgs } from "./BlockProtocolTask";

// Helper to create an ApduResponse with instruction byte prefix
function makeResponse(
  instructionByte: number,
  payload: Uint8Array,
  statusCode = new Uint8Array([0x90, 0x00]),
): ApduResponse {
  const data = new Uint8Array(1 + payload.length);
  data[0] = instructionByte;
  data.set(payload, 1);
  return new ApduResponse({ statusCode, data });
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hash);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("BlockProtocolTask", () => {
  const baseArgs: Omit<BlockProtocolTaskArgs, "params"> = {
    cla: 0x00,
    ins: 0x03,
    p1: 0x00,
    p2: 0x00,
  };

  describe("block chain construction", () => {
    it("should send START with root hash and handle RESULT_FINAL for small payload", async () => {
      const sendApdu = vi.fn();
      const param = new Uint8Array([1, 2, 3, 4, 5]);

      // Build expected block: [32 zero bytes] + [1, 2, 3, 4, 5]
      const linkedChunk = new Uint8Array(32 + param.length);
      linkedChunk.set(param, 32);
      const rootHash = await sha256(linkedChunk);

      // First call: START message -> device requests the block
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x02, rootHash)), // GET_CHUNK with the root hash
      );

      // Second call: provide the block -> device sends RESULT_FINAL
      const expectedResult = new Uint8Array([42, 43, 44]);
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, expectedResult)), // RESULT_FINAL
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [param],
      });
      const result = await task.run();

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual(expectedResult);
      }

      // Verify the START message
      const startApdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
      // data[5] = HostToLedger.START (0x00)
      expect(startApdu[5]).toBe(0x00);
      // data[6..37] = root hash
      expect(toHex(startApdu.slice(6, 38))).toBe(toHex(rootHash));
    });

    it("should handle multi-chunk parameter with correct chaining", async () => {
      const sendApdu = vi.fn();
      // Create a payload larger than 180 bytes (2 chunks)
      const param = new Uint8Array(200);
      for (let i = 0; i < 200; i++) param[i] = i % 256;

      const chunk1 = param.slice(0, 180);
      const chunk2 = param.slice(180);

      // Build expected chain:
      // Block 2 (last): [32 zeros] + chunk2
      const linkedChunk2 = new Uint8Array(32 + chunk2.length);
      linkedChunk2.set(chunk2, 32);
      const hash2 = await sha256(linkedChunk2);

      // Block 1 (first): [hash2] + chunk1
      const linkedChunk1 = new Uint8Array(32 + chunk1.length);
      linkedChunk1.set(hash2, 0);
      linkedChunk1.set(chunk1, 32);
      const hash1 = await sha256(linkedChunk1);

      // Mock: START -> GET_CHUNK(hash1) -> GET_CHUNK(hash2) -> RESULT_FINAL
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x02, hash1)), // GET_CHUNK for block 1
      );
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x02, hash2)), // GET_CHUNK for block 2
      );
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([0xaa, 0xbb]))), // RESULT_FINAL
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [param],
      });
      const result = await task.run();

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual(new Uint8Array([0xaa, 0xbb]));
      }

      // Verify 3 APDU calls: START, GET_CHUNK_RESPONSE x2
      expect(sendApdu).toHaveBeenCalledTimes(3);
    });
  });

  describe("multiple parameters", () => {
    it("should send multiple root hashes in START message", async () => {
      const sendApdu = vi.fn();
      const param1 = new Uint8Array([0x01]);
      const param2 = new Uint8Array([0x02]);

      // Compute root hashes
      const linked1 = new Uint8Array(32 + 1);
      linked1[32] = 0x01;
      const hash1 = await sha256(linked1);

      const linked2 = new Uint8Array(32 + 1);
      linked2[32] = 0x02;
      const hash2 = await sha256(linked2);

      // Mock immediate RESULT_FINAL
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([0xff]))),
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [param1, param2],
      });
      await task.run();

      // START payload: [0x00] [hash1 (32 bytes)] [hash2 (32 bytes)]
      const startApdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
      expect(startApdu[4]).toBe(1 + 32 + 32); // data length
      expect(startApdu[5]).toBe(0x00); // START
      expect(toHex(startApdu.slice(6, 38))).toBe(toHex(hash1));
      expect(toHex(startApdu.slice(38, 70))).toBe(toHex(hash2));
    });
  });

  describe("RESULT_ACCUMULATING", () => {
    it("should accumulate results across multiple responses", async () => {
      const sendApdu = vi.fn();

      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x00, new Uint8Array([0x01, 0x02]))), // ACCUMULATING
      );
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([0x03, 0x04]))), // FINAL
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      const result = await task.run();

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
      }

      // Second call should be RESULT_ACCUMULATING_RESPONSE (0x04)
      const secondApdu = sendApdu.mock.calls[1]![0]! as Uint8Array;
      expect(secondApdu[5]).toBe(0x04);
    });
  });

  describe("PUT_CHUNK", () => {
    it("should store data from ledger and respond with PUT_CHUNK_RESPONSE", async () => {
      const sendApdu = vi.fn();
      const putData = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x03, putData)), // PUT_CHUNK
      );
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([0xff]))), // RESULT_FINAL
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      const result = await task.run();

      expect("data" in result).toBe(true);

      // Second call should be PUT_CHUNK_RESPONSE (0x03)
      const secondApdu = sendApdu.mock.calls[1]![0]! as Uint8Array;
      expect(secondApdu[5]).toBe(0x03);
    });
  });

  describe("error handling", () => {
    it("should return error on non-9000 status word", async () => {
      const sendApdu = vi.fn();

      sendApdu.mockResolvedValueOnce(
        Right(
          new ApduResponse({
            statusCode: new Uint8Array([0x6d, 0x00]),
            data: new Uint8Array([0x01]),
          }),
        ),
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      const result = await task.run();

      expect("error" in result).toBe(true);
    });

    it("should return error on transport failure", async () => {
      const sendApdu = vi.fn();
      sendApdu.mockResolvedValueOnce(Left(new Error("Transport disconnected")));

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      const result = await task.run();

      expect("error" in result).toBe(true);
    });

    it("should send GET_CHUNK_RESPONSE_FAILURE for unknown hash", async () => {
      const sendApdu = vi.fn();
      const unknownHash = new Uint8Array(32).fill(0xff);

      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x02, unknownHash)), // GET_CHUNK with unknown hash
      );
      // Device might error after failure response
      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([]))), // RESULT_FINAL
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      await task.run();

      // Second call should be GET_CHUNK_RESPONSE_FAILURE (0x02)
      const secondApdu = sendApdu.mock.calls[1]![0]! as Uint8Array;
      expect(secondApdu[5]).toBe(0x02);
    });

    it("should return error on empty response data", async () => {
      const sendApdu = vi.fn();
      sendApdu.mockResolvedValueOnce(
        Right(
          new ApduResponse({
            statusCode: new Uint8Array([0x90, 0x00]),
            data: new Uint8Array([]),
          }),
        ),
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        ...baseArgs,
        params: [new Uint8Array([0x00])],
      });
      const result = await task.run();

      expect("error" in result).toBe(true);
    });
  });

  describe("APDU framing", () => {
    it("should use correct CLA/INS/P1/P2 in all messages", async () => {
      const sendApdu = vi.fn();

      sendApdu.mockResolvedValueOnce(
        Right(makeResponse(0x01, new Uint8Array([0xff]))),
      );

      const task = new BlockProtocolTask({ sendApdu } as never, {
        cla: 0x00,
        ins: 0x02,
        p1: 0x00,
        p2: 0x00,
        params: [new Uint8Array([0x01])],
      });
      await task.run();

      const apdu = sendApdu.mock.calls[0]![0]! as Uint8Array;
      expect(apdu[0]).toBe(0x00); // CLA
      expect(apdu[1]).toBe(0x02); // INS
      expect(apdu[2]).toBe(0x00); // P1
      expect(apdu[3]).toBe(0x00); // P2
    });
  });
});

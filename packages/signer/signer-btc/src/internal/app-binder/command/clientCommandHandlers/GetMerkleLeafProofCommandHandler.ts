import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlerTypes";

export class GetMerkleLeafProofCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    let offset = 1;
    if (request.length < offset + 32) {
      //temp error
      throw new Error("Invalid GET_MERKLE_LEAF_PROOF request length");
    }
    const rootHash = request.slice(offset, offset + 32);
    offset += 32;

    const [_n, nVarintSize] = decodeBitcoinVarint(request, offset);
    offset += nVarintSize;

    const [i, iVarintSize] = decodeBitcoinVarint(request, offset);
    offset += iVarintSize;

    const maybeProof = context.dataStore.getMerkleProof(rootHash, i);

    if (maybeProof.isJust()) {
      const { leafHash, proof } = maybeProof.extract();
      const maxPayloadSize = 255 - 32 - 1 - 1;
      const maxP = Math.floor(maxPayloadSize / 32);
      const p = Math.min(proof.length, maxP);

      const response = new Uint8Array(32 + 1 + 1 + 32 * p);
      let offsetResp = 0;
      response.set(leafHash, offsetResp);
      offsetResp += 32;
      response[offsetResp++] = proof.length;
      response[offsetResp++] = p;

      for (let j = 0; j < p; j++) {
        const proofElement = proof[j];
        if (proofElement) {
          response.set(proofElement, offsetResp);
        } else {
          //temp error
          throw new Error("Proof element is undefined");
        }
        offsetResp += 32;
      }

      if (p < proof.length) {
        for (let j = p; j < proof.length; j++) {
          context.queue.push(proof[j] as Uint8Array);
        }
      }

      return response;
    } else {
      //temp error
      throw new Error("Merkle proof not found in dataStore");
    }
  }
}

//!!!!! TEMP FUNCTION !!!!!
export const decodeBitcoinVarint = (
  buffer: Uint8Array,
  offset: number,
): [number, number] => {
  if (offset >= buffer.length) {
    throw new Error("Buffer underflow in decodeBitcoinVarint");
  }
  const first = buffer[offset];
  if (first === undefined) {
    throw new Error("Buffer underflow in decodeBitcoinVarint");
  }
  if (first < 0xfd) {
    return [first, 1];
  } else if (first === 0xfd) {
    if (offset + 2 >= buffer.length) {
      throw new Error("Buffer underflow in decodeBitcoinVarint");
    }
    if (offset + 2 < buffer.length) {
      const byte1 = buffer[offset + 1];
      const byte2 = buffer[offset + 2];
      if (byte1 === undefined || byte2 === undefined) {
        throw new Error("Buffer underflow in decodeBitcoinVarint");
      }
      return [byte1 + (byte2 << 8), 3];
    } else {
      throw new Error("Buffer underflow in decodeBitcoinVarint");
    }
  } else if (first === 0xfe) {
    if (offset + 4 >= buffer.length) {
      throw new Error("Buffer underflow in decodeBitcoinVarint");
    }
    return [
      (buffer[offset + 1] ?? 0) +
        ((buffer[offset + 2] ?? 0) << 8) +
        ((buffer[offset + 3] ?? 0) << 16) +
        ((buffer[offset + 4] ?? 0) << 24),
      5,
    ];
  } else {
    throw new Error("Varint too large");
  }
};

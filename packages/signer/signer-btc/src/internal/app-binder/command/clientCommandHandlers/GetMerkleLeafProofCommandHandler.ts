import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { type Maybe } from "purify-ts/Maybe";

import { extractVarint, type Varint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";

export class GetMerkleLeafProofCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    const rootHash = request.slice(1, 33);
    const parser = new ByteArrayParser(request.slice(33));

    const nVarintMaybe: Maybe<Varint> = extractVarint(parser);
    if (nVarintMaybe.isNothing()) {
      //temp error
      throw new Error("Failed to extract 'n' varint");
    }
    const nVarint = nVarintMaybe.extract();
    if (!nVarint) {
      //temp error
      throw new Error("Failed to extract 'n' varint");
    }
    const iVarintMaybe: Maybe<Varint> = extractVarint(parser);
    if (iVarintMaybe.isNothing()) {
      //temp error
      throw new Error("Failed to extract 'i' varint");
    }
    const iVarint = iVarintMaybe.extract();
    if (!iVarint) {
      //temp error
      throw new Error("Failed to extract 'n' varint");
    }
    const i = iVarint.value;

    const maybeProof = context.dataStore.getMerkleProof(rootHash, i);

    if (maybeProof.isJust()) {
      const { leafHash, proof } = maybeProof.extract();
      const maxPayloadSize = 255 - 32 - 1 - 1; // 255 total - 32 (leafHash) - 1 (proof.length) - 1 (p)

      const maxProofElements = Math.floor(maxPayloadSize / 32);
      const p = Math.min(proof.length, maxProofElements);

      const responseSize = 32 + 1 + 1 + 32 * p;
      const response = new Uint8Array(responseSize);
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

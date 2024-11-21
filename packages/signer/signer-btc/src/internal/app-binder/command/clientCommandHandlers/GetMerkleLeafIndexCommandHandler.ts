import { encodeVarint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlerTypes";

export class GetMerkleLeafIndexCommandHandler implements CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array {
    if (request.length !== 1 + 32 + 32) {
      //temp error
      throw new Error("Invalid GET_MERKLE_LEAF_INDEX request length");
    }

    const rootHash = request.slice(1, 33);
    const leafHash = request.slice(33, 65);

    const maybeIndex = context.dataStore.getMerkleLeafIndex(rootHash, leafHash);

    if (maybeIndex.isJust()) {
      const index = maybeIndex.extract();
      const indexVarint = encodeVarint(index).unsafeCoerce();
      const response = new Uint8Array(1 + indexVarint.length);
      response[0] = 1;
      response.set(indexVarint, 1);
      return response;
    } else {
      const response = new Uint8Array(1);
      response[0] = 0;
      return response;
    }
  }
}

import { type DmkError } from "@ledgerhq/device-management-kit";
import { type Either, Right } from "purify-ts";

import { BUFFER_SIZE } from "@internal/app-binder/command/utils/constants";
import { encodeVarint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";

export const GetMerkleLeafIndexCommandHandler: CommandHandler = (
  request: Uint8Array,
  commandHandlerContext: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  const merkleRootHash = request.slice(1, BUFFER_SIZE + 1); // extract the Merkle root hash
  const leafNodeHash = request.slice(BUFFER_SIZE + 1, BUFFER_SIZE * 2 + 1); // extract the leaf hash

  const maybeMerkleIndex = commandHandlerContext.dataStore.getMerkleLeafIndex(
    merkleRootHash,
    leafNodeHash,
  );

  return maybeMerkleIndex.mapOrDefault(
    (leafIndex) => {
      const encodedLeafIndexVarint = encodeVarint(leafIndex).unsafeCoerce();
      const responseBuffer = new Uint8Array(1 + encodedLeafIndexVarint.length);
      responseBuffer[0] = 1; // index was found
      responseBuffer.set(encodedLeafIndexVarint, 1); // append the varint-encoded index
      return Right(responseBuffer);
    },
    Right(Uint8Array.from([0])), // default response: index not found
  );
};

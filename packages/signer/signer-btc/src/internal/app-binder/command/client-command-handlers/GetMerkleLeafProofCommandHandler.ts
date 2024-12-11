import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  ByteArrayParser,
  type DmkError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { SHA256_SIZE } from "@internal/app-binder/command/utils/constants";
import { extractVarint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";

export const GetMerkleLeafProofCommandHandler: CommandHandler = (
  request: Uint8Array,
  context: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  const rootHash = request.slice(1, SHA256_SIZE + 1);
  const parser = new ByteArrayParser(request.slice(SHA256_SIZE + 1));

  return extractVarint(parser).mapOrDefault(
    () =>
      extractVarint(parser).mapOrDefault(
        (proofIndexVarint) =>
          context.dataStore
            .getMerkleProof(rootHash, proofIndexVarint.value)
            .mapOrDefault(
              ({ proof, leafHash }) => {
                const maxPayloadSize = APDU_MAX_PAYLOAD - SHA256_SIZE - 1 - 1;
                const maxProofElements = Math.floor(
                  maxPayloadSize / SHA256_SIZE,
                );
                const proofElementsCount = Math.min(
                  proof.length,
                  maxProofElements,
                );

                const builder = new ByteArrayBuilder()
                  .addBufferToData(leafHash)
                  .add8BitUIntToData(proof.length)
                  .add8BitUIntToData(proofElementsCount);

                for (let i = 0; i < proofElementsCount; i++) {
                  const proofElement = proof[i];
                  if (proofElement) {
                    builder.addBufferToData(proofElement);
                  }
                }

                const response = builder.build();

                if (proofElementsCount < proof.length) {
                  for (let i = proofElementsCount; i < proof.length; i++) {
                    const proofElement = proof[i];
                    if (proofElement instanceof Uint8Array) {
                      context.queue.push(proofElement);
                    }
                  }
                }

                return Right(response);
              },
              Left(
                new ClientCommandHandlerError(
                  "Merkle proof not found in dataStore",
                ),
              ),
            ),
        Left(
          new ClientCommandHandlerError(
            "Failed to extract the proofIndex varint",
          ),
        ),
      ),
    Left(
      new ClientCommandHandlerError(
        "Failed to extract the numberOfElements varint",
      ),
    ),
  );
};

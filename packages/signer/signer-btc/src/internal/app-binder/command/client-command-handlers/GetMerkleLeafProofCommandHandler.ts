import {
  APDU_MAX_PAYLOAD,
  ByteArrayParser,
  type DmkError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, type Maybe, Right } from "purify-ts";

import { BUFFER_SIZE } from "@internal/app-binder/command/utils/constants";
import { extractVarint, type Varint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";

export const GetMerkleLeafProofCommandHandler: CommandHandler = (
  request: Uint8Array,
  context: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  const rootHash = request.slice(1, BUFFER_SIZE + 1);
  const parser = new ByteArrayParser(request.slice(33));

  const numberOfElementsMaybe: Maybe<Varint> = extractVarint(parser);
  if (numberOfElementsMaybe.isNothing()) {
    return Left(new ClientCommandHandlerError("Failed to extract 'n' varint"));
  }
  const numberOfElementsVarint = numberOfElementsMaybe.extract();
  if (!numberOfElementsVarint) {
    return Left(new ClientCommandHandlerError("Failed to extract 'n' varint"));
  }

  const proofIndexMaybe: Maybe<Varint> = extractVarint(parser);
  if (proofIndexMaybe.isNothing()) {
    return Left(new ClientCommandHandlerError("Failed to extract 'i' varint"));
  }
  const proofIndexVarint = proofIndexMaybe.extract();
  if (!proofIndexVarint) {
    return Left(new ClientCommandHandlerError("Failed to extract 'n' varint"));
  }
  const proofIndex = proofIndexVarint.value;

  const maybeProof = context.dataStore.getMerkleProof(rootHash, proofIndex);

  return maybeProof.mapOrDefault(
    ({ proof, leafHash }) => {
      const maxPayloadSize = APDU_MAX_PAYLOAD - BUFFER_SIZE - 1 - 1; // 255 total - 32 (leafHash) - 1 (proof.length) - 1 (p)

      const maxProofElements = Math.floor(maxPayloadSize / BUFFER_SIZE);
      const proofElementsCount = Math.min(proof.length, maxProofElements);

      const responseSize =
        BUFFER_SIZE + 1 + 1 + BUFFER_SIZE * proofElementsCount;
      const response = new Uint8Array(responseSize);
      let responseOffset = 0;

      response.set(leafHash, responseOffset);
      responseOffset += BUFFER_SIZE;

      response[responseOffset++] = proof.length;
      response[responseOffset++] = proofElementsCount;

      for (
        let proofElementIndex = 0;
        proofElementIndex < proofElementsCount;
        proofElementIndex++
      ) {
        const proofElement = proof[proofElementIndex];
        if (proofElement) {
          response.set(proofElement, responseOffset);
        }
        responseOffset += BUFFER_SIZE;
      }

      if (proofElementsCount < proof.length) {
        for (
          let remainingProofElementIndex = proofElementsCount;
          remainingProofElementIndex < proof.length;
          remainingProofElementIndex++
        ) {
          context.queue.push(proof[remainingProofElementIndex] as Uint8Array);
        }
      }

      return Right(response);
    },
    Left(new ClientCommandHandlerError("Merkle proof not found in dataStore")),
  );
};

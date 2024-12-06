import {
  APDU_MAX_PAYLOAD,
  type DmkError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { encodeVarint } from "@internal/utils/Varint";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";

export const GetPreimageCommandHandler: CommandHandler = (
  request: Uint8Array,
  commandHandlerContext: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  const hashFromRequest = request.slice(2, 34);
  const maybePreimage =
    commandHandlerContext.dataStore.getPreimage(hashFromRequest);

  if (maybePreimage.isJust()) {
    const preimage = maybePreimage.extract();
    const preimageLengthVarint = encodeVarint(preimage.length).unsafeCoerce();
    const maximumPayloadSize =
      APDU_MAX_PAYLOAD - preimageLengthVarint.length - 1;
    const bytesToIncludeInResponse = Math.min(
      maximumPayloadSize,
      preimage.length,
    );

    const response = new Uint8Array(
      preimageLengthVarint.length + 1 + bytesToIncludeInResponse,
    );
    let responseOffset = 0;
    response.set(preimageLengthVarint, responseOffset); // preimage length varint
    responseOffset += preimageLengthVarint.length;
    response[responseOffset++] = bytesToIncludeInResponse; // number of bytes in the response
    response.set(preimage.slice(0, bytesToIncludeInResponse), responseOffset);

    if (bytesToIncludeInResponse < preimage.length) {
      for (
        let remainingByteIndex = bytesToIncludeInResponse;
        remainingByteIndex < preimage.length;
        remainingByteIndex++
      ) {
        commandHandlerContext.queue.push(
          preimage.slice(remainingByteIndex, remainingByteIndex + 1),
        );
      }
    }

    return Right(response);
  }

  return Left(new ClientCommandHandlerError("Preimage not found in dataStore"));
};

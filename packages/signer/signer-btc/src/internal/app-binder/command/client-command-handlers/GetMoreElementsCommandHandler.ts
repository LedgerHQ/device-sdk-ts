import {
  APDU_MAX_PAYLOAD,
  type DmkError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "./Errors";

export const GetMoreElementsCommandHandler: CommandHandler = (
  _request: Uint8Array,
  commandHandlerContext: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  if (commandHandlerContext.queue.length === 0) {
    return Left(new ClientCommandHandlerError("No more elements in queue"));
  }

  const firstElementSize = commandHandlerContext.queue[0]?.length;
  if (firstElementSize === undefined) {
    return Left(new ClientCommandHandlerError("Queue is empty"));
  }

  if (
    !commandHandlerContext.queue.every(
      (queueElement) => queueElement.length === firstElementSize,
    )
  ) {
    return Left(
      new ClientCommandHandlerError("Elements in queue have varying lengths"),
    );
  }

  const maxPayloadSize = APDU_MAX_PAYLOAD - 1 - 1; // payload size minus bytes for count and size metadata
  const maximumNumberOfElements = Math.floor(maxPayloadSize / firstElementSize);
  const numberOfElementsToReturn = Math.min(
    maximumNumberOfElements,
    commandHandlerContext.queue.length,
  );

  const responseSize = 1 + 1 + numberOfElementsToReturn * firstElementSize;
  const response = new Uint8Array(responseSize);
  let responseOffset = 0;

  response[responseOffset++] = numberOfElementsToReturn; // number of elements in the response
  response[responseOffset++] = firstElementSize; // size of each element

  for (
    let queueIndex = 0;
    queueIndex < numberOfElementsToReturn;
    queueIndex++
  ) {
    const queueElement = commandHandlerContext.queue[queueIndex];
    if (queueElement) {
      response.set(queueElement, responseOffset);
      responseOffset += firstElementSize;
    }
  }

  commandHandlerContext.queue.splice(0, numberOfElementsToReturn);

  return Right(response);
};

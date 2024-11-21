import { type DmkError } from "@ledgerhq/device-management-kit";
import { type Either, Right } from "purify-ts";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "./ClientCommandHandlersTypes";

export const YieldCommandHandler: CommandHandler = (
  request: Uint8Array,
  commandHandlerContext: CommandHandlerContext,
): Either<DmkError, Uint8Array> => {
  const requestData = request.slice(1); // extract data from the request
  commandHandlerContext.yieldedResults.push(requestData); // add data to the yielded results in the context
  return Right(new Uint8Array([])); // return an empty response
};

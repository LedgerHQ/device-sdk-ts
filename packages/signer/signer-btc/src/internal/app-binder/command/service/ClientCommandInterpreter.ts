import { type DmkError } from "@ledgerhq/device-management-kit";
import { type Either, Left } from "purify-ts";

import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import { ClientCommandHandlerError } from "@internal/app-binder/command/client-command-handlers/Errors";
import { GetMerkleLeafIndexCommandHandler } from "@internal/app-binder/command/client-command-handlers/GetMerkleLeafIndexCommandHandler";
import { GetMerkleLeafProofCommandHandler } from "@internal/app-binder/command/client-command-handlers/GetMerkleLeafProofCommandHandler";
import { GetMoreElementsCommandHandler } from "@internal/app-binder/command/client-command-handlers/GetMoreElementsCommandHandler";
import { GetPreimageCommandHandler } from "@internal/app-binder/command/client-command-handlers/GetPreimageCommandHandler";
import { YieldCommandHandler } from "@internal/app-binder/command/client-command-handlers/YeldCommandHandler";
import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";

export class ClientCommandInterpreter {
  public getClientCommandPayload(
    request: Uint8Array,
    context: ClientCommandContext,
  ): Either<DmkError, Uint8Array> {
    const requestCode = request[0];
    if (
      requestCode === undefined ||
      !Object.values(ClientCommandCodes).includes(requestCode)
    ) {
      return Left(
        new ClientCommandHandlerError(`Unexpected command code ${requestCode}`),
      );
    }

    switch (requestCode) {
      case ClientCommandCodes.YIELD:
        return YieldCommandHandler(request, context);
      case ClientCommandCodes.GET_PREIMAGE:
        return GetPreimageCommandHandler(request, context);
      case ClientCommandCodes.GET_MERKLE_LEAF_PROOF:
        return GetMerkleLeafProofCommandHandler(request, context);
      case ClientCommandCodes.GET_MERKLE_LEAF_INDEX:
        return GetMerkleLeafIndexCommandHandler(request, context);
      case ClientCommandCodes.GET_MORE_ELEMENTS:
        return GetMoreElementsCommandHandler(request, context);
      default:
        return Left(
          new ClientCommandHandlerError(
            `Unhandled command code ${requestCode}`,
          ),
        );
    }
  }
}

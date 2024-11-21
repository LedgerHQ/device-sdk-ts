import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";

import { type CommandHandler } from "./ClientCommandHandlerTypes";
import { GetMerkleLeafIndexCommandHandler } from "./GetMerkleLeafIndexCommandHandler";
import { GetMerkleLeafProofCommandHandler } from "./GetMerkleLeafProofCommandHandler";
import { GetMoreElementsCommandHandler } from "./GetMoreElementsCommandHandler";
import { GetPreimageCommandHandler } from "./GetPreimageCommandHandler";
import { YieldCommandHandler } from "./YeldCommandHandler";

export const clientCommandsMap = new Map<ClientCommandCodes, CommandHandler>([
  [ClientCommandCodes.YIELD, new YieldCommandHandler()],
  [ClientCommandCodes.GET_PREIMAGE, new GetPreimageCommandHandler()],
  [
    ClientCommandCodes.GET_MERKLE_LEAF_PROOF,
    new GetMerkleLeafProofCommandHandler(),
  ],
  [
    ClientCommandCodes.GET_MERKLE_LEAF_INDEX,
    new GetMerkleLeafIndexCommandHandler(),
  ],
  [ClientCommandCodes.GET_MORE_ELEMENTS, new GetMoreElementsCommandHandler()],
]);

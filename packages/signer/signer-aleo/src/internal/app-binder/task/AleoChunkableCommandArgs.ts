import { type Command } from "@ledgerhq/device-management-kit";

import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type AleoChunkableCommandArgs = {
  chunkedData: Uint8Array;
  isFirst: boolean;
};

export type AleoCommandFactory<T> = (
  args: AleoChunkableCommandArgs,
) => Command<T, AleoChunkableCommandArgs, AleoErrorCodes>;

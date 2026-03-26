import { type Command } from "@ledgerhq/device-management-kit";

import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type AleoChunkableCommandArgs = {
  dataLength: number;
  chunkedData: Uint8Array;
  isFirst: boolean;
  derivationPath?: string;
};

export type AleoCommandFactory<T> = (
  args: AleoChunkableCommandArgs,
) => Command<T, AleoChunkableCommandArgs, AleoErrorCodes>;

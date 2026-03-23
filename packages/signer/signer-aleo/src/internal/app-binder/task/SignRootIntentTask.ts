import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

import {
  SignRootIntentCommand,
  type SignRootIntentCommandResponse,
} from "../command/SignRootIntentCommand";
import { SendAleoCommandInChunksTask } from "./SendAleoCommandInChunksTask";

export type SignRootIntentTaskArgs = {
  derivationPath: string;
  rootIntent: Uint8Array;
};

export class SignRootIntentTask {
  constructor(
    private api: InternalApi,
    private args: SignRootIntentTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<SignRootIntentCommandResponse, AleoErrorCodes>
  > {
    const { derivationPath, rootIntent } = this.args;

    const path = DerivationPathUtils.splitPath(derivationPath);
    // Path length (1 byte) + Path (4 bytes per element) + Data length (2 bytes) + Root intent data
    const totalLength = 1 + path.length * 4 + 2 + rootIntent.byteLength;

    const builder = new ByteArrayBuilder(totalLength);

    // Add the derivation path
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    // Add intent length
    builder.add16BitUIntToData(rootIntent.byteLength);

    // Add the root intent data
    builder.addBufferToData(rootIntent);

    const fullPayload = builder.build();

    return new SendAleoCommandInChunksTask<SignRootIntentCommandResponse>(
      this.api,
      {
        dataLength: rootIntent.byteLength,
        data: fullPayload,
        commandFactory: (chunkArgs) => new SignRootIntentCommand(chunkArgs),
      },
    ).run();
  }
}

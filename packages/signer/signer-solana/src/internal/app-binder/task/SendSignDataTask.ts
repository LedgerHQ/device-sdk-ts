import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  type CommandFactory,
  DerivationPathUtils,
  SendCommandInChunksTask,
} from "@ledgerhq/signer-utils";
import { type Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

const PATH_SIZE = 4;

type SignDataTaskArgs<T = Maybe<Signature>> = {
  sendingData: Uint8Array;
  derivationPath: string;
  commandFactory: CommandFactory<T, SolanaAppErrorCodes>;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export class SignDataTask<T = Maybe<Signature>> {
  private readonly logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SignDataTaskArgs<T>,
  ) {
    this.logger = args.loggerFactory("SignDataTask");
  }

  async run(): Promise<CommandResult<T, SolanaAppErrorCodes>> {
    const { sendingData, derivationPath, commandFactory } = this.args;

    this.logger.debug("[run] sending signing data in chunks", {
      data: { length: sendingData.length },
    });

    const paths = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ByteArrayBuilder(
      sendingData.length + 2 + paths.length * PATH_SIZE,
    );
    // add the number of signers
    builder.add8BitUIntToData(1);
    // add the number of derivation
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => builder.add32BitUIntToData(path));
    builder.addBufferToData(sendingData);
    const buffer = builder.build();

    const result = await new SendCommandInChunksTask<T, SolanaAppErrorCodes>(
      this.api,
      {
        data: buffer,
        commandFactory,
      },
    ).run();

    this.logger.debug("[run] signing data sent", {
      data: { success: isSuccessCommandResult(result) },
    });

    return result;
  }
}

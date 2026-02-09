import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

import {
  type CommandFactory,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SignDataTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
  commandFactory: CommandFactory<Maybe<Signature | SolanaAppErrorCodes>>;
  logger: LoggerPublisherService;
};

export class SignDataTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SignDataTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<
    CommandResult<Maybe<Signature | SolanaAppErrorCodes>, SolanaAppErrorCodes>
  > {
    const { sendingData, derivationPath, commandFactory } = this.args;

    this._logger.debug("[run] Starting SignDataTask", {
      data: {
        derivationPath,
        dataLength: sendingData.length,
      },
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

    const result = await new SendCommandInChunksTask<
      Maybe<Signature | SolanaAppErrorCodes>
    >(this.api, {
      data: buffer,
      commandFactory,
    }).run();

    this._logger.debug("[run] Data signed successfully");

    return result;
  }
}

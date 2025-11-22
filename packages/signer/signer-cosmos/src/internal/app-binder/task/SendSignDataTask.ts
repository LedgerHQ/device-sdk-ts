import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";

import {
  type CommandFactory,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SignDataTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
  commandFactory: CommandFactory<Maybe<Signature | CosmosAppErrorCodes>>;
};

export class SignDataTask {
  constructor(
    private api: InternalApi,
    private args: SignDataTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<Maybe<Signature | CosmosAppErrorCodes>, CosmosAppErrorCodes>
  > {
    const { sendingData, derivationPath, commandFactory } = this.args;

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

    return await new SendCommandInChunksTask<
      Maybe<Signature | CosmosAppErrorCodes>
    >(this.api, {
      data: buffer,
      commandFactory,
    }).run();
  }
}

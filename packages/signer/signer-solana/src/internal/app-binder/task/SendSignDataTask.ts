import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { type Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";

import {
  type CommandFactory,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

const PATH_SIZE = 4;

type SignDataTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
  commandFactory: CommandFactory<Maybe<Signature>>;
};

export class SignDataTask {
  constructor(
    private api: InternalApi,
    private args: SignDataTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Maybe<Signature>, void>> {
    const { sendingData, derivationPath, commandFactory } = this.args;

    const paths = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ByteArrayBuilder(
      sendingData.length + 1 + paths.length * PATH_SIZE,
    );
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => builder.add32BitUIntToData(path));
    builder.addBufferToData(sendingData);
    const buffer = builder.build();

    return await new SendCommandInChunksTask<Maybe<Signature>>(this.api, {
      data: buffer,
      commandFactory,
    }).run();
  }
}

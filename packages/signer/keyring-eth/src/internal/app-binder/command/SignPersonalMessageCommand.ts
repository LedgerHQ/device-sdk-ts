// https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#sign-eth-personal-message
import {
  Apdu,
  ApduBuilder,
  ApduBuilderArgs,
  ApduParser,
  ApduResponse,
  Command,
  CommandUtils,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

import { DerivationPathUtils } from "@internal/shared/utils/DerivationPathUtils";

const MAX_CHUNK_SIZE = 150;
const PATH_SIZE = 4;
const MESSAGE_LENGTH_SIZE = 4;
const DERIVATIONS_COUNT_SIZE = 1;

export type SignPersonalMessageCommandArgs = {
  readonly derivationPath: string;
  readonly message: string;
  readonly index: number;
};

export type SignPersonalMessageCommandResponse = {
  readonly r: string;
  readonly s: string;
  readonly v: string;
};

export class SignPersonalMessageCommand
  implements
    Command<SignPersonalMessageCommandResponse, SignPersonalMessageCommandArgs>
{
  readonly args: SignPersonalMessageCommandArgs;

  constructor(args: SignPersonalMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, message, index } = this.args;
    const signPersonalMessageArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x08,
      p1: index === 0 ? 0x00 : 0x80,
      p2: 0x00,
    };
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const builder = new ApduBuilder(signPersonalMessageArgs);
    const messageFirstChunkIndex =
      MAX_CHUNK_SIZE -
      paths.length * PATH_SIZE -
      DERIVATIONS_COUNT_SIZE -
      MESSAGE_LENGTH_SIZE;

    if (index === 0) {
      // Number of derivation paths
      builder.add8BitUIntToData(paths.length);

      paths.forEach((path) => {
        builder.add32BitUIntToData(path);
      });
      builder.add32BitUIntToData(message.length);
      builder.addAsciiStringToData(message.slice(0, messageFirstChunkIndex));
    } else {
      builder.addAsciiStringToData(
        message.slice(
          messageFirstChunkIndex + (index - 1) * MAX_CHUNK_SIZE,
          messageFirstChunkIndex + index * MAX_CHUNK_SIZE,
        ),
      );
    }
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): SignPersonalMessageCommandResponse {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      throw new InvalidStatusWordError(
        `Unexpected status word: ${parser.encodeToHexaString(
          apduResponse.statusCode,
        )}`,
      );
    }
    return {
      r: "",
      s: "",
      v: "",
    };
  }
}

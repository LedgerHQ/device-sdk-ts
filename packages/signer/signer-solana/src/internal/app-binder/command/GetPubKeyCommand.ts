import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import bs58 from "bs58";

import { type PublicKey } from "@api/model/PublicKey";

import {
  SolanaAppCommandError,
  solanaAppErrors,
} from "./utils/solanaAppErrors";

const PUBKEY_LENGTH = 32;

type GetPubKeyCommandResponse = PublicKey;
type GetPubKeyCommandArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};

export class GetPubKeyCommand
  implements Command<GetPubKeyCommandResponse, GetPubKeyCommandArgs>
{
  args: GetPubKeyCommandArgs;

  constructor(args: GetPubKeyCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const getPubKeyArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x05,
      p1: this.args.checkOnDevice ? 0x01 : 0x00,
      p2: 0x00,
    };
    const builder = new ApduBuilder(getPubKeyArgs);
    const derivationPath = this.args.derivationPath;

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<GetPubKeyCommandResponse> {
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, solanaAppErrors)) {
      return CommandResultFactory({
        error: new SolanaAppCommandError({
          ...solanaAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    if (parser.testMinimalLength(PUBKEY_LENGTH) === false) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Public key is missing"),
      });
    }

    const buffer = parser.extractFieldByLength(PUBKEY_LENGTH);
    if (buffer === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unable to extract public key"),
      });
    }

    return CommandResultFactory({
      data: bs58.encode(buffer),
    });
  }
}

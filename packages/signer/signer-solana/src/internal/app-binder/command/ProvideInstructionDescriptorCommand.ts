import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const CLA = 0xe0;
const INS = 0x16;
const P1 = 0x00;
const P2 = 0x00;
const SIGNATURE_TAG = 0x15;

export type ProvideInstructionDescriptorCommandArgs = {
  dataHex: string;
  signatureHex: string;
};

export class ProvideInstructionDescriptorCommand
  implements
    Command<
      void,
      ProvideInstructionDescriptorCommandArgs,
      SolanaAppErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideInstructionDescriptorCommandArgs) {}
  readonly name = "ProvideInstructionDescriptor";

  getApdu(): Apdu {
    const { dataHex, signatureHex } = this.args;

    const builder = new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    } as ApduBuilderArgs);

    const sigLen = signatureHex.length / 2;
    if (sigLen < 70 || sigLen > 72 || signatureHex.length % 2 !== 0) {
      throw new Error(`Invalid signature length: ${sigLen} bytes`);
    }

    const dataLen = dataHex.length / 2;
    const total = dataLen + 1 + 1 + sigLen;
    if (total > 255) {
      throw new Error(
        `Descriptor payload too large for short APDU: ${total} > 255`,
      );
    }

    builder
      .addHexaStringToData(dataHex)
      .add8BitUIntToData(SIGNATURE_TAG)
      .add8BitUIntToData(sigLen)
      .addHexaStringToData(signatureHex);

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SolanaAppErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) return error;

    if (response.data.length !== 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unexpected data in response"),
      });
    }
    return CommandResultFactory({ data: undefined });
  }
}

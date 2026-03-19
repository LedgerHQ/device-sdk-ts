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

export const CLA = 0xe0;
export const INS = 0x16;
export const P1 = 0x00;
export const P2 = 0x00;
export const SIGNATURE_TAG = 0x15;
export const DER_SIG_MIN_BYTES = 70;
export const DER_SIG_MAX_BYTES = 72;
const HEX_CHARS_PER_BYTE = 2;
const MAX_SHORT_APDU_PAYLOAD = 255;

export type ProvideInstructionDescriptorCommandArgs = {
  dataHex: string;
  signatureHex: string;
};

export class ProvideInstructionDescriptorCommand
  implements
    Command<void, ProvideInstructionDescriptorCommandArgs, SolanaAppErrorCodes>
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

    const sigLen = signatureHex.length / HEX_CHARS_PER_BYTE;
    if (
      sigLen < DER_SIG_MIN_BYTES ||
      sigLen > DER_SIG_MAX_BYTES ||
      signatureHex.length % HEX_CHARS_PER_BYTE !== 0
    ) {
      throw new Error(`Invalid signature length: ${sigLen} bytes`);
    }

    const dataLen = dataHex.length / HEX_CHARS_PER_BYTE;
    const total = dataLen + 1 + 1 + sigLen;
    if (total > MAX_SHORT_APDU_PAYLOAD) {
      throw new Error(
        `Descriptor payload too large for short APDU: ${total} > ${MAX_SHORT_APDU_PAYLOAD}`,
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

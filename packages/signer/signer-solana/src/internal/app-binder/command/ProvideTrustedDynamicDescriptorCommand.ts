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

export type ProvideTrustedDynamicDescriptorCommandArgs = {
  data: string;
  signature: string;
};

export class ProvideTrustedDynamicDescriptorCommand
  implements
    Command<
      void,
      ProvideTrustedDynamicDescriptorCommandArgs,
      SolanaAppErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(readonly args: ProvideTrustedDynamicDescriptorCommandArgs) {}

  getApdu(): Apdu {
    const apduBuilderArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1: P1,
      p2: P2,
    };
    return new ApduBuilder(apduBuilderArgs)
      .encodeInLVFromHexa(this.args.data)
      .encodeInLVFromHexa(this.args.signature)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<void, SolanaAppErrorCodes> {
    const error = this.errorHelper.getError(response);
    if (error) {
      return error;
    }

    if (response.data.length !== 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Unexpected data in response"),
      });
    }

    return CommandResultFactory({ data: undefined });
  }
}

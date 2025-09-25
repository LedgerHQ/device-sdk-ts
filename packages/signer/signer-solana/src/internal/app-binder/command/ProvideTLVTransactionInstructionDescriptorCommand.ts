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
const INS = 0x22;
const P2 = 0x00;

export type ProvideTLVTransactionInstructionDescriptorCommandArgs =
  | {
      kind: "descriptor";
      dataHex: string;
      signatureHex: string;
      isFirstMessage: boolean;
    }
  | {
      kind: "empty"; // send empty payload to keep instruction index alignment
      isFirstMessage: boolean;
    };

export class ProvideTLVTransactionInstructionDescriptorCommand
  implements
    Command<
      void,
      ProvideTLVTransactionInstructionDescriptorCommandArgs,
      SolanaAppErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    void,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  constructor(
    readonly args: ProvideTLVTransactionInstructionDescriptorCommandArgs,
  ) {}
  readonly name = "ProvideTLVTransactionInstructionDescriptor";

  getApdu(): Apdu {
    if (this.args.kind === "empty") {
      // just header + Lc=0
      return new ApduBuilder({
        cla: CLA,
        ins: INS,
        p1: this.args.isFirstMessage ? 0x00 : 0x80,
        p2: P2,
      }).build();
    }

    const { dataHex, signatureHex, isFirstMessage } = this.args;

    const apduBuilderArgs: ApduBuilderArgs = {
      cla: CLA,
      ins: INS,
      p1: isFirstMessage ? 0x00 : 0x80,
      p2: P2,
    };

    const builder = new ApduBuilder(apduBuilderArgs);

    // validate signature size (as spec 70–72 bytes)
    const sigLen = signatureHex.length / 2;
    if (sigLen < 70 || sigLen > 72 || signatureHex.length % 2 !== 0) {
      throw new Error(`Invalid signature length: ${sigLen} bytes`);
    }

    // check short APDU limit (255)
    const dataLen = dataHex.length / 2;
    const total = dataLen + 1 /*tag*/ + 1 /*len*/ + sigLen;
    if (total > 255) {
      throw new Error(
        `Descriptor payload too large for short APDU: ${total} > 255`,
      );
    }

    // build payload: data | 0x15 | <len> | <signature>
    builder
      .addHexaStringToData(dataHex)
      .add8BitUIntToData(0x15) // DER_SIGNATURE tag from spec
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

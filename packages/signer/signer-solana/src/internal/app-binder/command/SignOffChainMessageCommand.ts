import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import bs58 from "bs58";
import { Maybe } from "purify-ts";

import {
  SOLANA_APP_ERRORS,
  SolanaAppCommandErrorFactory,
  type SolanaAppErrorCodes,
} from "./utils/SolanaApplicationErrors";

const SIGNATURE_LENGTH = 64;

export type SignOffChainMessageCommandResponse = {
  signature: string;
};
export type SignOffChainMessageCommandArgs = {
  readonly message: Uint8Array;
};

export class SignOffChainMessageCommand
  implements
    Command<
      SignOffChainMessageCommandResponse,
      SignOffChainMessageCommandArgs,
      SolanaAppErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    SignOffChainMessageCommandResponse,
    SolanaAppErrorCodes
  >(SOLANA_APP_ERRORS, SolanaAppCommandErrorFactory);

  args: SignOffChainMessageCommandArgs;

  constructor(args: SignOffChainMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x07,
      p1: 0x01,
      p2: 0x00,
    })
      .addBufferToData(this.args.message)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignOffChainMessageCommandResponse, SolanaAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      // extract raw signature from device response
      const signature = parser.extractFieldByLength(SIGNATURE_LENGTH);
      if (!signature || signature.length !== SIGNATURE_LENGTH) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature extraction failed"),
        });
      }

      // build the OCM envelope: [signatureCount=1][signature][signedMessage]
      // signatureCount = 1 (single signer)
      const signatureCount = Uint8Array.of(1);

      // this.args.message is the off-chain message that was signed
      const msg = this.args.message;

      const envelope = new Uint8Array(
        signatureCount.length + signature.length + msg.length,
      );
      envelope.set(signatureCount, 0);
      envelope.set(signature, signatureCount.length);
      envelope.set(msg, signatureCount.length + signature.length);

      // base58-encode the envelope and return { signature: <b58> }
      const encoded = bs58.encode(envelope);

      return CommandResultFactory({
        data: { signature: encoded },
      });
    });
  }
}

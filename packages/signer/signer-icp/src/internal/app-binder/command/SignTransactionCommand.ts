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
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Just, Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import {
  ICP_APP_ERRORS,
  IcpAppCommandErrorFactory,
  type IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

export const P1_INIT = 0x00;
export const P1_ADD = 0x01;
export const P1_LAST = 0x02;
// P2 carries the neuron-stake flag; plain transfers always use 0.
export const P2_NO_STAKE = 0x00;

const DERIVATION_PATH_LENGTH = 5;
const SIGNATURE_R_LENGTH = 32;
const SIGNATURE_S_LENGTH = 32;
const SIGNATURE_V_LENGTH = 1;

export enum SignPhase {
  INIT = "init",
  ADD = "add",
  LAST = "last",
}

export const icpSignTransactionApduHeader = (p1: number) => ({
  cla: 0x11,
  ins: 0x02,
  p1,
  p2: P2_NO_STAKE,
});

export type SignTransactionCommandArgs = {
  phase: SignPhase;
  derivationPath?: string;
  transactionChunk?: Uint8Array;
};

export type SignTransactionCommandResponse = Maybe<Signature>;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      IcpErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly apduBuilder: ApduBuilder;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    IcpErrorCodes
  >(ICP_APP_ERRORS, IcpAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
    this.apduBuilder = new ApduBuilder(icpSignTransactionApduHeader(this.p1()));
  }

  public getApdu(): Apdu {
    return this.isFirstChunk() ? this.firstChunk() : this.nextChunk();
  }

  public parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, IcpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);

      // Only the last chunk carries the signature; INIT/ADD reply 0x9000 empty.
      // Empty ⇒ not-yet (Nothing); non-empty-but-incomplete ⇒ malformed.
      if (apduParser.getUnparsedRemainingLength() === 0) {
        return CommandResultFactory({ data: Nothing });
      }

      const r = apduParser.extractFieldByLength(SIGNATURE_R_LENGTH);
      const s = apduParser.extractFieldByLength(SIGNATURE_S_LENGTH);
      const v = apduParser.extractFieldByLength(SIGNATURE_V_LENGTH);
      const der = apduParser.extractFieldByLength(
        apduParser.getUnparsedRemainingLength(),
      );

      if (
        r === undefined ||
        s === undefined ||
        v === undefined ||
        v[0] === undefined ||
        der === undefined ||
        der.length === 0
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is malformed"),
        });
      }

      return CommandResultFactory({
        data: Just({
          r: apduParser.encodeToHexaString(r),
          s: apduParser.encodeToHexaString(s),
          v: v[0],
          der: apduParser.encodeToHexaString(der),
        }),
      });
    });
  }

  private p1(): number {
    switch (this.args.phase) {
      case SignPhase.INIT:
        return P1_INIT;
      case SignPhase.ADD:
        return P1_ADD;
      case SignPhase.LAST:
        return P1_LAST;
    }
  }

  private isFirstChunk(): boolean {
    return this.args.phase === SignPhase.INIT;
  }

  private firstChunk(): Apdu {
    const { derivationPath } = this.args;

    if (!derivationPath) {
      throw new Error(
        "SignTransactionCommand: derivation path is required for 'init' phase.",
      );
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    if (paths.length !== DERIVATION_PATH_LENGTH) {
      throw new Error(
        `SignTransactionCommand: expected ${DERIVATION_PATH_LENGTH} path elements, got ${paths.length}`,
      );
    }

    this.apduBuilder.addBufferToData(encodeDerivationPath(paths));
    return this.apduBuilder.build();
  }

  private nextChunk(): Apdu {
    if (!this.args.transactionChunk) {
      throw new Error(
        "SignTransactionCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    }

    this.apduBuilder.addBufferToData(this.args.transactionChunk);
    return this.apduBuilder.build();
  }
}

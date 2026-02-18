import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandErrorFactory,
  type CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export const COSMOS_SIGN_TRANSACTION_APDU_HEADER = (p1: number) => ({
  cla: 0x55,
  ins: 0x02,
  p1: p1,
  p2: 0x00,
});

export const P1_INIT = 0x00;
export const P1_ADD = 0x01;
export const P1_LAST = 0x02;

export enum SignPhase {
  INIT = "init",
  ADD = "add",
  LAST = "last",
}

export type SignTransactionCommandArgs = {
  phase: SignPhase;
  derivationPath?: string;
  hrp?: string;
  transactionChunk?: Uint8Array;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      CosmosErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly apduBuilder: ApduBuilder;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    CosmosErrorCodes
  >(COSMOS_APP_ERRORS, CosmosAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
    this.apduBuilder = new ApduBuilder(
      COSMOS_SIGN_TRANSACTION_APDU_HEADER(this.p1()),
    );
  }

  public getApdu(): Apdu {
    return this.isFirstChunk() ? this.firstChunk() : this.nextChunk();
  }

  public parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, CosmosErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);

      const remaining = apduParser.getUnparsedRemainingLength();
      const signature = apduParser.extractFieldByLength(remaining);

      return CommandResultFactory({
        data: signature as Signature,
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
    const { derivationPath, hrp } = this.args;

    if (!derivationPath || !hrp) {
      throw new Error(
        "SignTransactionCommand: derivation path and human readable prefix are required for 'init' phase.",
      );
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    if (paths.length !== 5) {
      throw new Error(
        `SignTransactionCommand: expected cosmos style number of path elements, got ${paths.length}`,
      );
    }

    const view = new DataView(new ArrayBuffer(20));
    for (let i = 0; i < paths.length; i++) {
      const raw = paths[i]! & 0x7fffffff;
      const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;
      view.setUint32(i * 4, hardened, true);
    }
    this.apduBuilder.addBufferToData(new Uint8Array(view.buffer));
    this.apduBuilder.encodeInLVFromAscii(hrp);
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

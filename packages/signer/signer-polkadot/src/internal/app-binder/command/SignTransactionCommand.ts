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
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import {
  POLKADOT_APP_ERRORS,
  PolkadotAppCommandErrorFactory,
  type PolkadotErrorCodes,
} from "@internal/app-binder/command/utils/polkadotApplicationErrors";
import { LEDGER_CLA } from "@internal/app-binder/constants";

// INS/P2 are specific to this command (the Ledger Polkadot app supports
// ed25519/secp256k1 only; signatures use ed25519 = 0x00).
const INS_SIGN_TRANSACTION = 0x02;
const P2_ED25519 = 0x00;

export const polkadotSignTransactionApduHeader = (p1: number) => ({
  cla: LEDGER_CLA,
  ins: INS_SIGN_TRANSACTION,
  p1,
  p2: P2_ED25519,
});

export const P1_INIT = 0x00;
export const P1_ADD = 0x01;
export const P1_LAST = 0x02;

const DERIVATION_PATH_LENGTH = 5;
const BLOB_LENGTH_MAX = 0xffff;

export enum SignPhase {
  INIT = "init",
  ADD = "add",
  LAST = "last",
}

export type SignTransactionCommandArgs = {
  phase: SignPhase;
  derivationPath?: string;
  blobLength?: number;
  transactionChunk?: Uint8Array;
};

export type SignTransactionCommandResponse = Signature;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      PolkadotErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly args: SignTransactionCommandArgs;

  private readonly apduBuilder: ApduBuilder;

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    PolkadotErrorCodes
  >(POLKADOT_APP_ERRORS, PolkadotAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
    this.apduBuilder = new ApduBuilder(
      polkadotSignTransactionApduHeader(this.p1()),
    );
  }

  public getApdu(): Apdu {
    return this.isFirstChunk() ? this.firstChunk() : this.nextChunk();
  }

  public parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, PolkadotErrorCodes> {
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
    const { derivationPath, blobLength } = this.args;

    if (!derivationPath || blobLength === undefined) {
      throw new Error(
        "SignTransactionCommand: derivation path and blob length are required for 'init' phase.",
      );
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    if (paths.length !== DERIVATION_PATH_LENGTH) {
      throw new Error(
        `SignTransactionCommand: expected ${DERIVATION_PATH_LENGTH} path elements, got ${paths.length}`,
      );
    }

    if (
      !Number.isInteger(blobLength) ||
      blobLength < 0 ||
      blobLength > BLOB_LENGTH_MAX
    ) {
      throw new Error(
        `SignTransactionCommand: blobLength must be a uint16 (0..${BLOB_LENGTH_MAX}), got ${blobLength}`,
      );
    }

    const encodedDerivationPath = encodeDerivationPath(paths);
    this.apduBuilder.addBufferToData(encodedDerivationPath);

    // blobLength: 2 bytes little-endian (firmware reads sizeof(uint16_t) via memcpy on ARM LE)
    const blobLenBuf = new Uint8Array(2);
    new DataView(blobLenBuf.buffer).setUint16(0, blobLength, true);
    this.apduBuilder.addBufferToData(blobLenBuf);

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

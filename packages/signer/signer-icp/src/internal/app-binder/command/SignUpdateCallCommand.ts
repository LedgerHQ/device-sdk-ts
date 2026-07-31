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

import { type DeviceUpdateCallSignature } from "@api/model/UpdateCallSignature";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import {
  ICP_APP_ERRORS,
  IcpAppCommandErrorFactory,
  type IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";
import {
  P1_ADD,
  P1_INIT,
  P1_LAST,
  SignPhase,
} from "@internal/app-binder/constants";

// Update calls always sign the normal transaction type; the stake flag is a
// transfer-path concern (INS 0x02).
export const P2_UPDATE_CALL = 0x00;

const DERIVATION_PATH_LENGTH = 5;
// The last-chunk response is a fixed 192-byte block: for the request and the
// read-state each, a 32-byte signed digest followed by a 64-byte r‖s signature.
const HASH_LENGTH = 32;
const SIGNATURE_R_LENGTH = 32;
const SIGNATURE_S_LENGTH = 32;

export const icpSignUpdateCallApduHeader = (p1: number) => ({
  cla: 0x11,
  ins: 0x03,
  p1,
  p2: P2_UPDATE_CALL,
});

export type SignUpdateCallCommandArgs = {
  phase: SignPhase;
  derivationPath?: string;
  transactionChunk?: Uint8Array;
};

export type SignUpdateCallCommandResponse = Maybe<DeviceUpdateCallSignature>;

export class SignUpdateCallCommand
  implements
    Command<
      SignUpdateCallCommandResponse,
      SignUpdateCallCommandArgs,
      IcpErrorCodes
    >
{
  readonly name = "SignUpdateCall";

  private readonly args: SignUpdateCallCommandArgs;

  private readonly apduBuilder: ApduBuilder;

  private readonly errorHelper = new CommandErrorHelper<
    SignUpdateCallCommandResponse,
    IcpErrorCodes
  >(ICP_APP_ERRORS, IcpAppCommandErrorFactory);

  constructor(args: SignUpdateCallCommandArgs) {
    this.args = args;
    this.apduBuilder = new ApduBuilder(icpSignUpdateCallApduHeader(this.p1()));
  }

  public getApdu(): Apdu {
    return this.isFirstChunk() ? this.firstChunk() : this.nextChunk();
  }

  public parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignUpdateCallCommandResponse, IcpErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);

      // Only the last chunk carries the signatures; INIT/ADD reply 0x9000 empty.
      // Empty ⇒ not-yet (Nothing); non-empty-but-incomplete ⇒ malformed.
      if (apduParser.getUnparsedRemainingLength() === 0) {
        return CommandResultFactory({ data: Nothing });
      }

      const requestHash = apduParser.extractFieldByLength(HASH_LENGTH);
      const requestR = apduParser.extractFieldByLength(SIGNATURE_R_LENGTH);
      const requestS = apduParser.extractFieldByLength(SIGNATURE_S_LENGTH);
      const readStateHash = apduParser.extractFieldByLength(HASH_LENGTH);
      const readStateR = apduParser.extractFieldByLength(SIGNATURE_R_LENGTH);
      const readStateS = apduParser.extractFieldByLength(SIGNATURE_S_LENGTH);

      if (
        requestHash === undefined ||
        requestR === undefined ||
        requestS === undefined ||
        readStateHash === undefined ||
        readStateR === undefined ||
        readStateS === undefined ||
        apduParser.getUnparsedRemainingLength() !== 0
      ) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is malformed"),
        });
      }

      return CommandResultFactory({
        data: Just({
          requestHash: apduParser.encodeToHexaString(requestHash),
          requestSignature: {
            r: apduParser.encodeToHexaString(requestR),
            s: apduParser.encodeToHexaString(requestS),
          },
          readStateHash: apduParser.encodeToHexaString(readStateHash),
          readStateSignature: {
            r: apduParser.encodeToHexaString(readStateR),
            s: apduParser.encodeToHexaString(readStateS),
          },
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
        "SignUpdateCallCommand: derivation path is required for 'init' phase.",
      );
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    if (paths.length !== DERIVATION_PATH_LENGTH) {
      throw new Error(
        `SignUpdateCallCommand: expected ${DERIVATION_PATH_LENGTH} path elements, got ${paths.length}`,
      );
    }

    this.apduBuilder.addBufferToData(encodeDerivationPath(paths));
    return this.apduBuilder.build();
  }

  private nextChunk(): Apdu {
    if (!this.args.transactionChunk) {
      throw new Error(
        "SignUpdateCallCommand: transaction chunk is required for 'add' and 'last' phases.",
      );
    }

    this.apduBuilder.addBufferToData(this.args.transactionChunk);
    return this.apduBuilder.build();
  }
}

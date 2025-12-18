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
} from "@ledgerhq/device-management-kit";
import {
  CommandErrorHelper,
  DerivationPathUtils,
} from "@ledgerhq/signer-utils";
import { Just, Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandErrorFactory,
  type CosmosAppErrorCodes,
} from "@internal/app-binder/command/utils/CosmosAppErrors";

export type SignPhase = "init" | "add" | "last";
export type SignFormat = "json" | "textual";
export type SignTransactionCommandResponse = Maybe<Signature>;
export type SignTransactionCommandArgs = {
  readonly phase: SignPhase;
  readonly format: SignFormat;
  readonly prefix: string;
  readonly derivationPath?: string;
  readonly serializedTransactionChunk?: Uint8Array;
};

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      CosmosAppErrorCodes
    >
{
  readonly name = "signTransaction";

  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    CosmosAppErrorCodes
  >(COSMOS_APP_ERRORS, CosmosAppCommandErrorFactory);

  args: SignTransactionCommandArgs;

  constructor(args: SignTransactionCommandArgs) {
    this.args = args;
  }

  private getP1FromPhase(phase: SignPhase): number {
    switch (phase) {
      case "init":
        return 0x00;
      case "add":
        return 0x01;
      case "last":
        return 0x02;
    }
  }

  getApdu(): Apdu {
    const { phase, derivationPath, prefix, serializedTransactionChunk } =
      this.args;

    const signArgs: ApduBuilderArgs = {
      cla: 0x55,
      ins: 0x02,
      p1: this.getP1FromPhase(phase),
      p2: 0x00, // JSON only (P2=0 per APDUSPEC)
    };

    const builder = new ApduBuilder(signArgs);

    if (phase === "init") {
      if (!derivationPath) {
        throw new Error(
          "SignTransactionCommand: derivationPath is required for phase 'init'",
        );
      }

      const path = DerivationPathUtils.splitPath(derivationPath);

      if (path.length !== 5) {
        throw new Error(
          `SignTransactionCommand: expected cosmos style number of path elements, got ${path.length}`,
        );
      }

      const view = new DataView(new ArrayBuffer(20));
      for (let i = 0; i < 5; i++) {
        const raw = path[i]! & 0x7fffffff;
        const hardened = i < 3 ? (0x80000000 | raw) >>> 0 : raw >>> 0;

        view.setUint32(i * 4, hardened, true);
      }
      builder.addBufferToData(new Uint8Array(view.buffer));

      if (prefix?.length === 0) {
        throw new Error(
          "SignTransactionCommand: prefix cannot be empty for 'init' phase",
        );
      }
      builder.add8BitUIntToData(prefix.length);
      builder.addAsciiStringToData(prefix);
    } else {
      if (
        !serializedTransactionChunk ||
        serializedTransactionChunk.length === 0
      ) {
        throw new Error(
          "SignTransactionCommand: serializedTransactionChunk is required for 'add' and 'last' phases",
        );
      }

      builder.addBufferToData(serializedTransactionChunk);
    }

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, CosmosAppErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const remaining = parser.getUnparsedRemainingLength();

      if (remaining === 0) {
        return CommandResultFactory({
          data: Nothing,
        });
      }

      const sigBytes = parser.extractFieldByLength(remaining);
      if (!sigBytes) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Signature is missing"),
        });
      }

      return CommandResultFactory({
        data: Just(sigBytes as Signature),
      });
    });
  }
}

import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import {
  type SignPhase,
  SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";

type CosmosSignDataTaskArgs = {
  readonly derivationPath: string;
  readonly prefix?: string;
  readonly serializedTransaction: Uint8Array; // canonical JSON bytes
};

export class CosmosSignDataTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: CosmosSignDataTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, CosmosAppErrorCodes>> {
    const { derivationPath, prefix, serializedTransaction } = this.args;

    // 1. Send init packet: path + HRP, no tx data
    const initResult = await this.api.sendCommand(
      new SignTransactionCommand({
        phase: "init",
        format: "json", // only json for now
        derivationPath,
        prefix,
      }),
    );

    if (!isSuccessCommandResult(initResult)) {
      return initResult as CommandResult<Signature, CosmosAppErrorCodes>;
    }

    // 2. If there is no data (shouldn't really happen), error out
    if (serializedTransaction.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Empty transaction"),
      });
    }

    // 3. Stream JSON bytes in APDU_MAX_PAYLOAD chunks
    const data = serializedTransaction;
    let lastSignature: Maybe<Signature> = Nothing;

    for (let offset = 0; offset < data.length; offset += APDU_MAX_PAYLOAD) {
      const isLast = offset + APDU_MAX_PAYLOAD >= data.length;
      const phase: SignPhase = isLast ? "last" : "add";
      const chunk = data.slice(offset, offset + APDU_MAX_PAYLOAD);

      const res = await this.api.sendCommand(
        new SignTransactionCommand({
          phase,
          format: "json",
          serializedTransactionChunk: chunk,
        }),
      );

      if (!isSuccessCommandResult(res)) {
        return res as CommandResult<Signature, CosmosAppErrorCodes>;
      }

      // Only the last chunk returns a signature (Maybe<Signature>)
      if (phase === "last") {
        if (res.data.isNothing()) {
          return CommandResultFactory({
            error: new InvalidStatusWordError("No signature returned"),
          });
        }
        lastSignature = res.data as Maybe<Signature>;
      }
    }

    if (lastSignature.isJust()) {
      return CommandResultFactory({
        data: lastSignature.extract() as Signature,
      });
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("No signature after all chunks"),
    });
  }
}

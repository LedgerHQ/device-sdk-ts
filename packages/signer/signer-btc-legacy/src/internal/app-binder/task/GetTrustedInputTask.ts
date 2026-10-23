import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type LegacyTransaction } from "@api/model/CreateTransactionArg";
import { type LegacyCoinProfile } from "@api/model/LegacyCoinProfile";
import { LegacyGetTrustedInputCommand } from "@internal/app-binder/command/GetTrustedInputCommand";
import { type TrustedInputSerializer } from "@internal/app-binder/task/format/TrustedInputSerializer";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";

export type GetTrustedInputTaskArgs = {
  readonly transaction: LegacyTransaction;
  readonly indexLookup: number;
};

export type GetTrustedInputTaskResult<ErrorCodes extends string> = DmkResult<
  Uint8Array,
  CommandErrorResult<ErrorCodes>["error"]
>;

/**
 * Streams a previous transaction to the app, which answers the trusted input
 * of one of its outputs after the last chunk.
 */
@injectable()
export class GetTrustedInputTask<ErrorCodes extends string> {
  constructor(
    @inject(btcLegacyTypes.Profile)
    private readonly profile: LegacyCoinProfile<ErrorCodes>,
    @inject(btcLegacyTypes.TrustedInputSerializer)
    private readonly serializer: TrustedInputSerializer,
  ) {}

  // Checks the previous transaction without the device.
  validate(transaction: LegacyTransaction): InvalidStatusWordError | undefined {
    const chunks = this.serialize(transaction);
    return chunks instanceof InvalidStatusWordError ? chunks : undefined;
  }

  async run(
    api: InternalApi,
    { transaction, indexLookup }: GetTrustedInputTaskArgs,
  ): Promise<GetTrustedInputTaskResult<ErrorCodes>> {
    const chunks = this.serialize(transaction);
    if (chunks instanceof InvalidStatusWordError) {
      return DmkResultFactory({ error: chunks });
    }

    let trustedInput: Uint8Array = new Uint8Array();
    for (const [index, data] of chunks.entries()) {
      const result = await api.sendCommand(
        new LegacyGetTrustedInputCommand(
          { data, indexLookup: index === 0 ? indexLookup : undefined },
          this.profile.errors,
        ),
      );
      if (!isSuccessCommandResult(result)) {
        return DmkResultFactory({ error: result.error });
      }
      trustedInput = result.data.data;
    }

    return DmkResultFactory({ data: trustedInput });
  }

  private serialize(
    transaction: LegacyTransaction,
  ): Uint8Array[] | InvalidStatusWordError {
    try {
      return this.serializer.serialize(transaction);
    } catch (error) {
      return new InvalidStatusWordError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

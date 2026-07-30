import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetShieldedAddressCommand } from "@internal/app-binder/command/GetShieldedAddressCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";

export type GetShieldedAddressTaskArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
};

export type GetShieldedAddressTaskResult = DmkResult<
  { readonly address: string },
  CommandErrorResult<ZcashErrorCodes>["error"]
>;

function deriveShieldedAddressPaths(
  derivationPath: string,
): { orchardDerivationPath: string; transparentDerivationPath: string } | { error: InvalidStatusWordError } {
  const normalized = derivationPath.startsWith("m/")
    ? derivationPath.slice(2)
    : derivationPath;
  const components = normalized.split("/");
  if (components.length !== 5) {
    return {
      error: new InvalidStatusWordError(
        `Shielded address derivation path must have exactly 5 levels purpose/coin/account/change/index (got "${derivationPath}")`,
      ),
    };
  }
  const [, coin, account] = components;
  return {
    orchardDerivationPath: `32'/${coin}/${account}`,
    transparentDerivationPath: normalized,
  };
}

export class GetShieldedAddressTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetShieldedAddressTaskArgs,
  ) {}

  async run(): Promise<GetShieldedAddressTaskResult> {
    const paths = deriveShieldedAddressPaths(this.args.derivationPath);
    if ("error" in paths) {
      return DmkResultFactory({ error: paths.error });
    }

    const result = await this.api.sendCommand(
      new GetShieldedAddressCommand({
        orchardDerivationPath: paths.orchardDerivationPath,
        transparentDerivationPath: paths.transparentDerivationPath,
        checkOnDevice: this.args.checkOnDevice,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return DmkResultFactory({ error: result.error });
    }

    return DmkResultFactory({ data: { address: result.data.address } });
  }
}

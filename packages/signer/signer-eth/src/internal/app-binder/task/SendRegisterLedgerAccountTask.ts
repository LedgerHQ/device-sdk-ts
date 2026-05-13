// M6 registration is a 2-APDU sequence:
//   1. RegisterLedgerAccountCommand (P1=0x11) — on-device approval, returns
//      a 32-byte HMAC proof.
//   2. GetAddressCommand (silent, chainId-framed) — derives and returns the
//      ETH address so the wallet can cache it next to the HMAC proof.
// Both APDUs are linear with no branching, so we expose them as a single
// task wrapped by CallTaskInAppDeviceAction in EthAppBinder, matching every
// other action in the package.
import {
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  type RegisterLedgerAccountArgs,
  type RegisterLedgerAccountResult,
} from "@api/model/RegisterLedgerAccountArgs";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

type SendRegisterLedgerAccountTaskArgs = RegisterLedgerAccountArgs & {
  readonly logger: LoggerPublisherService;
};

function stripHexPrefix(hex: string): string {
  return hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
}

export class SendRegisterLedgerAccountTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendRegisterLedgerAccountTaskArgs,
  ) {
    this._logger = _args.logger;
  }

  async run(): Promise<
    CommandResult<RegisterLedgerAccountResult, EthErrorCodes>
  > {
    this._logger.debug("[run] Starting SendRegisterLedgerAccountTask", {
      data: {
        name: this._args.name,
        chainId: this._args.chainId,
      },
    });

    const registerResult = await this._api.sendCommand(
      new RegisterLedgerAccountCommand({
        name: this._args.name,
        derivationPath: this._args.derivationPath,
        chainId: this._args.chainId,
      }),
    );
    if (!isSuccessCommandResult(registerResult)) {
      return registerResult;
    }

    const addressResult = await this._api.sendCommand(
      new GetAddressCommand({
        derivationPath: this._args.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
        chainId: this._args.chainId,
      }),
    );
    if (!isSuccessCommandResult(addressResult)) {
      return addressResult;
    }

    return DmkResultFactory({
      data: {
        hmacProofHex: registerResult.data.hmacProofHex,
        addressHex: stripHexPrefix(addressResult.data.address).toLowerCase(),
      },
    });
  }
}

import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  EthSignerActionType,
  EthSignerActionTypes,
} from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { SignerEthBuilder } from "@ledgerhq/device-signer-kit-ethereum";
import { VerifySafeAddressDAError } from "@ledgerhq/device-signer-kit-ethereum/api/app-binder/VerifySafeAddressDeviceActionTypes.js";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_CHAIN_ID = 1;

@injectable()
export class VerifySafeAddressEthSignerActionHandler extends BaseEthSignerActionHandler<
  void,
  VerifySafeAddressDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.VERIFY_SAFE_ADDRESS;
  readonly description = "Verify Safe address";

  constructor(
    @inject(appTypes.DMKInstance) dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState) appState: AppState,
  ) {
    super(dmkInstance, appState);
  }

  public supports(type: EthSignerActionType): boolean {
    return type === this.type;
  }

  protected async getObservable(): Promise<
    Observable<
      DeviceActionState<
        void,
        VerifySafeAddressDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.verifySafeAddress(
      params.safeContractAddress,
      {
        chainId: params.chainId,
        skipOpenApp: params.skipOpenApp,
      },
    );

    return observable;
  }

  protected displayOutput(_output: void): void {
    console.log(
      chalk.green("\nSafe address verification completed successfully!"),
    );
  }

  private async getInput(): Promise<{
    safeContractAddress: string;
    chainId: number;
    skipOpenApp: boolean;
  }> {
    const safeContractAddress = await input({
      message: "Safe contract address",
    });
    const chainIdStr = await input({
      message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    const chainId = chainIdStr.trim()
      ? parseInt(chainIdStr, 10)
      : DEFAULT_CHAIN_ID;

    return {
      safeContractAddress: safeContractAddress.trim(),
      chainId,
      skipOpenApp,
    };
  }
}

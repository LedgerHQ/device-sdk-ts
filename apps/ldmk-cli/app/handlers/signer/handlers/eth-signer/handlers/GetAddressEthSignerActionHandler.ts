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
import {
  GetAddressDAError,
  type GetAddressDAOutput,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";

@injectable()
export class GetAddressEthSignerActionHandler extends BaseEthSignerActionHandler<
  GetAddressDAOutput,
  GetAddressDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.GET_ADDRESS;
  readonly description = "Get Ethereum address";

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
        GetAddressDAOutput,
        GetAddressDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.getAddress(params.derivationPath, {
      checkOnDevice: params.checkOnDevice,
      returnChainCode: params.returnChainCode,
      skipOpenApp: params.skipOpenApp,
    });

    return observable;
  }

  protected displayOutput(output: GetAddressDAOutput): void {
    console.log(chalk.green("\nAddress retrieved successfully!"));
    console.log(chalk.grey(`  Address: ${output.address}`));
    console.log(chalk.grey(`  Public Key: ${output.publicKey}`));
    if (output.chainCode) {
      console.log(chalk.grey(`  Chain Code: ${output.chainCode}`));
    }
  }

  private async getInput(): Promise<{
    derivationPath: string;
    checkOnDevice: boolean;
    returnChainCode: boolean;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const checkOnDevice = await this.promptYesNo("Check on device", false);
    const returnChainCode = await this.promptYesNo("Return chain code", false);
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      checkOnDevice,
      returnChainCode,
      skipOpenApp,
    };
  }
}

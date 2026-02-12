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
  type Signature,
  SignerEthBuilder,
  SignPersonalMessageDAError,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_MESSAGE = "Hello World";

@injectable()
export class SignMessageEthSignerActionHandler extends BaseEthSignerActionHandler<
  Signature,
  SignPersonalMessageDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.SIGN_MESSAGE;
  readonly description = "Sign a personal message";

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
        Signature,
        SignPersonalMessageDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signMessage(
      params.derivationPath,
      params.message,
      { skipOpenApp: params.skipOpenApp },
    );

    return observable;
  }

  protected displayOutput(output: Signature): void {
    console.log(chalk.green("\nMessage signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private async getInput(): Promise<{
    derivationPath: string;
    message: string;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const message = await input({
      message: `Message (default: ${DEFAULT_MESSAGE})`,
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      message: message.trim() || DEFAULT_MESSAGE,
      skipOpenApp,
    };
  }
}

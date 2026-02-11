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
  SignTransactionDAError,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";

@injectable()
export class SignTransactionEthSignerActionHandler extends BaseEthSignerActionHandler<
  Signature,
  SignTransactionDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.SIGN_TRANSACTION;
  readonly description = "Sign a transaction";

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
        SignTransactionDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const transaction = this.hexStringToUint8Array(params.transactionHex);

    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signTransaction(
      params.derivationPath,
      transaction,
      {
        domain: params.recipientDomain,
        skipOpenApp: params.skipOpenApp,
      },
    );

    return observable;
  }

  protected displayOutput(output: Signature): void {
    console.log(chalk.green("\nTransaction signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private async getInput(): Promise<{
    derivationPath: string;
    transactionHex: string;
    recipientDomain: string | undefined;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const transactionHex = await input({
      message: "Transaction (hex encoded, e.g., 0x...)",
    });
    const recipientDomain = await input({
      message: "Recipient domain (optional)",
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      transactionHex,
      recipientDomain: recipientDomain.trim() || undefined,
      skipOpenApp,
    };
  }

  private hexStringToUint8Array(hex: string): Uint8Array {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (cleanHex.length === 0) {
      return new Uint8Array(0);
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return bytes;
  }
}

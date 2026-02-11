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
  SignDelegationAuthorizationDAError,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_CHAIN_ID = 1;

@injectable()
export class SignDelegationAuthorizationEthSignerActionHandler extends BaseEthSignerActionHandler<
  Signature,
  SignDelegationAuthorizationDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.SIGN_DELEGATION_AUTHORIZATION;
  readonly description = "Sign delegation authorization";

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
        SignDelegationAuthorizationDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signDelegationAuthorization(
      params.derivationPath,
      params.chainId,
      params.contractAddress,
      params.nonce,
    );

    return observable;
  }

  protected displayOutput(output: Signature): void {
    console.log(chalk.green("\nDelegation authorization signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private async getInput(): Promise<{
    derivationPath: string;
    nonce: number;
    contractAddress: string;
    chainId: number;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const nonceStr = await input({
      message: "Nonce (default: 0)",
    });
    const contractAddress = await input({
      message: "Contract address (default: 0x)",
    });
    const chainIdStr = await input({
      message: `Chain ID (default: ${DEFAULT_CHAIN_ID})`,
    });

    const nonce = nonceStr.trim() ? parseInt(nonceStr, 10) : 0;
    const chainId = chainIdStr.trim()
      ? parseInt(chainIdStr, 10)
      : DEFAULT_CHAIN_ID;

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      chainId,
      contractAddress: contractAddress.trim() || "0x",
      nonce,
    };
  }
}

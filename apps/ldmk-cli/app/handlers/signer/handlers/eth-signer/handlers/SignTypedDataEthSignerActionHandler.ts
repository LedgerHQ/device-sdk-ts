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
  SignTypedDataDAError,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseEthSignerActionHandler } from "./BaseEthSignerActionHandler";

const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";
const DEFAULT_TYPED_MESSAGE = `{"domain":{"name":"USD Coin","verifyingContract":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chainId":1,"version":"2"},"primaryType":"Permit","message":{"deadline":1718992051,"nonce":0,"spender":"0x111111125421ca6dc452d289314280a0f8842a65","owner":"0x6cbcd73cd8e8a42844662f0a0e76d7f79afd933d","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"},"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],"Permit":[{"name":"owner","type":"address"},{"name":"spender","type":"address"},{"name":"value","type":"uint256"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]}}`;

@injectable()
export class SignTypedDataEthSignerActionHandler extends BaseEthSignerActionHandler<
  Signature,
  SignTypedDataDAError,
  DeviceActionIntermediateValue
> {
  readonly type = EthSignerActionTypes.SIGN_TYPED_DATA;
  readonly description = "Sign typed data (EIP-712)";

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
        SignTypedDataDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const params = await this.getInput();
    const typedData: TypedData = JSON.parse(params.typedDataJson) as TypedData;

    const signer = new SignerEthBuilder({
      dmk: this.dmkInstance,
      sessionId: this.appState.getDeviceSessionId()!,
    }).build();

    const { observable } = signer.signTypedData(
      params.derivationPath,
      typedData,
      { skipOpenApp: params.skipOpenApp },
    );

    return observable;
  }

  protected displayOutput(output: Signature): void {
    console.log(chalk.green("\nTyped data signed successfully!"));
    console.log(chalk.grey(`  r: ${output.r}`));
    console.log(chalk.grey(`  s: ${output.s}`));
    console.log(chalk.grey(`  v: ${output.v}`));
  }

  private async getInput(): Promise<{
    derivationPath: string;
    typedDataJson: string;
    skipOpenApp: boolean;
  }> {
    const derivationPath = await input({
      message: `Derivation path (default: ${DEFAULT_DERIVATION_PATH})`,
    });
    const messageInput = await input({
      message: "Typed data JSON (default: sample EIP-712 Permit message)",
    });
    const skipOpenApp = await this.promptYesNo("Skip open app", false);

    const typedDataJson = messageInput.trim() || DEFAULT_TYPED_MESSAGE;

    try {
      JSON.parse(typedDataJson);
    } catch (e) {
      throw new Error(
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return {
      derivationPath: derivationPath.trim() || DEFAULT_DERIVATION_PATH,
      typedDataJson,
      skipOpenApp,
    };
  }
}

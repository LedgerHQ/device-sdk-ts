import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { EthSignerActionHandler } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionHandler";
import { EthSignerActionType } from "@ldmk/app/handlers/signer/handlers/eth-signer/handlers/EthSignerActionType";
import { SignerActionHandler } from "@ldmk/app/handlers/signer/handlers/SignerActionHandler";
import {
  SignerType,
  SignerTypes,
} from "@ldmk/app/handlers/signer/handlers/SignerType";
import { AppState } from "@ldmk/app/state/AppState";
import { inject, injectable, multiInject } from "inversify";

@injectable()
export class UseEthSignerActionHandler implements SignerActionHandler {
  readonly type = SignerTypes.ETH_SIGNER;
  readonly description = "Use an Ethereum Signer";

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @multiInject(appTypes.EthSignerActionHandler)
    private readonly ethSignerActionHandlers: EthSignerActionHandler[],
  ) {}

  public supports(type: SignerType): boolean {
    return type === this.type;
  }

  public async handle(): Promise<boolean> {
    await this.runActionLoop();
    return false;
  }

  private async runActionLoop(): Promise<void> {
    if (!this.appState.isConnected()) {
      console.log(
        chalk.red(
          "No devices connected! Please connect a Ledger device and try again.",
        ),
      );
      return;
    }
    while (true) {
      console.log("\n");
      const selection = await this.selectAction();
      if (selection === "cancel") {
        break;
      }
      const shouldExit = await this.executeAction(selection);
      if (shouldExit) {
        break;
      }
    }
  }

  private async selectAction(): Promise<EthSignerActionType | "cancel"> {
    const choices = this.ethSignerActionHandlers.map(
      (ethSignerActionHandler) => ({
        name: ethSignerActionHandler.description,
        value: ethSignerActionHandler.type,
      }),
    );

    return await select<EthSignerActionType | "cancel">({
      message: "Select an Ethereum Signer action:",
      choices: [...choices, { name: "Cancel", value: "cancel" }],
    });
  }

  private async executeAction(
    actionType: EthSignerActionType,
  ): Promise<boolean> {
    const handler = this.ethSignerActionHandlers.find((h) =>
      h.supports(actionType),
    );
    return handler ? await handler.handle() : false;
  }
}

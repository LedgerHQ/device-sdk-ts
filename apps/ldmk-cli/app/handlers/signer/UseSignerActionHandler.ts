import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { SignerActionHandler } from "@ldmk/app/handlers/signer/handlers/SignerActionHandler";
import { SignerType } from "@ldmk/app/handlers/signer/handlers/SignerType";
import { AppState } from "@ldmk/app/state/AppState";
import { inject, injectable, multiInject } from "inversify";

@injectable()
export class UseSignerActionHandler implements ActionHandler {
  readonly type = ActionTypes.USE_SIGNER;
  readonly description = "Use a signer";
  readonly connectionMode = ConnectionMode.CONNECTED;

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @multiInject(appTypes.SignerActionHandler)
    private readonly signerActionHandlers: SignerActionHandler[],
  ) {}

  public supports(action: ActionType): boolean {
    return action === this.type;
  }

  public async handle(): Promise<boolean> {
    if (!this.appState.isConnected()) {
      console.log(
        chalk.red(
          "No devices connected! Please connect a Ledger device and try again.",
        ),
      );
      return false;
    }
    const choice = await select({
      message: "Select a signer to use",
      choices: this.signerActionHandlers
        .map((signerAction) => ({
          name: signerAction.description,
          value: signerAction.type as string,
        }))
        .concat([{ name: "Cancel", value: "cancel" }]),
    });

    if (choice === "cancel") {
      return false;
    }

    const handler = this.signerActionHandlers.find((h) =>
      h.supports(choice as SignerType),
    );
    return handler ? await handler.handle() : false;
  }
}

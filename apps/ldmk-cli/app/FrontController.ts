import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType } from "@ldmk/app/handlers/ActionType";
import type { AppState } from "@ldmk/app/state/AppState";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, multiInject } from "inversify";

export class FrontController {
  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @multiInject(appTypes.ActionHandler)
    private readonly actionHandlers: ActionHandler[],
  ) {}

  public async run(): Promise<void> {
    this.listenToAvailableDevices();
    await this.waitForDevToolsToBeReady();
    this.sendWelcomeMessage();
    await this.runMainLoop();
    process.exit(0);
  }

  private listenToAvailableDevices(): void {
    const subscription = this.dmkInstance
      .listenToAvailableDevices({})
      .subscribe((devices) => {
        this.appState.updateDiscoveredDevices(devices);
      });
    this.appState.addSubscription(subscription);
  }

  private async waitForDevToolsToBeReady(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private sendWelcomeMessage(): void {
    console.log(
      chalk.green("\nWelcome to the Ledger Device Management Kit CLI!"),
    );
  }

  private async runMainLoop(): Promise<void> {
    while (true) {
      console.log("\n");
      const selection = await this.selectAction();
      const shouldExit = await this.executeAction(selection);
      if (shouldExit) {
        break;
      }
    }
  }

  private async selectAction(): Promise<ActionType> {
    return await select<ActionType>({
      message: "Which command would you like to run?",
      choices: this.actionHandlers
        .filter((action) =>
          this.appState.isConnected()
            ? action.connectionMode === ConnectionMode.CONNECTED ||
              action.connectionMode === ConnectionMode.BOTH
            : action.connectionMode === ConnectionMode.DISCONNECTED ||
              action.connectionMode === ConnectionMode.BOTH,
        )
        .map((action) => ({ name: action.description, value: action.type })),
    });
  }

  private async executeAction(selectedAction: ActionType): Promise<boolean> {
    const handler = this.actionHandlers.find((h) => h.supports(selectedAction));
    return handler ? await handler.handle() : false;
  }
}

import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { DeviceActionHandler } from "@ldmk/app/handlers/device-action/handlers/DeviceActionHandler";
import { DeviceActionType } from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { AppState } from "@ldmk/app/state/AppState";
import { inject, injectable, multiInject } from "inversify";

@injectable()
export class ExecuteDeviceActionActionHandler implements ActionHandler {
  readonly type = ActionTypes.EXECUTE_DEVICE_ACTION;
  readonly description = "Execute a device action";
  readonly connectionMode = ConnectionMode.CONNECTED;

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @multiInject(appTypes.DeviceActionHandler)
    private readonly deviceActionHandlers: DeviceActionHandler[],
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
    await this.runActionLoop();
    return false;
  }

  private async runActionLoop(): Promise<void> {
    while (true) {
      console.log("\n");
      const selection = await this.selectAction();
      if (selection === "cancel") {
        break;
      }
      const shouldExit = await this.executeAction(
        selection as DeviceActionType,
      );
      if (shouldExit) {
        break;
      }
    }
  }

  private async selectAction(): Promise<string> {
    return await select({
      message: "Select a device action to execute:",
      choices: this.deviceActionHandlers
        .map((deviceAction) => ({
          name: deviceAction.description,
          value: deviceAction.type as string,
        }))
        .concat([{ name: "Cancel", value: "cancel" }]),
    });
  }

  private async executeAction(actionType: DeviceActionType): Promise<boolean> {
    const handler = this.deviceActionHandlers.find((h) =>
      h.supports(actionType),
    );
    return handler ? await handler.handle() : false;
  }
}

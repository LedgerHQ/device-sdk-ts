import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { DeviceCommandHandler } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandHandler";
import { DeviceCommandType } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";
import { AppState } from "@ldmk/app/state/AppState";
import { inject, injectable, multiInject } from "inversify";

@injectable()
export class SendDeviceCommandActionHandler implements ActionHandler {
  readonly type = ActionTypes.SEND_COMMAND;
  readonly description = "Send a device command";
  readonly connectionMode = ConnectionMode.CONNECTED;

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @multiInject(appTypes.DeviceCommandHandler)
    private readonly deviceCommandHandlers: DeviceCommandHandler[],
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
    await this.runCommandLoop();
    return false;
  }

  private async runCommandLoop(): Promise<void> {
    while (true) {
      console.log("\n");
      const selection = await this.selectCommand();
      if (selection === "cancel") {
        break;
      }
      const shouldExit = await this.executeCommand(
        selection as DeviceCommandType,
      );
      if (shouldExit) {
        break;
      }
    }
  }

  private async selectCommand(): Promise<string> {
    return await select({
      message: "Select a command to send:",
      choices: this.deviceCommandHandlers
        .map((deviceCommand) => ({
          name: deviceCommand.description,
          value: deviceCommand.type as string,
        }))
        .concat([{ name: "Cancel", value: "cancel" }]),
    });
  }

  private async executeCommand(
    commandType: DeviceCommandType,
  ): Promise<boolean> {
    const handler = this.deviceCommandHandlers.find((h) =>
      h.supports(commandType),
    );
    return handler ? await handler.handle() : false;
  }
}

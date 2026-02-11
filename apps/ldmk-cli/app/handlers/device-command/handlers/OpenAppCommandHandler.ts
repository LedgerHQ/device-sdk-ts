import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import { DeviceCommandHandler } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandHandler";
import {
  DeviceCommandType,
  DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  DeviceManagementKit,
  isSuccessCommandResult,
  OpenAppCommand,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class OpenAppCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.OPEN_APP;
  readonly description = "Open an app";

  constructor(
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(type: DeviceCommandType): boolean {
    return type === this.type;
  }

  public async handle(): Promise<boolean> {
    try {
      const appName = await input({ message: "Enter app name to open:" });

      const result = await this.dmkInstance.sendCommand({
        sessionId: this.appState.getDeviceSessionId()!,
        command: new OpenAppCommand({ appName }),
      });

      if (!isSuccessCommandResult(result)) {
        console.log(chalk.red("Failed to open app"));
        console.log(
          chalk.red(
            result.error instanceof Error
              ? result.error.message
              : "Is your device connected/unlocked?",
          ),
        );
        return true;
      }

      console.log(chalk.green("App opened successfully!"));
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to open app"));
      console.log(
        chalk.red(
          error instanceof Error
            ? error.message
            : "Is your device connected/unlocked?",
        ),
      );
      return true;
    }
  }
}

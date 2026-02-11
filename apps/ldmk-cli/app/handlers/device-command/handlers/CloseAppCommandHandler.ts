import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import { DeviceCommandHandler } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandHandler";
import {
  DeviceCommandType,
  DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  CloseAppCommand,
  DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class CloseAppCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.CLOSE_APP;
  readonly description = "Close current app";

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
      await this.dmkInstance.sendCommand({
        sessionId: this.appState.getDeviceSessionId()!,
        command: new CloseAppCommand(),
      });
      console.log(chalk.green("App closed successfully!"));
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to close app"));
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

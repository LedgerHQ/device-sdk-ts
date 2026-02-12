import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import { DeviceCommandHandler } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandHandler";
import {
  DeviceCommandType,
  DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  DeviceManagementKit,
  GetAppAndVersionCommand as GetAppAndVersionCommand,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class GetAppAndVersionCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.GET_APP_AND_VERSION;
  readonly description = "Get the current app and version";

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
      const result = await this.dmkInstance.sendCommand({
        sessionId: this.appState.getDeviceSessionId()!,
        command: new GetAppAndVersionCommand(),
      });

      if (!isSuccessCommandResult(result)) {
        console.log(chalk.red("Failed to get app and version"));
        console.log(
          chalk.red(
            result.error instanceof Error
              ? result.error.message
              : "Is your device connected/unlocked?",
          ),
        );
        return true;
      }

      console.log(chalk.green("Current App Information:"));
      console.log(chalk.grey(`  App Name: ${result.data.name}`));
      console.log(chalk.grey(`  App Version: ${result.data.version}`));
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to get app and version"));
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

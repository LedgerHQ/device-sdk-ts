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
  GetOsVersionCommand,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class GetOsVersionCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.GET_OS_VERSION;
  readonly description = "Get the current OS version";

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
        command: new GetOsVersionCommand(),
      });

      if (!isSuccessCommandResult(result)) {
        console.log(chalk.red("Failed to get OS version"));
        console.log(
          chalk.red(
            result.error instanceof Error
              ? result.error.message
              : "Is your device connected/unlocked?",
          ),
        );
        return true;
      }

      console.log(chalk.green("OS Version Information:"));
      console.log(chalk.grey(`  Version: ${result.data.seVersion}`));
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to get OS version"));
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

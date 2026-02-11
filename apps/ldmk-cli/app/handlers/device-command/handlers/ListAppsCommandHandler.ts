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
  isSuccessCommandResult,
  ListAppsCommand,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class ListAppsCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.LIST_APPS;
  readonly description = "List installed apps";

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
      const allApps: Array<{ appName: string }> = [];
      let isContinue = false;

      while (true) {
        const result = await this.dmkInstance.sendCommand({
          sessionId: this.appState.getDeviceSessionId()!,
          command: new ListAppsCommand({ isContinue }),
        });

        if (!isSuccessCommandResult(result)) {
          console.log(chalk.red("Failed to list apps"));
          console.log(
            chalk.red(
              result.error instanceof Error
                ? result.error.message
                : "Is your device connected/unlocked?",
            ),
          );
          return true;
        }

        for (const app of result.data) {
          allApps.push({ appName: app.appName });
        }

        if (result.data.length === 0) {
          break;
        }
        isContinue = true;
      }

      console.log(chalk.green(`Installed Apps (${allApps.length}):`));
      if (allApps.length === 0) {
        console.log(chalk.grey("  No apps installed"));
      } else {
        for (const app of allApps) {
          console.log(chalk.grey(`  - ${app.appName}`));
        }
      }
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to list apps"));
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

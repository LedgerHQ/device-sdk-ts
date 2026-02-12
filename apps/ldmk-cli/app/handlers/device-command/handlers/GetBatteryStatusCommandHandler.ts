import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import { DeviceCommandHandler } from "@ldmk/app/handlers/device-command/handlers/DeviceCommandHandler";
import {
  DeviceCommandType,
  DeviceCommandTypes,
} from "@ldmk/app/handlers/device-command/handlers/DeviceCommandType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  BatteryStatusType,
  DeviceManagementKit,
  GetBatteryStatusCommand,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class GetBatteryStatusCommandHandler implements DeviceCommandHandler {
  readonly type = DeviceCommandTypes.GET_BATTERY_STATUS;
  readonly description = "Get battery status";

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
        command: new GetBatteryStatusCommand({
          statusType: BatteryStatusType.BATTERY_PERCENTAGE,
        }),
      });

      if (!isSuccessCommandResult(result)) {
        console.log(chalk.red("Failed to get battery status"));
        console.log(
          chalk.red(
            result.error instanceof Error
              ? result.error.message
              : "Is your device connected/unlocked?",
          ),
        );
        return true;
      }

      const percentage = typeof result.data === "number" ? result.data : -1;

      const color =
        percentage > 50
          ? chalk.green
          : percentage > 20
            ? chalk.yellow
            : chalk.red;

      console.log(chalk.green("Battery Status:"));
      console.log(color(`  Battery: ${percentage}%`));
      return false;
    } catch (error) {
      console.log(chalk.red("Failed to get battery status"));
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

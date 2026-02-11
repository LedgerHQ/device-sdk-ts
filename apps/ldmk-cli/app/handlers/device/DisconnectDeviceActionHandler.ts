import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { AppState } from "@ldmk/app/state/AppState";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class DisconnectDeviceActionHandler implements ActionHandler {
  readonly type = ActionTypes.DISCONNECT;
  readonly description = "Disconnect from the device";
  readonly connectionMode = ConnectionMode.CONNECTED;

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
    @inject(appTypes.DMKInstance)
    private readonly dmkInstance: DeviceManagementKit,
  ) {}

  public supports(action: ActionType): boolean {
    return action === this.type;
  }

  public async handle(): Promise<boolean> {
    await this.disconnectDevice();
    return false;
  }

  private async disconnectDevice(): Promise<void> {
    try {
      const sessionId = this.appState.getDeviceSessionId();
      if (!sessionId) {
        console.log(
          chalk.red(
            "No devices connected! Please connect a Ledger device and try again.",
          ),
        );
        return;
      }
      await this.dmkInstance.disconnect({ sessionId });
      this.appState.resetDeviceSessionId();
      console.log(chalk.green("Successfully disconnected!"));
    } catch (error) {
      console.log(chalk.red("Failed to disconnect from device"));
      console.log(
        chalk.red(
          error instanceof Error ? error.message : "Is your device connected?",
        ),
      );
    }
  }
}

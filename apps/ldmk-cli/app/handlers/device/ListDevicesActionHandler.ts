import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { AppState } from "@ldmk/app/state/AppState";
import { inject, injectable } from "inversify";

@injectable()
export class ListDevicesActionHandler implements ActionHandler {
  readonly type = ActionTypes.LIST_DEVICES;
  readonly description = "List available devices";
  readonly connectionMode = ConnectionMode.DISCONNECTED;

  constructor(
    @inject(appTypes.AppState)
    private readonly appState: AppState,
  ) {}

  public supports(action: ActionType): boolean {
    return action === this.type;
  }

  public handle(): Promise<boolean> {
    try {
      const devices = this.appState.getDiscoveredDevices();

      if (devices.length === 0) {
        console.log(
          chalk.gray(
            "No devices found! Please connect a Ledger device and try again.",
          ),
        );
        return Promise.resolve(false);
      }

      console.log(
        chalk.green(
          `Found ${devices.length} ${devices.length === 1 ? "device" : "devices"}:`,
        ),
      );
      console.log(
        chalk.gray(devices.map((device) => `  - ${device.name}`).join("\n")),
      );
    } catch (error) {
      console.log(chalk.red("Failed to list devices"));
      console.log(
        chalk.red(
          error instanceof Error ? error.message : "Is your device connected?",
        ),
      );
    }
    return Promise.resolve(false);
  }
}

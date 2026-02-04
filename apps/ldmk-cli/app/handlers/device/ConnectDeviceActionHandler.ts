import "zx/globals";

import { select } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  ActionHandler,
  ConnectionMode,
} from "@ldmk/app/handlers/ActionHandler";
import { ActionType, ActionTypes } from "@ldmk/app/handlers/ActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  DeviceManagementKit,
  DeviceStatus,
  DiscoveredDevice,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

@injectable()
export class ConnectDeviceActionHandler implements ActionHandler {
  readonly type = ActionTypes.CONNECT;
  readonly description = "Connect to a device";
  readonly connectionMode = ConnectionMode.DISCONNECTED;

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
    if (this.appState.getDiscoveredDevices().length === 0) {
      console.log(
        chalk.red(
          "No devices found! Please connect a Ledger device and try again.",
        ),
      );
      return false;
    }

    const selection = await this.selectDevice();
    if (selection === "cancel") {
      return false;
    }
    await this.connectDevice(selection);
    return false;
  }

  private async selectDevice(): Promise<DiscoveredDevice | "cancel"> {
    const choices = this.appState
      .getDiscoveredDevices()
      .map((device: DiscoveredDevice) => ({
        name: device.name ?? "Cancel",
        value: device,
      }));

    return await select<DiscoveredDevice | "cancel">({
      message: "Select a device",
      choices: [
        ...choices,
        { name: "Return to the main menu", value: "cancel" },
      ],
    });
  }

  private async connectDevice(device: DiscoveredDevice): Promise<void> {
    try {
      const sessionId = await this.dmkInstance.connect({ device });
      this.appState.setDeviceSessionId(sessionId);
      const subscription = this.dmkInstance
        .getDeviceSessionState({ sessionId })
        .subscribe((state) => {
          if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
            this.resetConnection();
          } else {
            this.appState.setDeviceStatus(state.deviceStatus);
          }
        });
      this.appState.addSubscription(subscription);
      console.log(chalk.green("Connected to device!"));
    } catch (error) {
      console.log(chalk.red("Failed to connect to device"));
      console.log(
        chalk.red(
          error instanceof Error ? error.message : "Is your device connected?",
        ),
      );
    }
  }

  private resetConnection(): void {
    this.appState.resetDeviceSessionId();
    this.appState.resetDeviceStatus();
  }
}

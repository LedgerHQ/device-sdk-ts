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
export class ExitActionHandler implements ActionHandler {
  readonly type = ActionTypes.EXIT;
  readonly description = "Exit the CLI";
  readonly connectionMode = ConnectionMode.BOTH;

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
    await this.disconnectIfConnected();
    this.resetAppState();
    console.log(chalk.green("Goodbye!\n"));
    return true;
  }

  private async disconnectIfConnected(): Promise<void> {
    if (this.appState.isConnected()) {
      await this.dmkInstance.disconnect({
        sessionId: this.appState.getDeviceSessionId()!,
      });
      this.appState.resetDeviceSessionId();
    }
  }

  private resetAppState(): void {
    this.appState.resetSubscriptions();
  }
}

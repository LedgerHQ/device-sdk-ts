import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import {
  DeviceActionType,
  DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  type GoToDashboardDAError,
  type GoToDashboardDAOutput,
  GoToDashboardDeviceAction,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseDeviceActionHandler } from "./BaseDeviceActionHandler";

@injectable()
export class GoToDashboardDeviceActionHandler extends BaseDeviceActionHandler<
  GoToDashboardDAOutput,
  GoToDashboardDAError,
  DeviceActionIntermediateValue
> {
  readonly type = DeviceActionTypes.GO_TO_DASHBOARD;
  readonly description = "Go to dashboard";

  constructor(
    @inject(appTypes.DMKInstance) dmkInstance: DeviceManagementKit,
    @inject(appTypes.AppState) appState: AppState,
  ) {
    super(dmkInstance, appState);
  }

  public supports(type: DeviceActionType): boolean {
    return type === this.type;
  }

  protected async getObservable(): Promise<
    Observable<
      DeviceActionState<
        GoToDashboardDAOutput,
        GoToDashboardDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new GoToDashboardDeviceAction({ input: {} }),
    });

    return Promise.resolve(observable);
  }

  protected displayOutput(_output: GoToDashboardDAOutput): void {
    console.log(chalk.green("\nSuccessfully returned to dashboard!"));
  }
}

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
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAOutput,
  GetDeviceStatusDeviceAction,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseDeviceActionHandler } from "./BaseDeviceActionHandler";

@injectable()
export class GetDeviceStatusDeviceActionHandler extends BaseDeviceActionHandler<
  GetDeviceStatusDAOutput,
  GetDeviceStatusDAError,
  DeviceActionIntermediateValue
> {
  readonly type = DeviceActionTypes.GET_DEVICE_STATUS;
  readonly description = "Get current app and version";

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
        GetDeviceStatusDAOutput,
        GetDeviceStatusDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new GetDeviceStatusDeviceAction({ input: {} }),
    });

    return Promise.resolve(observable);
  }

  protected displayOutput(output: GetDeviceStatusDAOutput): void {
    console.log(chalk.green("\nDevice status retrieved successfully!"));
    console.log(chalk.grey(`  Current app: ${output.currentApp}`));
    console.log(chalk.grey(`  App version: ${output.currentAppVersion}`));
  }
}

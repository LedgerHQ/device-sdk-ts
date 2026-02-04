import "zx/globals";

import { appTypes } from "@ldmk/app/di/app.types";
import {
  DeviceActionType,
  DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  DeviceActionIntermediateValue,
  type DeviceActionState,
  GetDeviceMetadataDAError,
  GetDeviceMetadataDAOutput,
  GetDeviceMetadataDeviceAction,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseDeviceActionHandler } from "./BaseDeviceActionHandler";

@injectable()
export class GetDeviceMetadataDeviceActionHandler extends BaseDeviceActionHandler<
  GetDeviceMetadataDAOutput,
  GetDeviceMetadataDAError,
  DeviceActionIntermediateValue
> {
  readonly type = DeviceActionTypes.GET_DEVICE_METADATA;
  readonly description = "Get device metadata (firmware, apps, updates)";

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
        GetDeviceMetadataDAOutput,
        GetDeviceMetadataDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new GetDeviceMetadataDeviceAction({ input: {} }),
    });

    return Promise.resolve(observable);
  }

  protected displayOutput(output: GetDeviceMetadataDAOutput): void {
    console.log(chalk.green("\nDevice metadata retrieved successfully!"));
    console.log(chalk.grey(`  Firmware version: ${output.firmwareVersion.os}`));
  }
}

import "zx/globals";

import { input } from "@inquirer/prompts";
import { appTypes } from "@ldmk/app/di/app.types";
import {
  DeviceActionType,
  DeviceActionTypes,
} from "@ldmk/app/handlers/device-action/handlers/DeviceActionType";
import { AppState } from "@ldmk/app/state/AppState";
import {
  type DeviceActionIntermediateValue,
  type DeviceActionState,
  type OpenAppDAError,
  type OpenAppDAOutput,
  OpenAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseDeviceActionHandler } from "./BaseDeviceActionHandler";

@injectable()
export class OpenAppDeviceActionHandler extends BaseDeviceActionHandler<
  OpenAppDAOutput,
  OpenAppDAError,
  DeviceActionIntermediateValue
> {
  readonly type = DeviceActionTypes.OPEN_APP;
  readonly description = "Open an application";

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
        OpenAppDAOutput,
        OpenAppDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const appName = await input({ message: "Enter the app name" });
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new OpenAppDeviceAction({
        input: { appName },
      }),
    });

    return observable;
  }

  protected displayOutput(_output: OpenAppDAOutput): void {
    console.log(chalk.green("\nApplication opened successfully!"));
  }
}

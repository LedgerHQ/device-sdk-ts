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
  type ListAppsDAError,
  type ListAppsDAOutput,
  ListAppsDeviceAction,
} from "@ledgerhq/device-management-kit";
import { DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Observable } from "rxjs";

import { BaseDeviceActionHandler } from "./BaseDeviceActionHandler";

@injectable()
export class ListAppsDeviceActionHandler extends BaseDeviceActionHandler<
  ListAppsDAOutput,
  ListAppsDAError,
  DeviceActionIntermediateValue
> {
  readonly type = DeviceActionTypes.LIST_APPS;
  readonly description = "List installed apps";

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
        ListAppsDAOutput,
        ListAppsDAError,
        DeviceActionIntermediateValue
      >
    >
  > {
    const { observable } = this.dmkInstance.executeDeviceAction({
      sessionId: this.appState.getDeviceSessionId()!,
      deviceAction: new ListAppsDeviceAction({ input: {} }),
    });

    return Promise.resolve(observable);
  }

  protected displayOutput(output: ListAppsDAOutput): void {
    console.log(chalk.green("\nInstalled apps:"));
    if (Array.isArray(output)) {
      output.forEach((app) => {
        console.log(chalk.grey(`  - ${app.appName}`));
      });
    }
  }
}

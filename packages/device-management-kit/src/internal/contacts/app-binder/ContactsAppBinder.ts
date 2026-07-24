import { inject, injectable } from "inversify";

import { type EditExternalAddressLabelDAReturnType } from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
import { type EditExternalAddressLabelArgs } from "@api/contacts/model/EditExternalAddressLabelArgs";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { CallTaskInAppDeviceAction } from "@api/device-action/os/CallTaskInAppDeviceAction/CallTaskInAppDeviceAction";
import { CallTaskOnDashboardDeviceAction } from "@api/device-action/os/CallTaskOnDashboardDeviceAction/CallTaskOnDashboardDeviceAction";
import { type DeviceSessionId } from "@api/device-session/types";
import { type DeviceManagementKit } from "@api/DeviceManagementKit";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { SendEditContactNameTask } from "@internal/contacts/app-binder/task/SendEditContactNameTask";
import { SendEditScopeTask } from "@internal/contacts/app-binder/task/SendEditScopeTask";
import { contactsExternalTypes } from "@internal/contacts/externalTypes";

// Edit External Address Label (Edit Scope) is still an Ethereum-app op — it
// carries a chain id + address the coin app must validate — so it dispatches
// via the open app's CLA (0xB0). Rename Contact, by contrast, is now the OS
// dashboard command E0 2E (see renameContact below).
const POLYFILL_APP_NAME = "Ethereum";

@injectable()
export class ContactsAppBinder {
  constructor(
    @inject(contactsExternalTypes.Dmk) private dmk: DeviceManagementKit,
    @inject(contactsExternalTypes.SessionId) private sessionId: DeviceSessionId,
    @inject(contactsExternalTypes.DmkLoggerFactory)
    private dmkLoggerFactory: (tag: string) => LoggerPublisherService,
  ) {}

  renameContact(args: RenameContactArgs): RenameContactDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendEditContactNameTask");
    // Rename is the blockchain-agnostic OS command E0 2E: close any running
    // app (GoToDashboard) then dispatch on the dashboard.
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskOnDashboardDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendEditContactNameTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
        },
        logger: this.dmkLoggerFactory("SendEditContactNameTask"),
      }),
    });
  }

  editExternalAddressLabel(
    args: EditExternalAddressLabelArgs,
  ): EditExternalAddressLabelDAReturnType {
    const taskLogger = this.dmkLoggerFactory("SendEditScopeTask");
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendEditScopeTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: POLYFILL_APP_NAME,
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: false,
        },
        logger: this.dmkLoggerFactory("SendEditScopeTask"),
      }),
    });
  }
}

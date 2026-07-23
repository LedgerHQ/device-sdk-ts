import { inject, injectable } from "inversify";

import { type EditExternalAddressLabelDAReturnType } from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
import { type EditExternalAddressLabelArgs } from "@api/contacts/model/EditExternalAddressLabelArgs";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";
import { UserInteractionRequired } from "@api/device-action/model/UserInteractionRequired";
import { CallTaskInAppDeviceAction } from "@api/device-action/os/CallTaskInAppDeviceAction/CallTaskInAppDeviceAction";
import { type DeviceSessionId } from "@api/device-session/types";
import { type DeviceManagementKit } from "@api/DeviceManagementKit";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { SendEditContactNameTask } from "@internal/contacts/app-binder/task/SendEditContactNameTask";
import { SendEditScopeTask } from "@internal/contacts/app-binder/task/SendEditScopeTask";
import { contactsExternalTypes } from "@internal/contacts/externalTypes";

// UPGRADE POINT — OS-dispatch.
// Today the Contacts DMK-core ops dispatch via the open ETH app's CLA
// (0xB0). When firmware OS-dispatch lands and these ops move to OS-level
// CLA, this constant goes away (the binder swaps to a direct send) and
// the ContactsService public API stays identical.
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
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new CallTaskInAppDeviceAction({
        input: {
          task: async (internalApi) =>
            new SendEditContactNameTask(internalApi, {
              ...args,
              logger: taskLogger,
            }).run(),
          appName: POLYFILL_APP_NAME,
          requiredUserInteraction: UserInteractionRequired.RegisterWallet,
          skipOpenApp: false,
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

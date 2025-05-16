import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { externalTypes } from "@internal/externalTypes";

import { GetVersionCommand } from "./command/GetVersionCommand";

@injectable()
export class LedgerKeyringProtocolBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId)
    private readonly sessionId: DeviceSessionId,
  ) {}

  getVersion(args: { skipOpenApp: boolean }): GetVersionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new SendCommandInAppDeviceAction({
        input: {
          command: new GetVersionCommand(),
          appName: "Ledger Sync",
          requiredUserInteraction: UserInteractionRequired.None,
          skipOpenApp: args.skipOpenApp,
        },
      }),
    });
  }

  getAppName(): unknown {
    throw new Error("Not implemented");
  }

  getSeedId(): unknown {
    throw new Error("Not implemented");
  }

  init(): unknown {
    throw new Error("Not implemented");
  }

  parseStream(): unknown {
    throw new Error("Not implemented");
  }

  signBlock(): unknown {
    throw new Error("Not implemented");
  }

  setTrustedMember(): unknown {
    throw new Error("Not implemented");
  }
}

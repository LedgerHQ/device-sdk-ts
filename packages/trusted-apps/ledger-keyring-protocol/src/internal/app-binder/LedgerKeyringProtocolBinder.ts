import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { JWT, Keypair, Permissions } from "@api/app-binder/LKRPTypes";
import { externalTypes } from "@internal/externalTypes";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";

import { GetVersionCommand } from "./command/GetVersionCommand";
import { AuthenticateDeviceAction } from "./device-action/AuthenticateDeviceAction";

@injectable()
export class LedgerKeyringProtocolBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,

    @inject(externalTypes.SessionId)
    private readonly sessionId: DeviceSessionId,

    @inject(lkrpDatasourceTypes.LKRPDataSource)
    private readonly lkrpDataSource: LKRPDataSource,
  ) {}

  authenticate(args: {
    keypair: Keypair;
    applicationId: number;
    clientName: string;
    permissions: Permissions;
    trustchainId?: string;
    jwt?: JWT;
  }): AuthenticateDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new AuthenticateDeviceAction({
        input: {
          lkrpDataSource: this.lkrpDataSource,
          applicationId: args.applicationId,
          clientName: args.clientName,
          permissions: args.permissions,
          keypair: args.keypair,
          trustchainId: args.trustchainId ?? null,
          jwt: args.jwt ?? null,
        },
      }),
    });
  }

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

import {
  DeviceManagementKit,
  type DeviceSessionId,
  InternalApi,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { Keypair, Permissions } from "@api/app-binder/LKRPTypes";
import { externalTypes } from "@internal/externalTypes";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";

import { GetVersionCommand } from "./command/GetVersionCommand";
import { AuthenticateDeviceAction } from "./device-action/AuthenticateDeviceAction";

@injectable()
export class LedgerKeyringProtocolBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,

    @inject(externalTypes.ApplicationId)
    private readonly applicationId: number,

    @inject(lkrpDatasourceTypes.LKRPDataSource)
    private readonly lkrpDataSource: LKRPDataSource,
  ) {}

  authenticateWithKeypair(args: {
    keypair: Keypair;
    clientName: string;
    permissions: Permissions;
    trustchainId: string;
  }): AuthenticateDAReturnType {
    return new AuthenticateDeviceAction({
      input: {
        lkrpDataSource: this.lkrpDataSource,
        applicationId: this.applicationId,
        clientName: args.clientName,
        permissions: args.permissions,
        keypair: args.keypair,
        trustchainId: args.trustchainId ?? null,
      },
    })._execute(
      {} as InternalApi, // TODO: Remove this parameter when the device actions are split
    );
  }

  authenticateWithDevice(args: {
    keypair: Keypair;
    clientName: string;
    permissions: Permissions;
    sessionId: DeviceSessionId;
  }): AuthenticateDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: args.sessionId,
      deviceAction: new AuthenticateDeviceAction({
        input: {
          lkrpDataSource: this.lkrpDataSource,
          applicationId: this.applicationId,
          clientName: args.clientName,
          permissions: args.permissions,
          keypair: args.keypair,
          trustchainId: null, // TODO remove this when the device action are split
        },
      }),
    });
  }

  getVersion(args: {
    skipOpenApp: boolean;
    sessionId: DeviceSessionId;
  }): GetVersionDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: args.sessionId,
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

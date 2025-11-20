import {
  DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type CryptoService } from "@api/crypto/CryptoService";
import { KeyPair } from "@api/crypto/KeyPair";
import { Permissions } from "@api/model/Permissions";
import { externalTypes } from "@internal/externalTypes";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { lkrpDatasourceTypes } from "@internal/lkrp-datasource/di/lkrpDatasourceTypes";

import { GetVersionCommand } from "./command/GetVersionCommand";
import { AuthenticateWithDeviceDeviceAction } from "./device-action/AuthenticateWithDeviceDeviceAction";
import { AuthenticateWithKeypairDeviceAction } from "./device-action/AuthenticateWithKeypairDeviceAction";

@injectable()
export class LedgerKeyringProtocolBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,

    @inject(externalTypes.ApplicationId)
    private readonly applicationId: number,

    @inject(externalTypes.CryptoService)
    private readonly cryptoService: CryptoService,

    @inject(lkrpDatasourceTypes.LKRPDataSource)
    private readonly lkrpDataSource: LKRPDataSource,
  ) {}

  authenticateWithKeypair(args: {
    keyPair: KeyPair;
    trustchainId: string;
  }): AuthenticateDAReturnType {
    return new AuthenticateWithKeypairDeviceAction({
      input: {
        lkrpDataSource: this.lkrpDataSource,
        appId: this.applicationId,
        cryptoService: this.cryptoService,
        keyPair: args.keyPair,
        trustchainId: args.trustchainId,
      },
    }).execute();
  }

  authenticateWithDevice(args: {
    keyPair: KeyPair;
    clientName: string;
    permissions: Permissions;
    sessionId: DeviceSessionId;
  }): AuthenticateDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: args.sessionId,
      deviceAction: new AuthenticateWithDeviceDeviceAction({
        input: {
          lkrpDataSource: this.lkrpDataSource,
          appId: this.applicationId,
          cryptoService: this.cryptoService,
          clientName: args.clientName,
          permissions: args.permissions,
          keyPair: args.keyPair,
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

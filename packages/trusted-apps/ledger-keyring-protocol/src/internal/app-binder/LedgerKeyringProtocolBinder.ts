import {
  DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { externalTypes } from "@internal/externalTypes";

@injectable()
export class LedgerKeyringProtocolBinder {
  constructor(
    @inject(externalTypes.Dmk) private readonly dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId)
    private readonly sessionId: DeviceSessionId,
  ) {}

  getVersion(): unknown {
    console.log(this.dmk);
    console.log(this.sessionId);
    throw new Error("Not implemented");
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

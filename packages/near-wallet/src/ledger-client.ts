import {
  BuiltinTransports,
  ConsoleLogger,
  DeviceActionStatus,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
} from "@ledgerhq/device-management-kit";
import {
  type SignerNear,
  SignerNearBuilder,
  type SignMessageTaskArgs,
  type SignTransactionTaskArgs,
} from "@ledgerhq/device-signer-kit-near";
import { type LoggerService } from "@near-wallet-selector/core/src/lib/services";
import { lastValueFrom } from "rxjs";

interface GetPublicKeyParams {
  derivationPath: string;
  checkOnDevice?: boolean;
}

export interface Subscription {
  remove: () => void;
}

const isConnectedTypeGuard = (sessionId: string | null): sessionId is string =>
  sessionId !== null;

// Not using TransportWebHID.isSupported as it's chosen to use a Promise...
export const isLedgerSupported = () => {
  return true;
};

export class LedgerClient {
  private dmk: DeviceManagementKit;
  private sessionId: string | null = null;
  private signer: SignerNear | null = null;

  constructor(logger: LoggerService) {
    this.dmk = new DeviceManagementKitBuilder()
      .addTransport(BuiltinTransports.USB)
      .addTransport(BuiltinTransports.BLE)
      .addLogger(new ConsoleLogger())
      .addLogger(logger)
      .build();
  }

  isConnected = () => {
    return (
      Boolean(this.signer) &&
      isConnectedTypeGuard(this.sessionId) &&
      Boolean(this.dmk.getConnectedDevice({ sessionId: this.sessionId }))
    );
  };

  connect = async () => {
    if (this.isConnected()) {
      return Promise.resolve();
    }
    const device = await lastValueFrom(
      // [COULD] use web-ble here
      this.dmk.startDiscovering({ transport: BuiltinTransports.USB }),
    );
    this.sessionId = await this.dmk.connect({ device });
    this.signer = new SignerNearBuilder({
      dmk: this.dmk,
      sessionId: this.sessionId,
    }).build();
  };

  disconnect = async () => {
    if (this.isConnected()) {
      await this.dmk.disconnect({ sessionId: this.sessionId! });
    }
  };

  getVersion = async () => {
    if (!this.signer) {
      throw new Error("Not connected");
    }
    const { observable } = this.signer.getVersion();
    const deviceActionState = await lastValueFrom(observable);
    if (deviceActionState.status === DeviceActionStatus.Completed) {
      return deviceActionState.output.version;
    } else if (deviceActionState.status === DeviceActionStatus.Error) {
      return Promise.reject(deviceActionState.error);
    }
    return "";
  };

  getPublicKey = async ({
    derivationPath,
    checkOnDevice = true,
  }: GetPublicKeyParams) => {
    if (!this.signer) {
      throw new Error("Not connected");
    }
    const { observable } = this.signer.getPublicKey({
      derivationPath,
      checkOnDevice,
    });
    const deviceActionState = await lastValueFrom(observable);
    if (deviceActionState.status === DeviceActionStatus.Completed) {
      return deviceActionState.output;
    } else if (deviceActionState.status === DeviceActionStatus.Error) {
      throw deviceActionState.error;
    } else if (deviceActionState.status === DeviceActionStatus.Stopped) {
      throw new Error("Action cancelled");
    }
    return "";
  };

  signMessage = async (args: SignMessageTaskArgs) => {
    if (!this.signer) {
      throw new Error("Not connected");
    }
    const { observable } = this.signer.signMessage(args);
    const deviceActionState = await lastValueFrom(observable);
    if (deviceActionState.status === DeviceActionStatus.Completed) {
      return deviceActionState.output;
    } else if (deviceActionState.status === DeviceActionStatus.Error) {
      throw deviceActionState.error;
    }
    throw new Error("Invalid data or derivation path");
  };

  signTransaction = async (args: SignTransactionTaskArgs) => {
    if (!this.signer) {
      throw new Error("Not connected");
    }
    const { observable } = this.signer.signTransaction(args);
    const deviceActionState = await lastValueFrom(observable);
    if (deviceActionState.status === DeviceActionStatus.Completed) {
      return deviceActionState.output;
    } else if (deviceActionState.status === DeviceActionStatus.Error) {
      throw deviceActionState.error;
    }
    throw new Error("Invalid data or derivation path");
  };
}

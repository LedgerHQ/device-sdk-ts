import { Container } from "inversify";
import { Observable } from "rxjs";

import { commandTypes } from "@api/command/di/commandTypes";
import {
  SendCommandUseCase,
  SendCommandUseCaseArgs,
} from "@api/command/use-case/SendCommandUseCase";
import { SessionDeviceState } from "@api/session/SessionDeviceState";
import { SessionId } from "@api/session/types";
import { ConnectedDevice } from "@api/usb/model/ConnectedDevice";
import { configTypes } from "@internal/config/di/configTypes";
import { GetSdkVersionUseCase } from "@internal/config/use-case/GetSdkVersionUseCase";
import { deviceSessionTypes } from "@internal/device-session/di/deviceSessionTypes";
import { ApduResponse } from "@internal/device-session/model/ApduResponse";
import { GetSessionDeviceStateUseCase } from "@internal/device-session/use-case/GetSessionDeviceStateUseCase";
import { discoveryTypes } from "@internal/discovery/di/discoveryTypes";
import {
  ConnectUseCase,
  ConnectUseCaseArgs,
} from "@internal/discovery/use-case/ConnectUseCase";
import {
  DisconnectUseCase,
  DisconnectUseCaseArgs,
} from "@internal/discovery/use-case/DisconnectUseCase";
import type { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import type { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { sendTypes } from "@internal/send/di/sendTypes";
import {
  SendApduUseCase,
  SendApduUseCaseArgs,
} from "@internal/send/use-case/SendApduUseCase";
import { usbDiTypes } from "@internal/usb/di/usbDiTypes";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
import {
  GetConnectedDeviceUseCase,
  GetConnectedDeviceUseCaseArgs,
} from "@internal/usb/use-case/GetConnectedDeviceUseCase";
import { makeContainer, MakeContainerProps } from "@root/src/di";

export class DeviceSdk {
  container: Container;
  /** @internal */
  constructor({ stub, loggers }: Partial<MakeContainerProps> = {}) {
    // NOTE: MakeContainerProps might not be the exact type here
    // For the init of the project this is sufficient, but we might need to
    // update the constructor arguments as we go (we might have more than just the container config)
    this.container = makeContainer({ stub, loggers });
  }

  getVersion(): Promise<string> {
    return this.container
      .get<GetSdkVersionUseCase>(configTypes.GetSdkVersionUseCase)
      .getSdkVersion();
  }

  startDiscovering(): Observable<DiscoveredDevice> {
    return this.container
      .get<StartDiscoveringUseCase>(discoveryTypes.StartDiscoveringUseCase)
      .execute();
  }

  stopDiscovering() {
    return this.container
      .get<StopDiscoveringUseCase>(discoveryTypes.StopDiscoveringUseCase)
      .execute();
  }

  connect(args: ConnectUseCaseArgs): Promise<SessionId> {
    return this.container
      .get<ConnectUseCase>(discoveryTypes.ConnectUseCase)
      .execute(args);
  }

  disconnect(args: DisconnectUseCaseArgs): Promise<void> {
    return this.container
      .get<DisconnectUseCase>(discoveryTypes.DisconnectUseCase)
      .execute(args);
  }

  sendApdu(args: SendApduUseCaseArgs): Promise<ApduResponse> {
    return this.container
      .get<SendApduUseCase>(sendTypes.SendApduUseCase)
      .execute(args);
  }

  sendCommand<Params, T>(args: SendCommandUseCaseArgs<Params, T>): Promise<T> {
    return this.container
      .get<SendCommandUseCase>(commandTypes.SendCommandUseCase)
      .execute(args);
  }

  getConnectedDevice(args: GetConnectedDeviceUseCaseArgs): ConnectedDevice {
    return this.container
      .get<GetConnectedDeviceUseCase>(usbDiTypes.GetConnectedDeviceUseCase)
      .execute(args);
  }

  getSessionDeviceState(args: {
    sessionId: SessionId;
  }): Observable<SessionDeviceState> {
    return this.container
      .get<GetSessionDeviceStateUseCase>(
        deviceSessionTypes.GetSessionDeviceStateUseCase,
      )
      .execute(args);
  }
}

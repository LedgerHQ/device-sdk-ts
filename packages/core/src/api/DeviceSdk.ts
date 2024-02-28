import { Container } from "inversify";
import { Observable } from "rxjs";

import { configTypes } from "@internal/config/di/configTypes";
import { GetSdkVersionUseCase } from "@internal/config/use-case/GetSdkVersionUseCase";
import { discoveryTypes } from "@internal/discovery/di/discoveryTypes";
import {
  ConnectUseCase,
  ConnectUseCaseArgs,
} from "@internal/discovery/use-case/ConnectUseCase";
import type { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import type { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";
import { sendTypes } from "@internal/send/di/sendTypes";
import {
  SendApduUseCase,
  SendApduUseCaseArgs,
} from "@internal/send/usecase/SendApduUseCase";
import { DiscoveredDevice } from "@internal/usb/model/DiscoveredDevice";
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

  startScan() {
    return;
  }

  stopScan() {
    return;
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

  connect(args: ConnectUseCaseArgs) {
    return this.container
      .get<ConnectUseCase>(discoveryTypes.ConnectUseCase)
      .execute(args);
  }

  sendApdu(args: SendApduUseCaseArgs) {
    return this.container
      .get<SendApduUseCase>(sendTypes.SendService)
      .execute(args);
  }
}

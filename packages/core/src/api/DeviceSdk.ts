import { Container } from "inversify";
import { Observable } from "rxjs";

import { types as ConfigTypes } from "@internal/config/di/configTypes";
import { GetSdkVersionUseCase } from "@internal/config/usecase/GetSdkVersionUseCase";
import { discoveryDiTypes } from "@internal/discovery/di/discoveryDiTypes";
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
      .get<GetSdkVersionUseCase>(ConfigTypes.GetSdkVersionUseCase)
      .getSdkVersion();
  }

  startDiscovering(): Observable<DiscoveredDevice> {
    return this.container
      .get<StartDiscoveringUseCase>(discoveryDiTypes.StartDiscoveringUseCase)
      .execute();
  }

  stopDiscovering() {
    return this.container
      .get<StopDiscoveringUseCase>(discoveryDiTypes.StopDiscoveringUseCase)
      .execute();
  }

  connect(args: ConnectUseCaseArgs) {
    return this.container
      .get<ConnectUseCase>(discoveryDiTypes.ConnectUseCase)
      .execute(args);
  }

  sendApdu(args: SendApduUseCaseArgs) {
    return this.container
      .get<SendApduUseCase>(sendTypes.SendService)
      .execute(args);
  }
}

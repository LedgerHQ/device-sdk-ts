import { Container } from "inversify";
import { GetSdkVersionUseCase } from "@internal/config/usecase/GetSdkVersionUseCase";
import { MakeContainerProps, makeContainer } from "../di";

export class DeviceSdk {
  container: Container;
  /** @internal */
  constructor({ stub }: MakeContainerProps) {
    // NOTE: NakeContainerProps might not be the exact type here
    // For the init of the project this is sufficient, but we might need to
    // update the constructor arguments as we go (we might have more than just the container config)
    this.container = makeContainer({ stub });
  }

  startScan() {
    return;
  }

  stopScan() {
    return;
  }

  getVersion() {
    return this.container
      .get<GetSdkVersionUseCase>("GetSdkVersionUseCase")
      .getSdkVersion();
  }
}

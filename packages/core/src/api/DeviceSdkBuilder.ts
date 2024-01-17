import { DeviceSdk } from "./DeviceSdk";

export class LedgerDeviceSdkBuilder {
  constructor() {
    console.log("New build");
  }

  build(): DeviceSdk {
    return new DeviceSdk();
  }
}

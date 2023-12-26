import { DeviceSdk } from "./DeviceSdk";

export class LedgerDeviceSdkBuilder {
  //props
  constructor() {
    console.log("New build");
  }

  build(): DeviceSdk {
    return new DeviceSdk();
  }
}

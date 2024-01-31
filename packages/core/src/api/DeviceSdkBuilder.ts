import { DeviceSdk } from "./DeviceSdk";

export class LedgerDeviceSdkBuilder {
  stub = false;
  constructor() {
    console.log("New build");
  }

  build(): DeviceSdk {
    return new DeviceSdk({ stub: this.stub });
  }

  setStub(stubbed = true): LedgerDeviceSdkBuilder {
    this.stub = stubbed;
    return this;
  }
}

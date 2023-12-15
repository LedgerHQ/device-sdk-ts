import {DeviceSdk} from "./DeviceSdk"

export class LedgerDeviceSdkBuilder {

    //props
    constructor() {
    }

    build(): DeviceSdk {
        return new DeviceSdk()
    }
}
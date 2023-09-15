import DeviceSdk from "./DeviceSdk"

export default class LedgerDeviceSdkBuilder {

    //props
    constructor() {
    }

    build(): DeviceSdk {
        return new DeviceSdk()
    }
}
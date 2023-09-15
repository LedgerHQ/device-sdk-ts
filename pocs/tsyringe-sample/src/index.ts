import { DeviceSdkBuilder, DeviceSdk} from "./api/apiModule"

export default DeviceSdkBuilder

let builder = new DeviceSdkBuilder()
let sdk = new DeviceSdk()

sdk.scan()

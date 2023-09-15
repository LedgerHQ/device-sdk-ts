import { Transport } from "../Transport"
import { Response } from "../model/Response"


export default class BleTransport implements Transport {
    send(apduHex: String): Response| undefined {
        return undefined
    }
}

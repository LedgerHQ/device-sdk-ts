import {Response} from "./model/Response"
import { bletransport } from "./ble/bleModule"


export interface Transport {
    send(apduHex: String): Response | undefined;
}
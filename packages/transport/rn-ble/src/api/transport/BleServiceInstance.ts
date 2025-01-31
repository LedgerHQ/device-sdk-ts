import { BleManager } from "react-native-ble-plx";

// create your own singleton class
class BLEServiceInstance {
  manager: BleManager;

  constructor() {
    this.manager = new BleManager();
  }
}

export const BLEService = new BLEServiceInstance();

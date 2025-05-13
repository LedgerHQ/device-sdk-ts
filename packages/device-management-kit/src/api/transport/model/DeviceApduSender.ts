import { type SendApduFnType } from "./DeviceConnection";

/**
 * DeviceConnection is a generic interface that represents a connection to a device.
 * It is used to send APDUs to the device.
 *
 * @template Dependencies the object containing all the logic necessary to
 * implement sendApdu. For instance HIDDevice or onWrite on RN BLE.
 *
 */
export interface DeviceApduSender<Dependencies> {
  sendApdu: SendApduFnType;
  getDependencies: () => Dependencies;
  setDependencies: (dependencies: Dependencies) => void;
  closeConnection: () => void;
  setupConnection: () => Promise<void>;
}

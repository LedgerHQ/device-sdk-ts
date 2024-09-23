const bleDeviceWithoutGatt: BluetoothDevice = {
  name: "Ledger Nano X",
  id: "42",
  forget: jest.fn(),
  watchAdvertisements: jest.fn(),
  dispatchEvent: jest.fn(),
  watchingAdvertisements: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onadvertisementreceived: jest.fn(),
  ongattserverdisconnected: jest.fn(),
  oncharacteristicvaluechanged: jest.fn(),
  onserviceadded: jest.fn(),
  onservicechanged: jest.fn(),
  onserviceremoved: jest.fn(),
};

const bluetoothGattPrimaryService: BluetoothRemoteGATTService = {
  device: bleDeviceWithoutGatt,
  uuid: "13d63400-2c97-0004-0000-4c6564676572",
  isPrimary: true,
  getCharacteristic: jest.fn(() =>
    Promise.resolve(bleCharacteristicStubBuilder()),
  ),
  getCharacteristics: jest.fn(),
  getIncludedService: jest.fn(),
  getIncludedServices: jest.fn(),
  addEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  removeEventListener: jest.fn(),
  oncharacteristicvaluechanged: jest.fn(),
  onserviceadded: jest.fn(),
  onservicechanged: jest.fn(),
  onserviceremoved: jest.fn(),
};

export const bleCharacteristicStubBuilder = (
  props: Partial<BluetoothRemoteGATTCharacteristic> = {},
): BluetoothRemoteGATTCharacteristic =>
  ({
    ...props,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    startNotifications: jest.fn(),
    writeValueWithResponse: jest.fn(),
  }) as BluetoothRemoteGATTCharacteristic;

export const bleDeviceStubBuilder = (
  props: Partial<BluetoothDevice> = {},
): BluetoothDevice => ({
  ...bleDeviceWithoutGatt,
  gatt: {
    device: bleDeviceWithoutGatt,
    connected: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
    getPrimaryService: jest.fn(),
    getPrimaryServices: jest.fn(() =>
      Promise.resolve([bluetoothGattPrimaryService]),
    ),
  },
  ...props,
});

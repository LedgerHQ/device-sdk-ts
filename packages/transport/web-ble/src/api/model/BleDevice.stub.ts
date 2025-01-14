const bleDeviceWithoutGatt: BluetoothDevice = {
  name: "Ledger Nano X",
  id: "42",
  forget: vi.fn(),
  watchAdvertisements: vi.fn(),
  dispatchEvent: vi.fn(),
  watchingAdvertisements: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  onadvertisementreceived: vi.fn(),
  ongattserverdisconnected: vi.fn(),
  oncharacteristicvaluechanged: vi.fn(),
  onserviceadded: vi.fn(),
  onservicechanged: vi.fn(),
  onserviceremoved: vi.fn(),
};

const bluetoothGattPrimaryService: BluetoothRemoteGATTService = {
  device: bleDeviceWithoutGatt,
  uuid: "13d63400-2c97-0004-0000-4c6564676572",
  isPrimary: true,
  getCharacteristic: vi.fn(() =>
    Promise.resolve(bleCharacteristicStubBuilder()),
  ),
  getCharacteristics: vi.fn(),
  getIncludedService: vi.fn(),
  getIncludedServices: vi.fn(),
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  removeEventListener: vi.fn(),
  oncharacteristicvaluechanged: vi.fn(),
  onserviceadded: vi.fn(),
  onservicechanged: vi.fn(),
  onserviceremoved: vi.fn(),
};

export const bleCharacteristicStubBuilder = (
  props: Partial<BluetoothRemoteGATTCharacteristic> = {},
): BluetoothRemoteGATTCharacteristic =>
  ({
    ...props,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    startNotifications: vi.fn(),
    writeValueWithResponse: vi.fn(),
    writeValueWithoutResponse: vi.fn(),
  }) as BluetoothRemoteGATTCharacteristic;

export const bleDeviceStubBuilder = (
  props: Partial<BluetoothDevice> = {},
): BluetoothDevice => ({
  ...bleDeviceWithoutGatt,
  gatt: {
    device: bleDeviceWithoutGatt,
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn(),
    getPrimaryServices: vi.fn(() =>
      Promise.resolve([bluetoothGattPrimaryService]),
    ),
  },
  ...props,
});

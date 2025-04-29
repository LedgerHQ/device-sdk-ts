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

export const bleCharacteristicStubBuilder = (
  props: Partial<BluetoothRemoteGATTCharacteristic> = {},
): BluetoothRemoteGATTCharacteristic => {
  const defaultService =
    props.service ??
    ({
      uuid: props.uuid ?? "00000000-0000-0000-0000-000000000000",
      device: {
        gatt: {
          connected: true,
          connect: () => Promise.resolve(),
          disconnect: () => {},
          getPrimaryService: () => Promise.resolve(null),
          getPrimaryServices: () =>
            Promise.resolve([] as BluetoothRemoteGATTService[]),
        },
      },
      isPrimary: true,
      getCharacteristic: vi.fn(),
      getCharacteristics: vi.fn(),
      getIncludedService: vi.fn(),
      getIncludedServices: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      oncharacteristicvaluechanged: vi.fn(),
      onserviceadded: vi.fn(),
      onservicechanged: vi.fn(),
      onserviceremoved: vi.fn(),
      getPrimaryService: vi.fn(),
    } as unknown as BluetoothRemoteGATTService);

  const uuid = props.uuid ?? defaultService.uuid;

  return {
    service: defaultService,
    uuid,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    startNotifications: vi.fn(),
    writeValueWithResponse: vi.fn(),
    writeValueWithoutResponse: vi.fn(),
    ...props,
  } as BluetoothRemoteGATTCharacteristic;
};

export const bleDeviceStubBuilder = (
  props: Partial<BluetoothDevice> = {},
): BluetoothDevice => {
  const deviceStub = {
    ...bleDeviceWithoutGatt,
    ...props,
  } as BluetoothDevice & { gatt: BluetoothRemoteGATTServer };

  const primaryService = {
    device: deviceStub,
    uuid: "13d63400-2c97-0004-0000-4c6564676572",
    isPrimary: true,
    getCharacteristic: vi.fn(() =>
      Promise.resolve(
        bleCharacteristicStubBuilder({ service: primaryService }),
      ),
    ),
    getCharacteristics: vi.fn(() =>
      Promise.resolve([
        bleCharacteristicStubBuilder({ service: primaryService }),
      ]),
    ),
    getIncludedService: vi.fn(),
    getIncludedServices: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    oncharacteristicvaluechanged: vi.fn(),
    onserviceadded: vi.fn(),
    onservicechanged: vi.fn(),
    onserviceremoved: vi.fn(),
    getPrimaryService: vi.fn(() => Promise.resolve(primaryService)),
  } as BluetoothRemoteGATTService;
  deviceStub.gatt = {
    device: deviceStub,
    connected: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn(() => Promise.resolve(primaryService)),
    getPrimaryServices: vi.fn(() => Promise.resolve([primaryService])),
  } as BluetoothRemoteGATTServer;

  return deviceStub;
};

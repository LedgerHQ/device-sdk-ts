export class DeviceConnectionFactoryStub {
  constructor() {}

  create = vi.fn().mockImplementation(() => ({
    sendApdu: vi.fn(),
  }));
}

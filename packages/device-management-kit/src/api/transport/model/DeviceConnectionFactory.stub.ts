export class DeviceConnectionFactoryStub {
  constructor() {}

  create = jest.fn().mockImplementation(() => ({
    sendApdu: jest.fn(),
  }));
}

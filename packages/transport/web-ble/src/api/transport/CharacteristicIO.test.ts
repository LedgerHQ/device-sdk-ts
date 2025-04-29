import { CharacteristicIO } from "./CharacteristicIO";

type StubCharacteristic = Partial<BluetoothRemoteGATTCharacteristic> & {
  service?: { device: { gatt?: { connect: () => Promise<void> } } };
};

describe("CharacteristicIO", () => {
  let writeChar: StubCharacteristic;
  let notifyChar: StubCharacteristic;
  let io: CharacteristicIO;

  beforeEach(() => {
    writeChar = {
      writeValueWithoutResponse: vi.fn().mockResolvedValue(undefined),
    };
    notifyChar = {
      oncharacteristicvaluechanged: undefined,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      startNotifications: vi.fn().mockResolvedValue(undefined),
      service: {
        // @ts-expect-error not typing the whole object
        device: { gatt: { connect: vi.fn().mockResolvedValue(undefined) } },
      },
    };
    io = new CharacteristicIO(
      writeChar as BluetoothRemoteGATTCharacteristic,
      notifyChar as BluetoothRemoteGATTCharacteristic,
    );
  });

  it("writeValue calls writeValueWithoutResponse on write characteristic", async () => {
    const buffer = new ArrayBuffer(4);
    await io.writeValue(buffer);
    expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledWith(buffer);
  });

  it("onValueChanged sets handler and attaches listener", () => {
    const handler = vi.fn();

    io.onValueChanged(handler);

    expect(notifyChar.oncharacteristicvaluechanged).toBe(handler);
    expect(notifyChar.addEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      handler,
    );

    const handler2 = vi.fn();
    io.onValueChanged(handler2);
    expect(notifyChar.removeEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      handler,
    );
    expect(notifyChar.oncharacteristicvaluechanged).toBe(handler2);
    expect(notifyChar.addEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      handler2,
    );
  });

  it("offValueChanged removes listener when handler exists", () => {
    const handler = vi.fn();
    io.onValueChanged(handler);
    io.offValueChanged();

    expect(notifyChar.removeEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      handler,
    );
  });

  it("notify setter replaces notify characteristic and clears any existing handler", () => {
    const handler = vi.fn();
    io.onValueChanged(handler);

    const newNotify: StubCharacteristic = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      oncharacteristicvaluechanged: undefined,
    };
    io.notify = newNotify as BluetoothRemoteGATTCharacteristic;

    expect(newNotify.oncharacteristicvaluechanged).toBeUndefined();
    expect(newNotify.addEventListener).not.toHaveBeenCalled();
    expect(io.notify).toBe(newNotify);
  });

  it("notify getter returns current notify characteristic", () => {
    expect(io.notify).toBe(notifyChar);
  });

  it("startNotifications calls startNotifications on notify characteristic", async () => {
    await io.startNotifications();
    expect(notifyChar.startNotifications).toHaveBeenCalled();
  });

  it("startNotifications reconnects and retries on failure", async () => {
    const error = new Error("fail");

    const startSpy = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    notifyChar.startNotifications = startSpy;
    const connectSpy = notifyChar.service!.device.gatt!.connect;

    await io.startNotifications();

    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(connectSpy).toHaveBeenCalled();
  });
});

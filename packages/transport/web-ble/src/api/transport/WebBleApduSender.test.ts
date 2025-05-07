/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Maybe, Right } from "purify-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebBleApduSender } from "./WebBleApduSender";

type EventListener = (event: Event) => void;
class LoggerStub implements LoggerPublisherService {
  subscribers: any[] = [];
  tag: string;
  constructor(subs: any[], tag: string) {
    this.subscribers = subs;
    this.tag = tag;
  }
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

function makeCharacteristic() {
  const disconnect = vi.fn();
  const stopNotifications = vi.fn().mockResolvedValue(undefined);
  return {
    service: { device: { gatt: { connected: true, disconnect } } },
    uuid: "mock-uuid",
    properties: {
      broadcast: false,
      read: false,
      writeWithoutResponse: false,
      write: false,
      notify: false,
      indicate: false,
      authenticatedSignedWrites: false,
      reliableWrite: false,
      writableAuxiliaries: false,
    },
    getDescriptor: vi.fn().mockResolvedValue(undefined),
    getDescriptors: vi.fn().mockResolvedValue([]),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    stopNotifications,
    writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
    writeValueWithoutResponse: vi.fn().mockResolvedValue(undefined),
    readValue: vi.fn().mockResolvedValue(new DataView(new ArrayBuffer(0))),
    writeValue: vi.fn().mockResolvedValue(undefined),
    dispatchEvent: vi.fn(),
    oncharacteristicvaluechanged: null,
  };
}

let writeChar: any;
let notifyChar: any;
let apduSenderFactory: ApduSenderServiceFactory;
let apduReceiverFactory: ApduReceiverServiceFactory;
let loggerFactory: (tag: string) => LoggerPublisherService;
let sender: WebBleApduSender;

const flushPromises = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  writeChar = makeCharacteristic();
  notifyChar = makeCharacteristic();

  apduSenderFactory = vi.fn().mockReturnValue({
    getFrames: (apdu: Uint8Array) => [
      { getRawData: () => new DataView(apdu.buffer) },
    ],
  });

  apduReceiverFactory = vi.fn().mockReturnValue({
    handleFrame: vi.fn((_frame: Uint8Array) =>
      Right(Maybe.of({ data: new Uint8Array([0x90, 0x00]) } as ApduResponse)),
    ),
  });

  loggerFactory = (tag: string) => new LoggerStub([], tag);

  sender = new WebBleApduSender(
    {
      writeCharacteristic: writeChar,
      notifyCharacteristic: notifyChar,
      apduSenderFactory,
      apduReceiverFactory,
    },
    loggerFactory,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WebBleApduSender", () => {
  it("getDependencies returns initial chars", () => {
    // when
    const deps = sender.getDependencies();

    // then
    expect(deps.writeCharacteristic).toBe(writeChar);
    expect(deps.notifyCharacteristic).toBe(notifyChar);
  });

  it("setupConnection negotiates MTU and listens", async () => {
    // when
    const promise = sender.setupConnection();

    // then
    expect(notifyChar.startNotifications).toHaveBeenCalled();
    await flushPromises();

    const filteredCalls = (
      notifyChar.addEventListener.mock.calls as [string, EventListener][]
    ).filter(([event]) => event === "characteristicvaluechanged");

    const firstCall = filteredCalls[0];

    if (!firstCall) {
      throw new Error("No event registered for 'characteristicvaluechanged'");
    }

    const handler = firstCall[1];

    // given
    const mtuBuf = new Uint8Array([0, 0, 0, 0, 0, 0x20]).buffer;

    // when
    handler({ target: { value: { buffer: mtuBuf } } } as unknown as Event);

    // then
    await expect(promise).resolves.toBeUndefined();
  });

  it("sendApdu writes frames and resolves on notification", async () => {
    // given
    const setupPromise = sender.setupConnection();
    await flushPromises();

    const mtuCall = (
      notifyChar.addEventListener.mock.calls as [string, EventListener][]
    ).find(([event]) => event === "characteristicvaluechanged");

    if (!mtuCall)
      throw new Error("No event registered for 'characteristicvaluechanged'");

    const mtuHandler = mtuCall[1];

    mtuHandler({
      target: {
        value: { buffer: new Uint8Array([0, 0, 0, 0, 0, 0x20]).buffer },
      },
    } as unknown as Event);

    await setupPromise;

    const apduCmd = new Uint8Array([0x01, 0x02, 0x03]);

    // when
    const promise = sender.sendApdu(apduCmd);

    // then
    expect(writeChar.writeValueWithResponse).toHaveBeenCalledWith(
      apduCmd.buffer,
    );
    await flushPromises();

    const filteredCalls = (
      notifyChar.addEventListener.mock.calls as [string, EventListener][]
    ).filter(([event]) => event === "characteristicvaluechanged");

    const lastCall = filteredCalls[filteredCalls.length - 1];
    if (!lastCall) throw new Error("No APDU handler registered.");

    const [, apduHandler] = lastCall;

    // when
    const respBuf = new Uint8Array([0x90, 0x00]).buffer;
    apduHandler({ target: { value: { buffer: respBuf } } } as unknown as Event);

    // then
    const result = await promise;

    expect(result.isRight()).toBe(true);
    expect((result.extract() as ApduResponse).data).toEqual(
      new Uint8Array([0x90, 0x00]),
    );
  });

  it("closeConnection calls disconnect", () => {
    // when
    sender.closeConnection();

    // then
    expect(notifyChar.service.device.gatt.disconnect).toHaveBeenCalled();
  });

  it("setDependencies swaps characteristics", async () => {
    // given
    const newNotify = makeCharacteristic();
    const newWrite = makeCharacteristic();
    notifyChar.service.device.gatt.connected = true;

    // when
    await sender.setDependencies({
      writeCharacteristic:
        newWrite as unknown as BluetoothRemoteGATTCharacteristic,
      notifyCharacteristic:
        newNotify as unknown as BluetoothRemoteGATTCharacteristic,
    });

    // then
    expect(notifyChar.removeEventListener).toHaveBeenCalled();
    expect(newNotify.startNotifications).toHaveBeenCalled();
    expect(newNotify.addEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      expect.any(Function),
    );

    const deps = sender.getDependencies();
    expect(deps.notifyCharacteristic).toBe(newNotify);
    expect(deps.writeCharacteristic).toBe(newWrite);
  });
});

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderServiceFactory,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Maybe, Right } from "purify-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MTU_OP, WebBleApduSender } from "./WebBleApduSender";

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
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

beforeEach(() => {
  writeChar = makeCharacteristic();
  notifyChar = makeCharacteristic();

  // it requires the characteristic to advertise "write" or "writeWithoutResponse" to pick a write mode
  writeChar.properties.write = true;

  // class calls getRawData().slice().buffer, return a Uint8Array
  apduSenderFactory = vi.fn().mockReturnValue({
    getFrames: (apdu: Uint8Array) => [{ getRawData: () => apdu }],
  });

  apduReceiverFactory = vi.fn().mockReturnValue({
    handleFrame: vi.fn((_frame: Uint8Array) =>
      Right(
        Maybe.of({
          data: new Uint8Array([0x90, 0x00]),
          statusCode: new Uint8Array([0x90, 0x00]),
        } as ApduResponse),
      ),
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
    const deps = sender.getDependencies();
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

    // wait for the internal sleep so the handshake flag is set
    await wait(150);

    const mtuBuf = new Uint8Array([MTU_OP, 0, 0, 0, 0, 0x20]).buffer;

    handler({ target: { value: { buffer: mtuBuf } } } as unknown as Event);

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

    // wait past the handshake delay, then send the proper MTU frame
    await wait(150);
    mtuHandler({
      target: {
        value: { buffer: new Uint8Array([MTU_OP, 0, 0, 0, 0, 0x20]).buffer },
      },
    } as unknown as Event);

    await setupPromise;

    const apduCmd = new Uint8Array([0x01, 0x02, 0x03]);

    // when
    const promise = sender.sendApdu(apduCmd);

    // then check that the last write matches the APDU bytes
    await flushPromises();
    expect(writeChar.writeValueWithResponse).toHaveBeenCalled();

    const lastArg = writeChar.writeValueWithResponse.mock.calls.at(
      -1,
    )?.[0] as ArrayBuffer;
    expect(lastArg).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(lastArg))).toEqual(Array.from(apduCmd));

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
    const extractedResult = result.extract();
    expect(extractedResult).toHaveProperty("data");
    expect((extractedResult as ApduResponse).data).toEqual(
      new Uint8Array([0x90, 0x00]),
    );
  });

  it("closeConnection calls disconnect", () => {
    sender.closeConnection();
    expect(notifyChar.service.device.gatt.disconnect).toHaveBeenCalled();
  });

  it("setDependencies swaps characteristics and resets link (does not arm)", async () => {
    // given
    const setupPromise = sender.setupConnection();
    await flushPromises();

    const mtuCall = (
      notifyChar.addEventListener.mock.calls as [string, EventListener][]
    ).find(([event]) => event === "characteristicvaluechanged");
    if (!mtuCall)
      throw new Error("No event registered for 'characteristicvaluechanged'");
    const mtuHandler = mtuCall[1];

    await wait(150);
    mtuHandler({
      target: {
        value: { buffer: new Uint8Array([MTU_OP, 0, 0, 0, 0, 0x20]).buffer },
      },
    } as unknown as Event);
    await setupPromise;

    const newNotify = makeCharacteristic();
    const newWrite = makeCharacteristic();
    newWrite.properties.write = true;

    // when
    sender.setDependencies({
      writeCharacteristic:
        newWrite as unknown as BluetoothRemoteGATTCharacteristic,
      notifyCharacteristic:
        newNotify as unknown as BluetoothRemoteGATTCharacteristic,
    });

    // then
    expect(notifyChar.removeEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      expect.any(Function),
    );
    expect(newNotify.startNotifications).not.toHaveBeenCalled();
    expect(newNotify.addEventListener).not.toHaveBeenCalled();

    const deps = sender.getDependencies();
    expect(deps.notifyCharacteristic).toBe(newNotify);
    expect(deps.writeCharacteristic).toBe(newWrite);
  });
});

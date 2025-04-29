import type { LoggerPublisherService } from "@ledgerhq/device-management-kit";

import type { CharacteristicIO } from "./CharacteristicIO";
import { MtuNegotiator } from "./MtuNegotiator";

function makeDataViewEvent(buffer: Uint8Array) {
  return {
    target: { value: new DataView(buffer.buffer) },
  } as unknown as Event;
}

describe("MtuNegotiator", () => {
  let io: CharacteristicIO;
  let notifyChar: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let onSenderReady: ReturnType<typeof vi.fn>;
  let onNegotiated: ReturnType<typeof vi.fn>;
  let log: LoggerPublisherService;
  let negotiator: MtuNegotiator;
  let capturedListener: (e: Event) => void;

  beforeEach(() => {
    capturedListener = () => {};
    notifyChar = {
      addEventListener: vi.fn((_event: string, cb: (e: Event) => void) => {
        capturedListener = cb;
      }),
      removeEventListener: vi.fn(),
    };

    io = {
      notify: notifyChar,
      startNotifications: vi.fn().mockResolvedValue(undefined),
      writeValue: vi.fn().mockResolvedValue(undefined),
    } as unknown as CharacteristicIO;

    onSenderReady = vi.fn();
    onNegotiated = vi.fn();
    log = {
      subscribers: [],
      debug: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    } as LoggerPublisherService;

    negotiator = new MtuNegotiator(io, onSenderReady, log, onNegotiated);
  });

  it("readyState is false before negotiation", () => {
    expect(negotiator.readyState()).toBe(false);
  });

  it("performs negotiation: subscribes, notifies, writes, and handles MTU event", async () => {
    const mtuFrame = new Uint8Array([0, 0, 0, 0, 0, 0x80]);

    const promise = negotiator.negotiate();

    await Promise.resolve();

    expect(notifyChar.addEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      expect.any(Function),
    );

    expect(io.startNotifications).toHaveBeenCalled();
    expect(io.writeValue).toHaveBeenCalledWith(
      Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]),
    );

    capturedListener(makeDataViewEvent(mtuFrame));

    await promise;

    expect(onSenderReady).toHaveBeenCalledWith(0x80);
    expect(log.debug).toHaveBeenCalledWith("MTU negotiated: frameSize=128");
    expect(onNegotiated).toHaveBeenCalled();

    expect(notifyChar.removeEventListener).toHaveBeenCalledWith(
      "characteristicvaluechanged",
      capturedListener,
    );

    expect(negotiator.readyState()).toBe(true);
  });

  it("ignores events with size zero or non-DataViewEvent before resolution", async () => {
    const zeroFrame = new Uint8Array([0, 0, 0, 0, 0, 0x00]);
    const promise = negotiator.negotiate();

    capturedListener({} as Event);
    capturedListener(makeDataViewEvent(zeroFrame));

    expect(negotiator.readyState()).toBe(false);

    const validFrame = new Uint8Array([1, 2, 3, 4, 5, 0x10]);
    capturedListener(makeDataViewEvent(validFrame));
    await promise;

    expect(onSenderReady).toHaveBeenCalledWith(0x10);
  });
});

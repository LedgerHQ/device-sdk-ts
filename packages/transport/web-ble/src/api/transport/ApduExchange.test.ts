//@ts-nocheck
import type {
  ApduReceiverService,
  ApduSenderService,
  DmkError,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Left, Maybe, Right } from "purify-ts";

import { isDataViewEvent } from "@api/utils/utils";

import { ApduExchange } from "./ApduExchange";
import { type DataViewEvent } from "./BleDeviceConnection";
import type { CharacteristicIO } from "./CharacteristicIO";

class FrameStub {
  constructor(private data: Uint8Array) {}
  getRawData() {
    return this.data;
  }
}

describe("ApduExchange", () => {
  let senderFactory: () => Maybe<ApduSenderService>;
  let receiver: ApduReceiverService;
  let io: CharacteristicIO;
  let log: LoggerPublisherService;
  let isReady: () => boolean;
  let exchange: ApduExchange;

  beforeEach(() => {
    const senderService: Partial<ApduSenderService> = {
      getFrames: vi.fn((apdu: Uint8Array) => [new FrameStub(apdu)]),
    };
    senderFactory = vi.fn(() => Maybe.of(senderService as ApduSenderService));

    receiver = {
      handleFrame: vi.fn(),
    } as unknown as ApduReceiverService;

    io = {
      onValueChanged: vi.fn(),
      offValueChanged: vi.fn(),
      writeValue: vi.fn(),
    } as unknown as CharacteristicIO;

    log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;

    isReady = vi.fn(() => true);

    exchange = new ApduExchange(senderFactory, receiver, io, log, isReady);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should attach listener on construction", () => {
    expect(io.onValueChanged).toHaveBeenCalledTimes(1);
  });

  it("should detach and attach listeners correctly", () => {
    exchange.detach();
    expect(io.offValueChanged).toHaveBeenCalledTimes(1);

    exchange.attach();
    expect(io.onValueChanged).toHaveBeenCalledTimes(2);
  });

  it("send writes all frames and resolves with Right on successful response", async () => {
    const apdu = new Uint8Array([1, 2, 3]);
    const raw = apdu;
    const response = { dummy: "resp" } as unknown;
    (
      receiver.handleFrame as vi.Mock<
        ReturnType<ApduReceiverService["handleFrame"]>,
        [Uint8Array]
      >
    ).mockImplementation(
      (_buf: Uint8Array): ReturnType<ApduReceiverService["handleFrame"]> =>
        Right(Maybe.of(response)),
    );

    const promise = exchange.send(apdu);

    expect(io.writeValue).toHaveBeenCalledWith(raw);

    const dataViewEvent = {
      target: { value: new DataView(raw.buffer) },
    } as DataViewEvent;

    expect(isDataViewEvent(dataViewEvent)).toBe(true);

    exchange["onIncoming"](dataViewEvent);

    const result = await promise;
    expect(result.isRight()).toBe(true);
    result.map((r) => expect(r).toEqual(response));
  });

  it("logs error and continues on writeValue exception", async () => {
    const apdu = new Uint8Array([4, 5]);

    (io.writeValue as vi.Mock).mockRejectedValue(new Error("waste"));

    (receiver.handleFrame as vi.Mock).mockReturnValue(
      Left(new Error("dmk") as unknown as DmkError),
    );

    const promise = exchange.send(apdu);

    await Promise.resolve();
    expect(log.error).toHaveBeenCalledWith("write frame", {
      data: { e: expect.any(Error) },
    });

    const dvEvent = {
      target: { value: new DataView(apdu.buffer) },
    } as DataViewEvent;

    exchange["onIncoming"](dvEvent);

    const result = await promise;
    expect(result.isLeft()).toBe(true);
  });

  it("logs parse error and resolves Left when receiver throws", async () => {
    const apdu = new Uint8Array([7]);
    (receiver.handleFrame as vi.Mock).mockImplementation(() => {
      throw new Error("parse fail");
    });

    const promise = exchange.send(apdu);
    const dvEvent = {
      target: { value: new DataView(apdu.buffer) },
    } as DataViewEvent;

    exchange["onIncoming"](dvEvent);

    const result = await promise;
    expect(log.error).toHaveBeenCalledWith("parse error", {
      data: { err: expect.any(Error) },
    });
    expect(result.isLeft()).toBe(true);
  });
});

import {
  type ApduResponse,
  type LoggerPublisherService,
  OpeningConnectionError,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import type { Device as NodeHIDDevice, HIDAsync } from "node-hid";
import { Left, Maybe, Right } from "purify-ts";

import { NodeHidSendReportError } from "@api/model/Errors";
import { nodeHidDeviceStubBuilder } from "@api/model/HIDDevice.stub";

import { NodeHidApduSender } from "./NodeHidApduSender";

// Mock HIDAsync.open static method
vi.mock("node-hid", () => ({
  HIDAsync: {
    open: vi.fn(),
  },
}));

describe("NodeHidApduSender", () => {
  const mockApduSender = {
    getFrames: vi.fn(),
  };

  const mockApduReceiver = {
    handleFrame: vi.fn(),
  };

  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const mockDevice: NodeHIDDevice = nodeHidDeviceStubBuilder();

  // Mock HIDAsync instance
  let mockHidAsync: {
    on: ReturnType<typeof vi.fn>;
    write: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    dataCallback?: (data: Buffer) => void;
    errorCallback?: (error: Error) => void;
  };

  let nodeHidApduSender: NodeHidApduSender;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a fresh mock HIDAsync instance for each test
    mockHidAsync = {
      on: vi.fn((event: string, callback: (data: unknown) => void) => {
        if (event === "data") {
          mockHidAsync.dataCallback = callback as (data: Buffer) => void;
        } else if (event === "error") {
          mockHidAsync.errorCallback = callback as (error: Error) => void;
        }
      }),
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Mock HIDAsync.open to return our mock instance
    const { HIDAsync } = await import("node-hid");
    vi.mocked(HIDAsync.open).mockResolvedValue(
      mockHidAsync as unknown as HIDAsync,
    );

    const mockLoggerFactory = vi
      .fn()
      .mockReturnValue(mockLogger as unknown as LoggerPublisherService);
    const mockApduSenderFactory = vi.fn().mockReturnValue(mockApduSender);
    const mockApduReceiverFactory = vi.fn().mockReturnValue(mockApduReceiver);

    nodeHidApduSender = new NodeHidApduSender({
      dependencies: { device: mockDevice },
      apduSenderFactory: mockApduSenderFactory,
      apduReceiverFactory: mockApduReceiverFactory,
      loggerFactory: mockLoggerFactory,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should get dependencies", () => {
    const dependencies = nodeHidApduSender.getDependencies();
    expect(dependencies).toEqual({
      device: mockDevice,
    });
  });

  it("should set dependencies", () => {
    const newDevice: NodeHIDDevice = nodeHidDeviceStubBuilder({
      path: "/dev/hidraw1",
      product: "Ledger Nano S Plus",
    });
    nodeHidApduSender.setDependencies({ device: newDevice });
    const dependencies = nodeHidApduSender.getDependencies();
    expect(dependencies).toEqual({ device: newDevice });
  });

  it("should setup connection", async () => {
    const { HIDAsync } = await import("node-hid");

    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    expect(HIDAsync.open).toHaveBeenCalledWith(mockDevice.path, {
      nonExclusive: true,
    });
    expect(mockHidAsync.on).toHaveBeenCalledWith("data", expect.any(Function));
    expect(mockHidAsync.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockLogger.info).toHaveBeenCalledWith("🔌 Connected to device");
  });

  it("should throw error if device path is missing", async () => {
    const deviceWithoutPath: NodeHIDDevice = nodeHidDeviceStubBuilder({
      path: undefined,
    });
    nodeHidApduSender.setDependencies({ device: deviceWithoutPath });

    await expect(nodeHidApduSender.setupConnection()).rejects.toThrow(
      "Missing device path",
    );
  });

  it("should handle setup connection error", async () => {
    const error = new Error("Failed to open device");
    const { HIDAsync } = await import("node-hid");
    vi.mocked(HIDAsync.open).mockRejectedValue(error);

    await expect(nodeHidApduSender.setupConnection()).rejects.toThrow(error);
  });

  it("should close existing connection before setting up new one", async () => {
    // Setup first connection
    const firstSetupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await firstSetupPromise;

    // Create a new mock for the second connection
    const secondMockHidAsync = {
      on: vi.fn(),
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const { HIDAsync } = await import("node-hid");
    vi.mocked(HIDAsync.open).mockResolvedValue(
      secondMockHidAsync as unknown as HIDAsync,
    );

    // Setup second connection - should close the first
    const secondSetupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await secondSetupPromise;

    expect(mockHidAsync.close).toHaveBeenCalled();
  });

  it("should close connection", async () => {
    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    await nodeHidApduSender.closeConnection();

    expect(mockHidAsync.close).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith("🔚 Disconnect");
  });

  it("should handle close connection error", async () => {
    const error = new Error("Failed to close device");
    mockHidAsync.close = vi.fn().mockRejectedValue(error);

    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    await expect(nodeHidApduSender.closeConnection()).rejects.toThrow(error);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error while closing device",
      {
        data: { device: mockDevice, error },
      },
    );
  });

  it("should do nothing when closing without connection", async () => {
    // Don't setup connection, just try to close
    await nodeHidApduSender.closeConnection();

    expect(mockHidAsync.close).not.toHaveBeenCalled();
  });

  it("should return error when sending APDU without connection", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);

    const result = await nodeHidApduSender.sendApdu(apdu);

    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(OpeningConnectionError);
  });

  it("should send APDU successfully", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const apduResponse = {
      data: new Uint8Array([0x01, 0x02]),
      statusCode: new Uint8Array([0x90, 0x00]),
    } as ApduResponse;

    mockApduSender.getFrames.mockReturnValue(frames);
    mockApduReceiver.handleFrame.mockReturnValue(Right(Maybe.of(apduResponse)));

    // Setup connection
    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    // Send APDU
    const promise = nodeHidApduSender.sendApdu(apdu);

    // Simulate receiving response
    mockHidAsync.dataCallback?.(Buffer.from([0x01, 0x02]));

    // Await response
    const result = await promise;

    expect(mockHidAsync.write).toHaveBeenCalledTimes(2);
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual(apduResponse);
  });

  it("should handle send APDU error", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const error = new Error("Failed to write");

    mockApduSender.getFrames.mockReturnValue(frames);
    mockHidAsync.write = vi.fn().mockRejectedValue(error);

    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    const result = await nodeHidApduSender.sendApdu(apdu);

    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(NodeHidSendReportError);
  });

  it("should handle received response error", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const apduError = new Error("Error while receiving APDU");

    mockApduSender.getFrames.mockReturnValue(frames);
    mockApduReceiver.handleFrame.mockReturnValue(Left(apduError));

    // Setup connection
    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    // Send APDU
    const promise = nodeHidApduSender.sendApdu(apdu);

    // Simulate receiving response with error
    mockHidAsync.dataCallback?.(Buffer.from([]));

    // Await response
    const result = await promise;

    expect(mockHidAsync.write).toHaveBeenCalled();
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toStrictEqual(apduError);
  });

  it("should handle HIDAsync error event", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [{ getRawData: () => new Uint8Array([0x00, 0x01]) }];
    const hidError = new Error("HID error");

    mockApduSender.getFrames.mockReturnValue(frames);

    // Setup connection
    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    // Send APDU
    const promise = nodeHidApduSender.sendApdu(apdu);

    // Simulate HID error
    mockHidAsync.errorCallback?.(hidError);

    // Await response
    const result = await promise;

    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(NodeHidSendReportError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error while receiving data",
      { data: { error: hidError } },
    );
  });

  it("should handle send APDU timeout", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];

    mockApduSender.getFrames.mockReturnValue(frames);

    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    const promise = nodeHidApduSender.sendApdu(apdu, false, 100);

    // Advance timers to trigger timeout - need to run pending timers
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(SendApduTimeoutError);
  });

  it("should clear timeout when response is received before timeout", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [{ getRawData: () => new Uint8Array([0x00, 0x01]) }];
    const apduResponse = {
      data: new Uint8Array([0x01, 0x02]),
      statusCode: new Uint8Array([0x90, 0x00]),
    } as ApduResponse;

    mockApduSender.getFrames.mockReturnValue(frames);
    mockApduReceiver.handleFrame.mockReturnValue(Right(Maybe.of(apduResponse)));

    const setupPromise = nodeHidApduSender.setupConnection();
    await vi.advanceTimersByTimeAsync(300);
    await setupPromise;

    const promise = nodeHidApduSender.sendApdu(apdu, false, 1000);

    // Respond before timeout
    mockHidAsync.dataCallback?.(Buffer.from([0x01, 0x02]));

    const result = await promise;
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual(apduResponse);
  });
});

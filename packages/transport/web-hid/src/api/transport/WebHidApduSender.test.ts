import {
  type ApduResponse,
  type LoggerPublisherService,
  SendApduTimeoutError,
} from "@ledgerhq/device-management-kit";
import { Left, Maybe, Right } from "purify-ts";

import { WebHidSendReportError } from "@api/model/Errors";

import { WebHidApduSender } from "./WebHidApduSender";

describe("WebHidApduSender", () => {
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
  };

  const mockDevice = {
    oninputreport: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    sendReport: vi.fn(),
  };

  let webHidApduSender: WebHidApduSender;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockLoggerFactory = vi
      .fn()
      .mockReturnValue(mockLogger as unknown as LoggerPublisherService);
    const mockApduSenderFactory = vi.fn().mockReturnValue(mockApduSender);
    const mockApduReceiverFactory = vi.fn().mockReturnValue(mockApduReceiver);
    webHidApduSender = new WebHidApduSender(
      {
        dependencies: { device: mockDevice as unknown as HIDDevice },
        apduSenderFactory: mockApduSenderFactory,
        apduReceiverFactory: mockApduReceiverFactory,
      },
      mockLoggerFactory,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should get dependencies", () => {
    const dependencies = webHidApduSender.getDependencies();
    expect(dependencies).toEqual({
      device: mockDevice as unknown as HIDDevice,
    });
  });

  it("should set dependencies", () => {
    const newDevice: HIDDevice = {
      oninputreport: null,
      open: vi.fn(),
      close: vi.fn(),
      sendReport: vi.fn(),
    } as unknown as HIDDevice;
    webHidApduSender.setDependencies({ device: newDevice });
    const dependencies = webHidApduSender.getDependencies();
    expect(dependencies).toEqual({ device: newDevice });
  });

  it("should setup connection", async () => {
    await webHidApduSender.setupConnection();
    expect(mockDevice.open).toHaveBeenCalled();
    expect(mockDevice.oninputreport).toBeDefined();
  });

  it("should handle setup connection error", async () => {
    const error = new Error("Failed to open device");
    mockDevice.open = vi.fn().mockRejectedValue(error);
    expect(webHidApduSender.setupConnection()).rejects.toThrowError();
  });

  it("should close connection", () => {
    webHidApduSender.closeConnection();
    expect(mockDevice.close).toHaveBeenCalled();
  });

  it("should handle close connection error", () => {
    const error = new Error("Failed to close device");
    mockDevice.close = vi.fn().mockImplementation(() => {
      throw error;
    });
    webHidApduSender.closeConnection();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Error while closing device",
      {
        data: { device: mockDevice, error },
      },
    );
  });

  it("should send APDU successfully", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const apduResponse = { data: new Uint8Array([0x90, 0x00]) } as ApduResponse;

    mockApduSender.getFrames.mockReturnValue(frames);
    mockDevice.sendReport.mockResolvedValue({});
    mockApduReceiver.handleFrame.mockReturnValue(Right(Maybe.of(apduResponse)));

    // Setup connection
    await webHidApduSender.setupConnection();

    // Send APDU
    const promise = webHidApduSender.sendApdu(apdu);

    // Receive response
    mockDevice.oninputreport({ data: { buffer: Buffer.from([]) } });

    // Await response
    const result = await promise;
    expect(mockDevice.sendReport).toHaveBeenCalled();
    expect(result.isRight()).toBe(true);
    expect(result.extract()).toEqual(apduResponse);
  });

  it("should handle send APDU error", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const error = new Error("Failed to send report");

    mockApduSender.getFrames.mockReturnValue(frames);
    mockDevice.sendReport.mockRejectedValue(error);

    await webHidApduSender.setupConnection();
    const result = await webHidApduSender.sendApdu(apdu);
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(WebHidSendReportError);
  });

  it("should handle received response error", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];
    const apduError = new Error("Error while receiving APDU");

    mockApduSender.getFrames.mockReturnValue(frames);
    mockDevice.sendReport.mockResolvedValue({});
    mockApduReceiver.handleFrame.mockReturnValue(Left(apduError));

    // Setup connection
    await webHidApduSender.setupConnection();

    // Send APDU
    const promise = webHidApduSender.sendApdu(apdu);

    // Receive response
    mockDevice.oninputreport({ data: { buffer: Buffer.from([]) } });

    // Await response
    const result = await promise;
    expect(mockDevice.sendReport).toHaveBeenCalled();
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toStrictEqual(apduError);
  });

  it("should handle send APDU timeout", async () => {
    const apdu = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const frames = [
      { getRawData: () => new Uint8Array([0x00, 0x01]) },
      { getRawData: () => new Uint8Array([0x02, 0x03]) },
    ];

    mockApduSender.getFrames.mockReturnValue(frames);
    mockDevice.sendReport.mockResolvedValue({});

    await webHidApduSender.setupConnection();
    const result = await webHidApduSender.sendApdu(apdu, false, 100);
    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toBeInstanceOf(SendApduTimeoutError);
  });
});

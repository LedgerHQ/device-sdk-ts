/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left, Right } from "purify-ts";
import { of, Subject, throwError } from "rxjs";
import { delay } from "rxjs/operators";
import { type Mocked } from "vitest";

import { type Command } from "@api/command/Command";
import {
  type CommandResult,
  CommandResultStatus,
} from "@api/command/model/CommandResult";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { type DeviceAction } from "@api/device-action/DeviceAction";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";
import { type DmkError } from "@api/Error";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { connectedDeviceStubBuilder } from "@api/transport/model/TransportConnectedDevice.stub";
import { type IntentQueueService } from "@internal/device-session/service/IntentQueueService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
import { type ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
import { type SecureChannelService } from "@internal/secure-channel/service/SecureChannelService";

import {
  DeviceSession,
  type DeviceSessionRefresherOptions,
} from "./DeviceSession";

describe("DeviceSession", () => {
  let deviceSession: DeviceSession;
  let mockLogger: LoggerPublisherService;
  let mockLoggerFactory: ReturnType<typeof vi.fn>;
  let mockManagerApi: Mocked<ManagerApiService>;
  let mockSecureChannel: Mocked<SecureChannelService>;
  let mockIntentQueueService: Mocked<IntentQueueService>;
  let refresherOptions: DeviceSessionRefresherOptions;
  const mockConnectedDevice = connectedDeviceStubBuilder();

  beforeEach(() => {
    // Setup logger
    mockLogger = new DefaultLoggerPublisherService([], "device-session-test");
    mockLoggerFactory = vi.fn(() => mockLogger);

    // Setup mocks
    mockManagerApi = {
      getAppList: vi.fn(),
      getAppsByHash: vi.fn(),
      getCurrentFirmware: vi.fn(),
      getLatestFirmware: vi.fn(),
    } as unknown as Mocked<ManagerApiService>;

    mockSecureChannel = {
      genuineCheck: vi.fn(),
      listInstalledApps: vi.fn(),
      updateMcu: vi.fn(),
      updateFirmware: vi.fn(),
      installApp: vi.fn(),
      uninstallApp: vi.fn(),
    } as unknown as Mocked<SecureChannelService>;

    // Setup intent queue service with default mock
    mockIntentQueueService = {
      enqueue: vi.fn().mockReturnValue({
        observable: of(null).pipe(delay(1)),
        cancel: vi.fn(),
      }),
    } as unknown as Mocked<IntentQueueService>;

    refresherOptions = {
      isRefresherDisabled: true,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create a device session with default id", () => {
      // when
      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );

      // then
      expect(deviceSession).toBeDefined();
      expect(deviceSession.id).toBeDefined();
      expect(deviceSession.connectedDevice).toBe(mockConnectedDevice);
    });

    it("should create a device session with custom id", () => {
      // given
      const customId = "custom-session-id";

      // when
      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice, id: customId },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );

      // then
      expect(deviceSession.id).toBe(customId);
    });
  });

  describe("initialiseSession", () => {
    it("should successfully initialize session", async () => {
      // given
      const mockObservable = of({
        status: "success",
        data: { name: "Dashboard", version: "1.0.0" },
      }).pipe(delay(1));

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );

      // when
      await deviceSession.initialiseSession();

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalled();
    });

    it("should throw error if initialization fails", async () => {
      // given
      const error = new Error("Initialization failed");
      const mockObservable = throwError(() => error);

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );

      // when/then
      await expect(deviceSession.initialiseSession()).rejects.toThrow(
        "Initialization failed",
      );
    });
  });

  describe("getters", () => {
    beforeEach(() => {
      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice, id: "test-id" },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );
    });

    it("should return session id", () => {
      expect(deviceSession.id).toBe("test-id");
    });

    it("should return connected device", () => {
      expect(deviceSession.connectedDevice).toBe(mockConnectedDevice);
    });

    it("should return state as observable", async () => {
      const stateObservable = deviceSession.state;

      await new Promise<void>((resolve) => {
        stateObservable.subscribe((state) => {
          expect(state.sessionStateType).toBe(DeviceSessionStateType.Connected);
          expect(state.deviceStatus).toBe(DeviceStatus.CONNECTED);
          resolve();
        });
      });
    });
  });

  describe("getDeviceSessionState and setDeviceSessionState", () => {
    beforeEach(() => {
      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );
    });

    it("should get current device session state", () => {
      // when
      const state = deviceSession.getDeviceSessionState();

      // then
      expect(state.sessionStateType).toBe(DeviceSessionStateType.Connected);
      expect(state.deviceStatus).toBe(DeviceStatus.CONNECTED);
    });

    it("should set device session state", async () => {
      // given
      const newState = {
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.LOCKED,
        deviceModelId: mockConnectedDevice.deviceModel.id,
        currentApp: { name: "Test", version: "1.0.0" },
        installedApps: [],
        isSecureConnectionAllowed: false,
      };

      // when
      await new Promise<void>((resolve) => {
        deviceSession.state.subscribe((state) => {
          if (
            state.sessionStateType ===
            DeviceSessionStateType.ReadyWithoutSecureChannel
          ) {
            expect(state).toMatchObject({
              sessionStateType:
                DeviceSessionStateType.ReadyWithoutSecureChannel,
              deviceStatus: DeviceStatus.LOCKED,
              deviceModelId: mockConnectedDevice.deviceModel.id,
            });
            resolve();
          }
        });

        deviceSession.setDeviceSessionState(newState);
      });
    });
  });

  describe("sendApdu", () => {
    let mockApdu: Uint8Array;
    let mockResponse: ApduResponse;

    beforeEach(() => {
      mockApdu = new Uint8Array([0xe0, 0x01, 0x00, 0x00]);
      mockResponse = {
        data: new Uint8Array([0x01, 0x02]),
        statusCode: new Uint8Array([0x90, 0x00]),
      };

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );
    });

    it("should successfully send APDU", async () => {
      // given
      const mockObservable = of(Right(mockResponse)).pipe(delay(1));
      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      // when
      const result = await deviceSession.sendApdu(mockApdu);

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalledWith({
        type: "send-apdu",
        execute: expect.any(Function),
      });
      expect(result.isRight()).toBe(true);
      result.ifRight((response) => {
        expect(response).toEqual(mockResponse);
      });
    });

    it("should handle APDU send error", async () => {
      // given
      const error = { _tag: "SendApduError" } as DmkError;
      const mockObservable = of(Left(error)).pipe(delay(1));
      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      // when
      const result = await deviceSession.sendApdu(mockApdu);

      // then
      expect(result.isLeft()).toBe(true);
      result.ifLeft((err) => {
        expect(err).toEqual(error);
      });
    });

    it("should handle APDU timeout", async () => {
      // given
      const mockCancel = vi.fn();
      const subject = new Subject();

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: subject.asObservable(),
        cancel: mockCancel,
      });

      vi.useFakeTimers();

      // when
      const sendPromise = deviceSession.sendApdu(mockApdu, {
        abortTimeout: 1000,
      });

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1100);

      try {
        await sendPromise;
      } catch {
        // Expected to timeout
      }

      vi.useRealTimers();

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalled();
    });
  });

  describe("sendCommand", () => {
    type TestData = { test: string };
    type TestArgs = Record<string, never>;
    type TestErrorCodes = number;

    let mockCommand: Mocked<Command<TestData, TestArgs, TestErrorCodes>>;
    let mockCommandResult: CommandResult<TestData, TestErrorCodes>;

    beforeEach(() => {
      mockCommandResult = {
        status: CommandResultStatus.Success,
        data: { test: "data" },
      };

      mockCommand = {
        getApdu: vi.fn().mockReturnValue({
          getRawApdu: () => new Uint8Array([0xe0, 0x01, 0x00, 0x00]),
        }),
        parseResponse: vi.fn().mockReturnValue(mockCommandResult),
        triggersDisconnection: false,
      } as unknown as Mocked<Command<TestData, TestArgs, TestErrorCodes>>;

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );
    });

    it("should successfully send command", async () => {
      // given
      const mockObservable = of(mockCommandResult).pipe(delay(1));
      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      // when
      const result = await deviceSession.sendCommand(mockCommand);

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalledWith({
        type: "send-command",
        execute: expect.any(Function),
      });
      expect(result).toEqual(mockCommandResult);
    });

    it("should handle command timeout", async () => {
      // given
      const mockCancel = vi.fn();
      const subject = new Subject();

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: subject.asObservable(),
        cancel: mockCancel,
      });

      vi.useFakeTimers();

      // when
      const commandPromise = deviceSession.sendCommand(mockCommand, 1000);

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1100);

      try {
        await commandPromise;
      } catch {
        // Expected to timeout
      }

      vi.useRealTimers();

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalled();
    });

    it("should handle command error", async () => {
      // given
      const error = new Error("Command failed");
      const mockObservable = throwError(() => error);
      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockObservable,
        cancel: vi.fn(),
      });

      // when/then
      await expect(deviceSession.sendCommand(mockCommand)).rejects.toThrow(
        "Command failed",
      );
    });
  });

  describe("executeDeviceAction", () => {
    type TestOutput = { result: string };
    type TestInput = { input: string };
    type TestError = DmkError;
    type TestIntermediateValue = {
      intermediateValue: string;
      requiredUserInteraction:
        | "UnlockDevice"
        | "ConfirmOpenApp"
        | "ConfirmCloseApp"
        | "AllowListAccess"
        | "AllowSecureChannelConnection"
        | "AllowedDataRecording"
        | "SignTransaction";
    };

    let mockDeviceAction: Mocked<
      DeviceAction<TestOutput, TestInput, TestError, TestIntermediateValue>
    >;

    beforeEach(() => {
      const mockActionObservable = of({
        intermediateValue: "test",
        requiredUserInteraction: "SignTransaction" as const,
      }).pipe(delay(1));

      mockDeviceAction = {
        _execute: vi.fn().mockReturnValue({
          observable: mockActionObservable,
        }),
      } as unknown as Mocked<
        DeviceAction<TestOutput, TestInput, TestError, TestIntermediateValue>
      >;

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );
    });

    it("should execute device action", async () => {
      // given
      const mockActionObservable = of({
        intermediateValue: "test",
        requiredUserInteraction: "SignTransaction" as const,
      }).pipe(delay(1));
      const mockCancel = vi.fn();

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: mockActionObservable,
        cancel: mockCancel,
      });

      // when
      const { observable, cancel } =
        deviceSession.executeDeviceAction(mockDeviceAction);

      // then
      expect(mockIntentQueueService.enqueue).toHaveBeenCalledWith({
        type: "device-action",
        execute: expect.any(Function),
      });
      expect(observable).toBeDefined();
      expect(cancel).toBe(mockCancel);

      // Verify observable emits values
      const values: unknown[] = [];
      await new Promise<void>((resolve) => {
        observable.subscribe({
          next: (value) => values.push(value),
          complete: () => resolve(),
        });
      });

      expect(values).toEqual([
        {
          intermediateValue: "test",
          requiredUserInteraction: "SignTransaction",
        },
      ]);
    });

    it("should provide correct internal API to device action", () => {
      // given
      const mockActionObservable = of({
        intermediateValue: "test",
        requiredUserInteraction: "SignTransaction" as const,
      }).pipe(delay(1));

      mockIntentQueueService.enqueue.mockImplementation((intent) => {
        // Execute the device action to verify the internal API
        void intent.execute();

        return {
          observable: mockActionObservable,
          cancel: vi.fn(),
        };
      });

      // when
      deviceSession.executeDeviceAction(mockDeviceAction);

      // then
      expect(mockDeviceAction._execute).toHaveBeenCalledWith({
        sendApdu: expect.any(Function),
        sendCommand: expect.any(Function),
        getDeviceModel: expect.any(Function),
        getDeviceSessionState: expect.any(Function),
        getDeviceSessionStateObservable: expect.any(Function),
        setDeviceSessionState: expect.any(Function),
        disableRefresher: expect.any(Function),
        getManagerApiService: expect.any(Function),
        getSecureChannelService: expect.any(Function),
      });
    });

    it("should allow cancelling device action", () => {
      // given
      const mockCancel = vi.fn();
      const subject = new Subject();

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: subject.asObservable(),
        cancel: mockCancel,
      });

      // when
      const { cancel } = deviceSession.executeDeviceAction(mockDeviceAction);
      cancel();

      // then
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe("close", () => {
    it("should close the session and update device status", () => {
      // given
      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        refresherOptions,
        mockIntentQueueService,
      );

      let isComplete = false;
      deviceSession.state.subscribe({
        complete: () => {
          isComplete = true;
        },
      });

      // when
      deviceSession.close();

      // then
      const state = deviceSession.getDeviceSessionState();
      expect(state.deviceStatus).toBe(DeviceStatus.NOT_CONNECTED);
      expect(isComplete).toBe(true);
    });
  });

  describe("disableRefresher", () => {
    beforeEach(() => {
      // Use proper mock for refresher tests
      const mockCommandResult = {
        status: "success",
        data: { name: "Dashboard", version: "1.0.0" },
      };

      mockIntentQueueService.enqueue.mockReturnValue({
        observable: of(mockCommandResult).pipe(delay(1)),
        cancel: vi.fn(),
      });

      deviceSession = new DeviceSession(
        { connectedDevice: mockConnectedDevice },
        mockLoggerFactory,
        mockManagerApi,
        mockSecureChannel,
        { isRefresherDisabled: false, pollingInterval: 1000 },
        mockIntentQueueService,
      );
    });

    afterEach(() => {
      // Clean up refresher
      if (deviceSession) {
        deviceSession.close();
      }
    });

    it("should return a function to re-enable refresher", () => {
      // when
      const enableRefresher = deviceSession.disableRefresher("test-blocker-id");

      // then
      expect(enableRefresher).toBeInstanceOf(Function);

      // Should be able to call the enable function
      enableRefresher();
    });

    it("should handle multiple refresher blockers", () => {
      // when
      const enable1 = deviceSession.disableRefresher("blocker-1");
      const enable2 = deviceSession.disableRefresher("blocker-2");

      // then
      expect(enable1).toBeInstanceOf(Function);
      expect(enable2).toBeInstanceOf(Function);

      // Both should be callable
      enable1();
      enable2();
    });
  });
});

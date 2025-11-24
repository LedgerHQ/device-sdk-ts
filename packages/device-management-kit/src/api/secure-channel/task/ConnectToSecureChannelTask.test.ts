import WebSocket from "isomorphic-ws";
import { Right } from "purify-ts";
import { describe, it, vi } from "vitest";

import { type InternalApi } from "@api/index";
import {
  type SecureChannelEvent,
  SecureChannelEventType,
} from "@api/secure-channel/task/types";
import {
  SecureChannelError,
  SecureChannelErrorType,
} from "@internal/secure-channel/model/Errors";

import {
  ConnectToSecureChannelTask,
  type ConnectToSecureChannelTaskArgs,
} from "./ConnectToSecureChannelTask";

vi.mock("isomorphic-ws", () => ({
  ...vi.importActual("isomorphic-ws"),
  __esModule: true,
  default: class {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    send = vi.fn();
    close = vi.fn();
    url: string;
    constructor(url: string) {
      this.url = url;
    }
  },
}));

const TEST_DELAY = 5;

describe("ConnectToSecureChannelTask", () => {
  let mockWebSocket: WebSocket;
  let mockInternalApi: InternalApi;
  let taskArgs: ConnectToSecureChannelTaskArgs;
  let task: ConnectToSecureChannelTask;
  const sendApduFn = vi.fn();
  const mockMessage = {
    uuid: "5b776c8d-8af2-48c0-8250-04edca2ef5e9",
    session: "39ce749e-00a4-4c31-a697-1dc1a29e2cab",
    query: "success",
    nonce: 15,
  };

  beforeEach(() => {
    // vi.useFakeTimers({ shouldAdvanceTime: true });

    mockWebSocket = new WebSocket("wss://test-host.com");
    mockInternalApi = {
      sendApdu: sendApduFn,
      disableRefresher: (_: unknown) => vi.fn(),
    } as unknown as InternalApi;
    taskArgs = { connection: Right(mockWebSocket) };
    task = new ConnectToSecureChannelTask(mockInternalApi, taskArgs);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should emit Opened event on WebSocket open", async () => {
    const events: SecureChannelEvent[] = [];
    const obs = task.run();
    obs.subscribe((e) => events.push(e));

    expect(mockWebSocket.onopen).toBeDefined();
    mockWebSocket.onopen!({
      type: "open",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(events).toStrictEqual([{ type: SecureChannelEventType.Opened }]);
  });

  it("Error on wrongly formatted message", async () => {
    const events: SecureChannelEvent[] = [];
    const obs = task.run();
    obs.subscribe({
      next: (event) => {
        events.push(event);
      },
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: "invalidData",
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.Error,
        error: new SecureChannelError({
          url: "wss://test-host.com",
          errorMessage: "Invalid message received: invalidData",
        }),
      },
    ]);
  });

  it("should handle incoming EXCHANGE message including requesting user permission", async () => {
    sendApduFn.mockResolvedValue(
      Right({
        data: new Uint8Array([0x90, 0x00]),
        statusCode: new Uint8Array([0x90, 0x00]),
      }),
    );

    const sendSpy = vi.spyOn(mockWebSocket, "send");
    vi.spyOn(task, "isSecureConnectionAllowed").mockReturnValueOnce(false);

    const events: SecureChannelEvent[] = [];
    const obs = task.run();
    obs.subscribe({
      next: (event) => {
        events.push(event);
      },
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "exchange",
        nonce: 1,
        data: "e051000000",
      }),
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(sendSpy).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        nonce: 1,
        response: "success",
        data: "9000",
      }),
    );
    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.PreExchange,
        payload: {
          nonce: 1,
          apdu: new Uint8Array([0xe0, 0x51, 0x00, 0x00, 0x00]),
        },
      },
      {
        type: SecureChannelEventType.PermissionRequested,
      },
      {
        type: SecureChannelEventType.Exchange,
        payload: {
          nonce: 1,
          apdu: new Uint8Array([0xe0, 0x51, 0x00, 0x00, 0x00]),
          data: new Uint8Array([0x90, 0x00]),
          status: new Uint8Array([0x90, 0x00]),
        },
      },
      {
        type: SecureChannelEventType.PermissionGranted,
      },
    ]);
  });

  it("should capture and emit device ID on first GetCertificate APDU", async () => {
    // Mock response for GetCertificate
    const mockResponse = new Uint8Array([
      0x07, 0x4a, 0x07, 0xa1, 0x52, 0xe6, 0xbb, 0xc1, 0x41, 0x04, 0x1c, 0x74,
      0x7a, 0x4e, 0x08, 0x1b, 0x5c, 0x1e, 0xd0, 0x27, 0xfc, 0xaf, 0x80, 0xda,
      0xda, 0x1f, 0x84, 0xfc, 0x8e, 0x43, 0x60, 0xcb, 0x53, 0xc4, 0xb6, 0x9e,
      0x63, 0xcb, 0x91, 0xb7, 0xca, 0xd3, 0x15, 0x63, 0x68, 0x59, 0x1b, 0xfb,
      0x05, 0x8f, 0x72, 0x0f, 0x97, 0xaf, 0xc4, 0x73, 0xf9, 0x78, 0x55, 0xfb,
      0x96, 0xe4, 0x54, 0xd4, 0x80, 0x18, 0x16, 0x00, 0x34, 0x9f, 0xd8, 0xdc,
      0x12, 0x51, 0x46, 0x30, 0x44, 0x02, 0x20, 0x7e, 0x3c, 0xdd, 0x1d, 0x15,
      0x08, 0xf6, 0x8d, 0x16, 0x63, 0x4a, 0x3a, 0x1e, 0xe1, 0x97, 0xc4, 0x50,
      0xc9, 0x17, 0x65, 0xe5, 0xe2, 0x48, 0x24, 0x17, 0xb2, 0x5e, 0xe3, 0xa0,
      0x19, 0x81, 0xc8, 0x02, 0x20, 0x59, 0x79, 0x5d, 0x09, 0x29, 0xc7, 0xd8,
      0x4b, 0xad, 0xad, 0xe5, 0x05, 0x0e, 0x3b, 0x21, 0x19, 0x7d, 0xaa, 0xff,
      0xa3, 0x29, 0xea, 0x07, 0xd5, 0xb4, 0x29, 0x1c, 0xa6, 0xe9, 0x2a, 0x72,
      0xd9,
    ]);

    sendApduFn.mockResolvedValue(
      Right({
        data: mockResponse,
        statusCode: new Uint8Array([0x90, 0x00]),
      }),
    );

    // Mock crypto service
    const mockDeviceId = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);
    const mockCryptoService = {
      sha3_256: vi.fn().mockReturnValue(mockDeviceId),
    };

    const taskWithMockCrypto = new ConnectToSecureChannelTask(mockInternalApi, {
      connection: Right(mockWebSocket),
      cryptoService: mockCryptoService,
    });

    const events: SecureChannelEvent[] = [];
    const obs = taskWithMockCrypto.run();
    obs.subscribe({
      next: (event) => {
        events.push(event);
      },
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    // Send GetCertificate APDU (e052000000)
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "exchange",
        nonce: 1,
        data: "e052000000",
      }),
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    // Verify the mock crypto service was called
    expect(mockCryptoService.sha3_256).toHaveBeenCalledWith(
      Uint8Array.from([
        0x04, 0x1c, 0x74, 0x7a, 0x4e, 0x08, 0x1b, 0x5c, 0x1e, 0xd0, 0x27, 0xfc,
        0xaf, 0x80, 0xda, 0xda, 0x1f, 0x84, 0xfc, 0x8e, 0x43, 0x60, 0xcb, 0x53,
        0xc4, 0xb6, 0x9e, 0x63, 0xcb, 0x91, 0xb7, 0xca, 0xd3, 0x15, 0x63, 0x68,
        0x59, 0x1b, 0xfb, 0x05, 0x8f, 0x72, 0x0f, 0x97, 0xaf, 0xc4, 0x73, 0xf9,
        0x78, 0x55, 0xfb, 0x96, 0xe4, 0x54, 0xd4, 0x80, 0x18, 0x16, 0x00, 0x34,
        0x9f, 0xd8, 0xdc, 0x12, 0x51,
      ]),
    );

    // Verify the device ID from the mock crypto service was emitted
    const deviceIdEvent = events.find(
      (e) => e.type === SecureChannelEventType.DeviceId,
    );
    expect(deviceIdEvent).toBeDefined();
    expect(deviceIdEvent?.payload?.deviceId).toBe(mockDeviceId);
  });

  it("should handle incoming EXCHANGE message with a device error", async () => {
    sendApduFn.mockResolvedValue(
      Right({
        data: new Uint8Array([]),
        statusCode: new Uint8Array([0x55, 0x15]),
      }),
    );

    const sendSpy = vi.spyOn(mockWebSocket, "send");
    const events: SecureChannelEvent[] = [];
    const obs = task.run();
    obs.subscribe({
      next: (event) => {
        events.push(event);
      },
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "exchange",
        nonce: 1,
        data: "e053000000",
      }),
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(sendSpy).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        nonce: 1,
        response: "error",
        data: "",
      }),
    );
    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.PreExchange,
        payload: {
          nonce: 1,
          apdu: new Uint8Array([0xe0, 0x53, 0x00, 0x00, 0x00]),
        },
      },
      {
        type: SecureChannelEventType.Error,
        error: new SecureChannelError(
          {
            url: "wss://test-host.com",
            errorMessage: "Device is locked",
          },
          SecureChannelErrorType.DeviceLocked,
        ),
      },
    ]);
  });

  it("should handle incoming BULK message", async () => {
    sendApduFn.mockResolvedValue(
      Right({
        data: new Uint8Array([0x90, 0x00]),
        statusCode: new Uint8Array([0x90, 0x00]),
      }),
    );
    const completeFn: () => void = vi.fn();
    const obs = task.run();
    const events: SecureChannelEvent[] = [];
    obs.subscribe({
      next: (event: SecureChannelEvent) => {
        events.push(event);
      },
      complete: () => completeFn(),
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "bulk",
        nonce: 1,
        data: ["0000000100", "0000000200", "0000000300"],
      }),
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(sendApduFn).toHaveBeenCalledTimes(3);
    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.Progress,
        payload: { progress: 0.33, index: 0, total: 3 },
      },
      {
        type: SecureChannelEventType.Progress,
        payload: { progress: 0.67, index: 1, total: 3 },
      },
      {
        type: SecureChannelEventType.Progress,
        payload: { progress: 1.0, index: 2, total: 3 },
      },
    ]);
    expect(completeFn).toHaveBeenCalledOnce();
  });

  it("should handle incoming BULK message with a device error", async () => {
    sendApduFn.mockResolvedValue(
      Right({
        data: new Uint8Array([]),
        statusCode: new Uint8Array([0x55, 0x01]),
      }),
    );
    const completeFn: () => void = vi.fn();
    const obs = task.run();
    const events: SecureChannelEvent[] = [];
    obs.subscribe({
      next: (event: SecureChannelEvent) => {
        events.push(event);
      },
      complete: () => completeFn(),
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "bulk",
        nonce: 1,
        data: ["0000000100", "0000000200", "0000000300"],
      }),
      type: "",
      target: {} as WebSocket,
    });

    await new Promise((resolve) => setTimeout(resolve, TEST_DELAY));

    expect(sendApduFn).toHaveBeenCalledTimes(1);
    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.Error,
        error: new SecureChannelError(
          {
            url: "wss://test-host.com",
            errorMessage: "User refused on the device",
          },
          SecureChannelErrorType.RefusedByUser,
        ),
      },
    ]);
    expect(completeFn).toHaveBeenCalledOnce();
  });

  it("should handle incoming SUCCESS message", () => {
    const completeFn: () => void = vi.fn();
    const events: SecureChannelEvent[] = [];
    const observable = task.run();
    observable.subscribe({
      next: (event: SecureChannelEvent) => events.push(event),
      complete: () => completeFn(),
    });

    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "success",
        nonce: 1,
        result: "success result",
      }),
      type: "",
      target: {} as WebSocket,
    });

    expect(events).toStrictEqual([
      { type: SecureChannelEventType.Result, payload: "success result" },
    ]);
    expect(completeFn).toHaveBeenCalledOnce();
  });

  it("should handle incoming WARNING message", () => {
    const events: SecureChannelEvent[] = [];
    const observable = task.run();
    observable.subscribe({
      next: (event: SecureChannelEvent) => events.push(event),
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "warning",
        nonce: 1,
        data: "warning message",
      }),
      type: "",
      target: {} as WebSocket,
    });

    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.Warning,
        payload: { message: "warning message" },
      },
    ]);
  });

  it("should handle incoming ERROR message", () => {
    const events: SecureChannelEvent[] = [];
    const observable = task.run();
    observable.subscribe({
      next: (event: SecureChannelEvent) => events.push(event),
    });

    expect(mockWebSocket.onmessage).toBeDefined();
    mockWebSocket.onmessage!({
      data: JSON.stringify({
        ...mockMessage,
        query: "error",
        data: "My error",
      }),
      type: "",
      target: {} as WebSocket,
    });

    expect(events).toStrictEqual([
      {
        type: SecureChannelEventType.Error,
        error: new SecureChannelError({
          url: "wss://test-host.com",
          errorMessage: "My error",
        }),
      },
    ]);
  });
});

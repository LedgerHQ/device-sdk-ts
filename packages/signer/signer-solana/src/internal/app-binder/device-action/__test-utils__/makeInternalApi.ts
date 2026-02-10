import { type InternalApi } from "@ledgerhq/device-management-kit";
import { type Mocked } from "vitest";

export function makeDeviceActionInternalApiMock(): Mocked<InternalApi> {
  return {
    sendApdu: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue(undefined),
    getDeviceModel: vi.fn(),
    getDeviceSessionState: vi.fn(),
    getDeviceSessionStateObservable: vi.fn(),
    setDeviceSessionState: vi.fn(),
    getManagerApiService: vi.fn(),
    getSecureChannelService: vi.fn(),
    loggerFactory: vi.fn((_tag: string) => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      subscribers: [],
    })),
  };
}

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
    disableRefresher: vi.fn(),
    exchangeBulkApdus: vi.fn(),
  };
}

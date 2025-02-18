import { type Mocked } from "vitest";

import { type InternalApi } from "@api/device-action/DeviceAction";

const sendApduMock = vi.fn();
const sendCommandMock = vi.fn();
const apiGetDeviceSessionStateMock = vi.fn();
const apiGetDeviceSessionStateObservableMock = vi.fn();
const setDeviceSessionStateMock = vi.fn();
const getManagerApiServiceMock = vi.fn();
const getSecureChannelServiceMock = vi.fn();

export function makeDeviceActionInternalApiMock(): Mocked<InternalApi> {
  return {
    sendApdu: sendApduMock,
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
    setDeviceSessionState: setDeviceSessionStateMock,
    getManagerApiService: getManagerApiServiceMock,
    getSecureChannelService: getSecureChannelServiceMock,
  };
}

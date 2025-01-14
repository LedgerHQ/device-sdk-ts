import { type InternalApi } from "@ledgerhq/device-management-kit";

const sendCommandMock = vi.fn();
const apiGetDeviceSessionStateMock = vi.fn();
const apiGetDeviceSessionStateObservableMock = vi.fn();
const setDeviceSessionStateMock = vi.fn();
const getManagerApiServiceMock = vi.fn();

export function makeDeviceActionInternalApiMock(): vi.Mocked<InternalApi> {
  return {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
    setDeviceSessionState: setDeviceSessionStateMock,
    getManagerApiService: getManagerApiServiceMock,
  };
}

import { type InternalApi } from "@api/device-action/DeviceAction";

const sendCommandMock = jest.fn();
const apiGetDeviceSessionStateMock = jest.fn();
const apiGetDeviceSessionStateObservableMock = jest.fn();
const setDeviceSessionStateMock = jest.fn();
const getManagerApiServiceMock = jest.fn();

export function makeDeviceActionInternalApiMock(): jest.Mocked<InternalApi> {
  return {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
    setDeviceSessionState: setDeviceSessionStateMock,
    getManagerApiService: getManagerApiServiceMock,
  };
}

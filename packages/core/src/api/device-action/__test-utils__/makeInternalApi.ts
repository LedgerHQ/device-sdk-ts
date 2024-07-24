import { InternalApi } from "@api/device-action/DeviceAction";
import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";

const sendCommandMock = jest.fn();
const apiGetDeviceSessionStateMock = jest.fn();
const apiGetDeviceSessionStateObservableMock = jest.fn();
const setDeviceSessionStateMock = jest.fn();
const managerApiServiceMock = jest.fn() as unknown as ManagerApiService;

export function makeInternalApiMock(): jest.Mocked<InternalApi> {
  return {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
    setDeviceSessionState: setDeviceSessionStateMock,
    managerApiService: managerApiServiceMock,
  };
}

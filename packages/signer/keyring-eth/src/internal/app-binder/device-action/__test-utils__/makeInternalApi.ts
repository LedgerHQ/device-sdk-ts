import { InternalApi } from "@ledgerhq/device-sdk-core";

const sendCommandMock = jest.fn();
const apiGetDeviceSessionStateMock = jest.fn();
const apiGetDeviceSessionStateObservableMock = jest.fn();
const setDeviceSessionStateMock = jest.fn();
const getMetadataForAppHashesMock = jest.fn();

export function makeDeviceActionInternalApiMock(): jest.Mocked<InternalApi> {
  return {
    sendCommand: sendCommandMock,
    getDeviceSessionState: apiGetDeviceSessionStateMock,
    getDeviceSessionStateObservable: apiGetDeviceSessionStateObservableMock,
    setDeviceSessionState: setDeviceSessionStateMock,
    getMetadataForAppHashes: getMetadataForAppHashesMock,
  };
}

export const discoveryTypes = {
  StartDiscoveringUseCase: Symbol.for("StartDiscoveringUseCase"),
  StopDiscoveringUseCase: Symbol.for("StopDiscoveringUseCase"),
  ConnectUseCase: Symbol.for("ConnectUseCase"),
  DisconnectUseCase: Symbol.for("DisconnectUseCase"),
  GetConnectedDeviceUseCase: Symbol.for("GetConnectedDeviceUseCase"),
  ListenToAvailableDevicesUseCase: Symbol.for(
    "ListenToAvailableDevicesUseCase",
  ),
  ListenToConnectedDeviceUseCase: Symbol.for("ListenToConnectedDeviceUseCase"),
  ListConnectedDevicesUseCase: Symbol.for("ListConnectedDevicesUseCase"),
  ReconnectUseCase: Symbol.for("ReconnectUseCase"),
};

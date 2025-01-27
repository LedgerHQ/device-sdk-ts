export const deviceSessionTypes = {
  ApduSenderServiceFactory: Symbol.for("ApduSenderServiceFactory"),
  ApduReceiverServiceFactory: Symbol.for("ApduReceiverServiceFactory"),
  DeviceSessionService: Symbol.for("DeviceSessionService"),
  GetDeviceSessionStateUseCase: Symbol.for("GetDeviceSessionStateUseCase"),
  ToggleDeviceSessionRefresherUseCase: Symbol.for(
    "ToggleDeviceSessionRefresherUseCase",
  ),
  CloseSessionsUseCase: Symbol.for("CloseSessionsUseCase"),
};

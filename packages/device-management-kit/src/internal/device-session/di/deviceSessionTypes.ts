export const deviceSessionTypes = {
  ApduSenderServiceFactory: Symbol.for("ApduSenderServiceFactory"),
  ApduReceiverServiceFactory: Symbol.for("ApduReceiverServiceFactory"),
  DeviceSessionService: Symbol.for("DeviceSessionService"),
  GetDeviceSessionStateUseCase: Symbol.for("GetDeviceSessionStateUseCase"),
  DisableDeviceSessionRefresherUseCase: Symbol.for(
    "DisableDeviceSessionRefresherUseCase",
  ),
  CloseSessionsUseCase: Symbol.for("CloseSessionsUseCase"),
  UnsafeBypassIntentQueueUseCase: Symbol.for("UnsafeBypassIntentQueueUseCase"),
};

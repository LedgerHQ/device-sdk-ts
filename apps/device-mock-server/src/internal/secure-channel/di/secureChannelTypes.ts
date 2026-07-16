export const secureChannelTypes = {
  ApduService: Symbol.for("SecureChannelApduService"),
  WebSocket: Symbol.for("SecureChannelWebSocket"),
  InstallAppResolver: Symbol.for("InstallAppResolver"),
  FirmwareUpdateResolver: Symbol.for("FirmwareUpdateResolver"),
};

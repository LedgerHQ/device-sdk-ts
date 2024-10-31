// [SHOULD] Move it to device-model module
export const LEDGER_VENDOR_ID = 0x2c97;
export const FRAME_SIZE = 64;
export const RECONNECT_DEVICE_TIMEOUT = 6000; // in some cases, when opening/closing an app, it takes up to 6s between the HID "disconnect" and "connect" events

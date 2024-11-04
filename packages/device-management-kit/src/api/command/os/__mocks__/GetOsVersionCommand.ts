import { DeviceModelId } from "@api/device/DeviceModel";
import { type GetOsVersionResponse } from "@api/index";

export const getOsVersionCommandResponseStubBuilder = (
  deviceModelId: DeviceModelId = DeviceModelId.NANO_SP,
  props: Partial<GetOsVersionResponse> = {},
): GetOsVersionResponse =>
  ({
    [DeviceModelId.NANO_SP]: {
      targetId: 856686596,
      seVersion: "1.1.1",
      seFlags: 3858759680,
      mcuSephVersion: "4.03",
      mcuBootloaderVersion: "3.12",
      hwVersion: "00",
      langId: "00",
      recoverState: "00",
      ...props,
    },
    [DeviceModelId.NANO_S]: {
      targetId: 858783748,
      seVersion: "1.1.1",
      seFlags: 3858759680,
      mcuSephVersion: "6.4.0",
      mcuBootloaderVersion: "5.4.0",
      hwVersion: "00",
      langId: "00",
      recoverState: "00",
      ...props,
    },
    [DeviceModelId.NANO_X]: {
      targetId: 855638020,
      seVersion: "2.2.3",
      seFlags: 3858759680,
      mcuSephVersion: "2.30",
      mcuBootloaderVersion: "1.16",
      hwVersion: "00",
      langId: "00",
      recoverState: "00",
    },
    [DeviceModelId.STAX]: {
      targetId: 857735172,
      seVersion: "1.3.0",
      seFlags: 3858759680,
      mcuSephVersion: "5.24",
      mcuBootloaderVersion: "0.48",
      hwVersion: "00",
      langId: "00",
      recoverState: "00",
      ...props,
    },
    [DeviceModelId.FLEX]: {
      targetId: 858783748,
      seVersion: "1.1.1",
      seFlags: 3858759680,
      mcuSephVersion: "6.4.0",
      mcuBootloaderVersion: "5.4.0",
      hwVersion: "00",
      langId: "00",
      recoverState: "00",
      ...props,
    },
  })[deviceModelId];

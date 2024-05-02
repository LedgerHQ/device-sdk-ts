export enum DeviceModelId {
  NANO_S = "nanoS",
  NANO_SP = "nanoSP",
  NANO_X = "nanoX",
  STAX = "stax",
}

export type DeviceId = string;

export class DeviceModel {
  constructor(
    public id: DeviceId,
    public model: DeviceModelId,
    public name: string,
  ) {}
}

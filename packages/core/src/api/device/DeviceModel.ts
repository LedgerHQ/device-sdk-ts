export enum DeviceModelId {
  NANO_S = "nanoS",
  NANO_SP = "nanoSP",
  NANO_X = "nanoX",
  STAX = "stax",
}

/**
 * Unique identifier for a device.
 *
 * NB: This identifier is generated at runtime and is not persisted. It cannot
 * be used to identify a device across sessions.
 * There is in fact no way to identify a device across sessions, which is a
 * privacy feature of Ledger devices.
 */
export type DeviceId = string;

export type DeviceModelArgs = {
  id: DeviceId;
  model: DeviceModelId;
  name: string;
};

export class DeviceModel {
  public id: DeviceId;
  public model: DeviceModelId;
  public name: string;

  constructor({ id, model, name }: DeviceModelArgs) {
    this.id = id;
    this.model = model;
    this.name = name;
  }
}

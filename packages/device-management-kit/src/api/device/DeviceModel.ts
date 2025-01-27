export enum DeviceModelId {
  NANO_S = "nanoS",
  NANO_SP = "nanoSP",
  NANO_X = "nanoX",
  STAX = "stax",
  FLEX = "flex",
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
  readonly id: DeviceId;
  readonly model: DeviceModelId;
  readonly name: string;
};

export class DeviceModel {
  public readonly id: DeviceId;
  public readonly model: DeviceModelId;
  public readonly name: string;

  constructor({ id, model, name }: DeviceModelArgs) {
    this.id = id;
    this.model = model;
    this.name = name;
  }
}

export const LEDGER_VENDOR_ID = 0x2c97;

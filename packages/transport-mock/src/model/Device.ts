export type DeviceArgs = {
  readonly id: string;
  readonly name: string;
  readonly device_type: string;
  readonly connectivity_type: string;
};

export class Device {
  readonly id: string;
  readonly name: string;
  readonly device_type: string;
  readonly connectivity_type: string;

  constructor({ id, name, device_type, connectivity_type }: DeviceArgs) {
    this.id = id;
    this.name = name;
    this.device_type = device_type;
    this.connectivity_type = connectivity_type;
  }
}

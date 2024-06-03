export class Device {
  id: string;
  name: string;
  device_type: string;
  connectivity_type: string;

  constructor(
    id: string,
    name: string,
    device_type: string,
    connectivity_type: string,
  ) {
    this.id = id;
    this.name = name;
    this.device_type = device_type;
    this.connectivity_type = connectivity_type;
  }
}

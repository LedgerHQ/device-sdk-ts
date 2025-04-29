export class CharacteristicIO {
  constructor(
    private _write: BluetoothRemoteGATTCharacteristic,
    private _notify: BluetoothRemoteGATTCharacteristic,
  ) {}

  async writeValue(buf: ArrayBuffer) {
    await this._write.writeValueWithoutResponse(buf);
  }

  private handler: ((e: Event) => void) | null = null;

  onValueChanged(l: (e: Event) => void) {
    this.offValueChanged();
    this.handler = l;
    this._notify.oncharacteristicvaluechanged = l;
    this._notify.addEventListener("characteristicvaluechanged", l);
  }

  offValueChanged() {
    if (this.handler) {
      this._notify.oncharacteristicvaluechanged = () => {};
      this._notify.removeEventListener(
        "characteristicvaluechanged",
        this.handler,
      );
      this.handler = null;
    }
  }

  set notify(c: BluetoothRemoteGATTCharacteristic) {
    this.offValueChanged();
    this._notify = c;
    if (this.handler) {
      this._notify.oncharacteristicvaluechanged = this.handler;
      this._notify.addEventListener("characteristicvaluechanged", this.handler);
    }
  }
  get notify() {
    return this._notify;
  }

  set write(c: BluetoothRemoteGATTCharacteristic) {
    this._write = c;
  }

  async startNotifications() {
    try {
      await this._notify.startNotifications();
    } catch {
      await this._notify.service.device.gatt!.connect();
      await this._notify.startNotifications();
    }
  }
}

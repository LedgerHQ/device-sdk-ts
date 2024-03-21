import { inject, injectable } from "inversify";

// import { switchMap, tap } from "rxjs";
import { DiscoveredDevice } from "@api/index";
import { discoveryTypes } from "@internal/discovery/di/discoveryTypes";
import { StartDiscoveringUseCase } from "@internal/discovery/use-case/StartDiscoveringUseCase";
import { StopDiscoveringUseCase } from "@internal/discovery/use-case/StopDiscoveringUseCase";

const initialAcc = {
  data: new Uint8Array(0),
  dataLength: 0,
  sequence: 0,
};
type ResponseAcc = typeof initialAcc;

@injectable()
export class HackathonService {
  connectedDevice: HIDDevice | undefined;
  discoveredDevice: DiscoveredDevice | undefined;
  acc: ResponseAcc | undefined;
  result: Uint8Array | undefined;
  resolver: ((value: unknown) => void) | undefined;
  constructor(
    @inject(discoveryTypes.StartDiscoveringUseCase)
    private startDiscoveringUseCase: StartDiscoveringUseCase,
    @inject(discoveryTypes.StopDiscoveringUseCase)
    private stopDiscoveringUseCase: StopDiscoveringUseCase,
  ) {
    if ("hid" in navigator) {
      navigator.hid.addEventListener("connect", (event) => {
        const { device } = event;
        console.log(`📡 Received a connect event on ${device.productName}`);
      });

      navigator.hid.addEventListener("disconnect", (event) => {
        const { device } = event;
        console.log(`📡 Received a disconnect event on ${device.productName}`);
      });
    }
  }

  static getReducedResult = (acc?: ResponseAcc): Uint8Array | undefined => {
    if (acc && acc.dataLength === acc.data.length) {
      return acc.data;
    }

    return;
  };

  static concatTypedArray = (a: Uint8Array, b: Uint8Array) => {
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  };

  static toHexString = (bytes: Uint8Array) =>
    bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

  static reduceResponse = (
    acc: ResponseAcc | undefined,
    chunk: Uint8Array,
  ): ResponseAcc => {
    let { data, dataLength, sequence } = acc ?? initialAcc;

    // Gets the total length of the response from the 1st frame
    if (!acc) {
      const sliced = HackathonService.toHexString(chunk.slice(5, 7));
      dataLength = Number("0x" + sliced);
    }

    sequence++;
    // The total length on the 1st frame takes 2 more bytes
    const chunkData = chunk.slice(acc ? 5 : 7);
    data = HackathonService.concatTypedArray(data, chunkData);

    // // Removes any 0 padding
    if (data.length > dataLength) {
      data = data.slice(0, dataLength);
    }

    return {
      data,
      dataLength,
      sequence,
    };
  };

  listener = (event: HIDInputReportEvent) => {
    const { data } = event;
    const response = new Uint8Array(data.buffer);
    this.acc = HackathonService.reduceResponse(this.acc, response);
    this.result = HackathonService.getReducedResult(this.acc);

    if (this.result) {
      const sliced = HackathonService.toHexString(this.result.slice(0, 1));
      const pubKeyLength = Number("0x" + sliced);

      const pubKeySliced = this.result.slice(1, 1 + pubKeyLength);
      const pubKey = HackathonService.toHexString(pubKeySliced);

      const slicedAdressLength = this.result.slice(
        pubKeyLength + 1,
        pubKeyLength + 2,
      );
      const addressLength = Number(
        "0x" + HackathonService.toHexString(slicedAdressLength),
      );
      const address = this.result.slice(
        pubKeyLength + 2,
        pubKeyLength + 2 + addressLength,
      );

      const asciiString = new TextDecoder().decode(address);
      if (!this.resolver) return;

      this.resolver({
        pubKey,
        ethAddress: `0x${asciiString}`,
      });
    }
  };

  addListener() {
    if (!this.connectedDevice) return;
    this.connectedDevice.addEventListener("inputreport", this.listener);
  }

  removeListener() {
    if (!this.connectedDevice) return;
    this.connectedDevice.removeEventListener("inputreport", this.listener);
  }

  async discover() {
    return new Promise((res, rej) => {
      this.startDiscoveringUseCase.execute().subscribe({
        next: (device) => {
          this.discoveredDevice = device;
          this.connect()
            .then(() => {
              res(undefined);
            })
            .catch((err) => console.log(err));
        },
        complete: () => {
          this.stopDiscoveringUseCase.execute();
        },
        error: (error) => {
          rej(error);
          console.error(error);
        },
      });
    });
  }

  async connect() {
    if (navigator && "hid" in navigator) {
      const [d] = await navigator.hid.getDevices();
      if (!d) return;
      this.connectedDevice = d;
      this.addListener();
    }
  }

  async getEthAddress() {
    if (!this.connectedDevice) return;

    if (!this.connectedDevice.opened) {
      await this.connectedDevice.open();
    }

    this.acc = undefined;
    this.result = undefined;

    const ethAddressApdu = new Uint8Array([
      0xe0, 0x02, 0x00, 0x00, 0x1d, 0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00,
      0x00, 0x3c, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
    ]);

    const header = new Uint8Array([
      0xaa,
      0xaa,
      0x05,
      0x00,
      0x00,
      0x00,
      ethAddressApdu.length,
    ]);

    const fullAPDU = new Uint8Array(header.length + ethAddressApdu.length);
    fullAPDU.set(header, 0);
    fullAPDU.set(ethAddressApdu, header.length);
    await this.connectedDevice.sendReport(0, fullAPDU);
    return new Promise((resolver) => {
      this.resolver = resolver;
    });
  }

  disconnect() {
    this.connectedDevice = undefined;
    this.acc = undefined;
    this.result = undefined;
  }
}
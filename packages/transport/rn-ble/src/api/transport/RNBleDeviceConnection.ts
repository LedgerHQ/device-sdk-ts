import { type Characteristic } from "react-native-ble-plx";
import {
  type ApduReceiverService,
  type ApduReceiverServiceFactory,
  type ApduResponse,
  type ApduSenderService,
  type ApduSenderServiceFactory,
  type DeviceConnection,
  DeviceNotInitializedError,
  type DmkError,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Base64 } from "js-base64";
import { type Either, Left, Maybe, Nothing, Right } from "purify-ts";

type RNBleDeviceConnectionConstructorArgs = {
  onWrite: (value: string) => Promise<Characteristic>;
  apduSenderFactory: ApduSenderServiceFactory;
  apduReceiverFactory: ApduReceiverServiceFactory;
};

export class RNBleDeviceConnection implements DeviceConnection {
  private _isDeviceReady: boolean;
  private _logger: LoggerPublisherService;
  private _apduSender: Maybe<ApduSenderService>;
  private readonly _apduSenderFactory: ApduSenderServiceFactory;
  private readonly _apduReceiver: ApduReceiverService;
  private _sendApduPromiseResolver: Maybe<
    (value: Either<DmkError, ApduResponse>) => void
  >;
  private _onWrite: (value: string) => Promise<Characteristic>;

  constructor(
    {
      onWrite,
      apduSenderFactory,
      apduReceiverFactory,
    }: RNBleDeviceConnectionConstructorArgs,
    loggerServiceFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._isDeviceReady = false;
    this._logger = loggerServiceFactory("RNBleDeviceConnection");
    this._apduSenderFactory = apduSenderFactory;
    this._apduSender = Nothing;
    this._apduReceiver = apduReceiverFactory();
    this._sendApduPromiseResolver = Nothing;
    this._onWrite = onWrite;
  }

  private onReceiveSetupApduResponse(value: Uint8Array) {
    const mtuResponse = new Uint8Array(value);
    // the mtu is the 5th byte of the response
    const [frameSize] = mtuResponse.slice(5);
    if (frameSize) {
      this._apduSender = Maybe.of(this._apduSenderFactory({ frameSize }));
      this._isDeviceReady = true;
    }
  }

  private receiveApdu(apdu: Uint8Array) {
    const response = this._apduReceiver.handleFrame(apdu);

    response.map((maybeApduResponse) => {
      maybeApduResponse.map((apduResponse) => {
        this._logger.debug("Received APDU Response", {
          data: { response: apduResponse },
        });
        this._sendApduPromiseResolver.map((resolve) =>
          resolve(Right(apduResponse)),
        );
      });
    });
  }

  set onWrite(onWrite: (value: string) => Promise<Characteristic>) {
    this._onWrite = onWrite;
  }

  onMonitor(characteristic: Characteristic) {
    if (!characteristic.value) {
      return;
    }

    const apdu = Base64.toUint8Array(characteristic.value);

    if (!this._isDeviceReady) {
      this.onReceiveSetupApduResponse(apdu);
    } else {
      this.receiveApdu(apdu);
    }
  }

  public async setup() {
    const requestMtuApdu = Uint8Array.from([0x08, 0x00, 0x00, 0x00, 0x00]);

    await this._onWrite(Base64.fromUint8Array(requestMtuApdu));
  }

  async sendApdu(
    apdu: Uint8Array,
    _triggersDisconnection?: boolean,
  ): Promise<Either<DmkError, ApduResponse>> {
    if (!this._isDeviceReady) {
      return Promise.resolve(
        Left(new DeviceNotInitializedError("Unknown MTU")),
      );
    }
    const resultPromise = new Promise<Either<DmkError, ApduResponse>>(
      (resolve) => {
        this._sendApduPromiseResolver = Maybe.of(resolve);
      },
    );

    const frames = this._apduSender.caseOf({
      Just: (apduSender) => apduSender.getFrames(apdu),
      Nothing: () => [],
    });

    for (const frame of frames) {
      try {
        await this._onWrite(Base64.fromUint8Array(frame.getRawData()));
      } catch (error) {
        this._logger.error("Error sending frame", { data: { error } });
      }
    }

    const response = await resultPromise;

    this._sendApduPromiseResolver = Maybe.zero();

    return response.caseOf({
      Right: (apduResponse) => {
        return Promise.resolve(Right(apduResponse));
      },
      Left: async (error) => Promise.resolve(Left(error)),
    });
  }
}

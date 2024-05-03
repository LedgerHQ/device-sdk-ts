import { audit, interval, skipWhile, Subscription, switchMap } from "rxjs";

import {
  GetAppAndVersionCommand,
  GetAppAndVersionResponse,
} from "@api/command/os/GetAppAndVersionCommand";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { ReadyWithoutSecureChannelState } from "@api/session/SessionDeviceState";

import { Session } from "./Session";

export const DEVICE_OS_NAME = "BOLOS";

export class SeesionRefresher {
  private _subscription: Subscription | null = null;
  private readonly command: GetAppAndVersionCommand;

  constructor(
    private readonly session: Session,
    private readonly refreshInterval: number,
  ) {
    this.command = new GetAppAndVersionCommand();
  }

  start(): void {
    this._subscription = this.session.state
      .pipe(
        audit(() => interval(this.refreshInterval)),
        skipWhile((state) => state.deviceStatus === DeviceStatus.BUSY),
        switchMap(() => {
          const rawApdu = this.command.getApdu().getRawApdu();
          return this.session.sendApdu(rawApdu);
        }),
      )
      .subscribe({
        next: (response) => {
          response
            .ifRight((data) => {
              try {
                const { name }: GetAppAndVersionResponse =
                  this.command.parseResponse(data);
                if (name === DEVICE_OS_NAME) {
                  // await this.session.connectedDevice.sendApdu(
                  //   new GetOsVersionCommand().getApdu().getRawApdu(),
                  // );
                } else {
                  this.session.setState(
                    new ReadyWithoutSecureChannelState({
                      sessionId: this.session.id,
                      currentApp: name,
                    }),
                  );
                }
              } catch (error) {
                console.error("Error in response", error);
              }
            })
            .ifLeft(() => {
              console.log("Error in response");
            });
        },
        error: (error) => {
          this.restart();
          console.error("Error", error);
        },
        complete: () => {
          console.log("Complete");
        },
      });
  }

  stop(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
    }
  }

  restart(): void {
    this.stop();
    this.start();
  }
}

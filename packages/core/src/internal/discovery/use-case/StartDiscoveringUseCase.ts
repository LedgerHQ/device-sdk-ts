import { inject, injectable } from "inversify";
import { map, mergeMap, Observable, of } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
import type { TransportService } from "@internal/transport/service/TransportService";

export type StartDiscoveringUseCaseArgs = {
  /**
   * Identifier of the transport to start discovering devices.
   * Can be undefined to discover all available transports in parralel.
   */
  transport?: TransportIdentifier;
};

/**
 * Starts discovering devices connected.
 *
 * For the WebHID implementation, this use-case needs to be called as a result of an user interaction (button "click" event for ex).
 */
@injectable()
export class StartDiscoveringUseCase {
  constructor(
    @inject(transportDiTypes.TransportService)
    private _transportService: TransportService,
  ) {}

  private mapDiscoveredDevice(
    device: InternalDiscoveredDevice,
  ): DiscoveredDevice {
    const deviceModel = new DeviceModel({
      id: device.id,
      model: device.deviceModel.id,
      name: device.deviceModel.productName,
    });
    return {
      id: device.id,
      deviceModel,
      transport: device.transport,
    };
  }

  execute({
    transport,
  }: StartDiscoveringUseCaseArgs): Observable<DiscoveredDevice> {
    console.log(
      "startDiscoveringUseCase",
      this._transportService.getTransports(),
    );
    if (transport) {
      const instance = this._transportService
        .getTransportById(transport)
        .mapLeft((error) => {
          throw error;
        })
        .extract();
      return instance
        .startDiscovering()
        .pipe(map((device) => this.mapDiscoveredDevice(device)));
    } else {
      // Discover from all transports in parallel
      return of(...this._transportService.getTransports()).pipe(
        mergeMap((instance) =>
          instance
            .startDiscovering()
            .pipe(map((device) => this.mapDiscoveredDevice(device))),
        ),
      );
    }
  }
}

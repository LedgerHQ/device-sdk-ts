import { injectable, multiInject } from "inversify";
import { map, mergeMap, Observable, of } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { TransportNotSupportedError } from "@api/transport/model/Errors";
import type { Transport } from "@api/transport/model/Transport";
import { TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

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
    @multiInject(transportDiTypes.Transport)
    private transports: Transport[],
  ) {}

  private mapDiscoveredDevice(
    device: TransportDiscoveredDevice,
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
    if (transport) {
      const instance = this.transports.find(
        (t) => t.getIdentifier() === transport,
      );
      if (!instance) {
        throw new TransportNotSupportedError(new Error("Unknown transport"));
      }
      return instance
        .startDiscovering()
        .pipe(map((device) => this.mapDiscoveredDevice(device)));
    } else {
      // Discover from all transports in parallel
      return of(...this.transports).pipe(
        mergeMap((instance) =>
          instance
            .startDiscovering()
            .pipe(map((device) => this.mapDiscoveredDevice(device))),
        ),
      );
    }
  }
}

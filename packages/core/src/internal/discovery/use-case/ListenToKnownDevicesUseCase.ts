import { inject, injectable } from "inversify";
import { from, map, merge, Observable, scan } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import type { Transport } from "@api/transport/model/Transport";
import { TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { DiscoveredDevice } from "@api/types";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { TransportService } from "@internal/transport/service/TransportService";

/**
 * Listen to list of known discovered devices (and later BLE).
 */
@injectable()
export class ListenToKnownDevicesUseCase {
  private readonly _transports: Transport[];
  constructor(
    @inject(transportDiTypes.TransportService)
    transportService: TransportService,
  ) {
    this._transports = transportService.getAllTransports();
  }

  private mapTransportDiscoveredDeviceToDiscoveredDevice(
    discoveredDevice: TransportDiscoveredDevice,
  ): DiscoveredDevice {
    return {
      id: discoveredDevice.id,
      deviceModel: new DeviceModel({
        id: discoveredDevice.id,
        model: discoveredDevice.deviceModel.id,
        name: discoveredDevice.deviceModel.productName,
      }),
      transport: discoveredDevice.transport,
    };
  }

  execute(): Observable<DiscoveredDevice[]> {
    if (this._transports.length === 0) {
      return from([[]]);
    }

    /**
     * Note: we're not using combineLatest because combineLatest will
     * - wait for all observables to emit at least once before emitting.
     * - complete as soon as one of the observables completes.
     * Some transports will just return an empty array and complete.
     * We want to keep listening to all transports until all have completed.
     */

    const observablesWithIndex = this._transports.map((transport, index) =>
      transport.listenToKnownDevices().pipe(
        map((arr) => ({
          index,
          arr,
        })),
      ),
    );

    return merge(...observablesWithIndex).pipe(
      scan<
        { index: number; arr: TransportDiscoveredDevice[] },
        { [key: number]: TransportDiscoveredDevice[] }
      >((acc, { index, arr }) => {
        acc[index] = arr;
        return acc;
      }, {}),
      map((acc) =>
        Object.values(acc)
          .flat()
          .map(this.mapTransportDiscoveredDeviceToDiscoveredDevice),
      ),
    );
  }
}

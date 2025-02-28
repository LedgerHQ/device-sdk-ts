import { inject, injectable } from "inversify";
import { from, map, merge, Observable, of, scan } from "rxjs";

import { DeviceModel } from "@api/device/DeviceModel";
import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
import { type Transport } from "@api/transport/model/Transport";
import { type TransportDiscoveredDevice } from "@api/transport/model/TransportDiscoveredDevice";
import { type TransportIdentifier } from "@api/transport/model/TransportIdentifier";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";
import { type TransportService } from "@internal/transport/service/TransportService";

export type ListenToAvailableDevicesUseCaseArgs = {
  /**
   * Identifier of the transport to start discovering devices.
   * Can be undefined to discover all available transports in parallel.
   */
  transport?: TransportIdentifier;
};

/**
 * Listen to list of known discovered devices (and later BLE).
 */
@injectable()
export class ListenToAvailableDevicesUseCase {
  private readonly _transports: Transport[];
  private readonly _transportService: TransportService;
  private readonly _logger: LoggerPublisherService;
  constructor(
    @inject(transportDiTypes.TransportService)
    transportService: TransportService,
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._transports = transportService.getAllTransports();
    this._transportService = transportService;
    this._logger = loggerFactory("ListenToAvailableDevicesUseCase");
  }

  private mapTransportDiscoveredDeviceToDiscoveredDevice(
    discoveredDevice: TransportDiscoveredDevice,
  ): DiscoveredDevice {
    const deviceModel = new DeviceModel({
      id: discoveredDevice.id,
      model: discoveredDevice.deviceModel.id,
      name: discoveredDevice.deviceModel.productName,
    });
    return {
      id: discoveredDevice.id,
      deviceModel,
      transport: discoveredDevice.transport,
      name: discoveredDevice.name || deviceModel.name,
      rssi: discoveredDevice.rssi,
    };
  }

  execute({
    transport,
  }: ListenToAvailableDevicesUseCaseArgs): Observable<DiscoveredDevice[]> {
    this._logger.info("Listening to available devices");

    if (this._transports.length === 0) {
      this._logger.warn("No transports available");
      return from([[]]);
    }

    if (!transport) {
      this._logger.info("Discovering all available transports");
      /**
       * Note: we're not using combineLatest because combineLatest will
       * - wait for all observables to emit at least once before emitting.
       * - complete as soon as one of the observables completes.
       * Some transports will just return an empty array and complete.
       * We want to keep listening to all transports until all have completed.
       */

      const observablesWithIndex = this._transports.map((t, index) =>
        t.listenToAvailableDevices().pipe(
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

    this._logger.info(`Discovering devices on transport ${transport}`);

    const instance = this._transportService.getTransport(transport);

    return instance.caseOf({
      Nothing: () => {
        this._logger.error(`Transport ${transport} not found`);
        return of([]);
      },
      Just: (t) => {
        return t
          .listenToAvailableDevices()
          .pipe(
            map((devices) =>
              devices.map(this.mapTransportDiscoveredDeviceToDiscoveredDevice),
            ),
          );
      },
    });
  }
}

// import { Observable } from "rxjs";
//
// import { Transport } from "@api/transport/model/Transport";
// import { DeviceModelDataSource } from "@internal/device-model/data/DeviceModelDataSource";
// import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
// import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
//
// export class WebBleTransport implements Transport {
//   set logger(_logger: LoggerPublisherService) {
//     throw new Error("Method not implemented.");
//   }
//   set deviceModelDataSource(_deviceModelDataSource: DeviceModelDataSource) {
//     throw new Error("Method not implemented.");
//   }
//   set deviceConnectionFactory(_deviceConnectionFactory: unknown) {
//     throw new Error("Method not implemented.");
//   }
//   listenToKnownDevices(): Observable<InternalDiscoveredDevice[]> {
//     throw new Error("Method not implemented.");
//   }
//   isSupported = jest.fn();
//   getIdentifier = jest.fn();
//   connect = jest.fn();
//   startDiscovering = jest.fn();
//   stopDiscovering = jest.fn();
//
//   disconnect = jest.fn();
// }
//
// export function usbHidTransportMockBuilder(
//   props: Partial<Transport> = {},
// ): Transport {
//   return {
//     logger: jest.fn(),
//     deviceModelDataSource: jest.fn(),
//     deviceConnectionFactory: jest.fn(),
//     isSupported: jest.fn(),
//     getIdentifier: jest.fn(),
//     startDiscovering: jest.fn(),
//     stopDiscovering: jest.fn(),
//     connect: jest.fn(),
//     disconnect: jest.fn(),
//     listenToKnownDevices: jest.fn(),
//     ...props,
//   };
// }

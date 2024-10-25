// import { Left } from "purify-ts";
// import * as uuid from "uuid";
// jest.mock("uuid");
//
// import { DeviceModel } from "@api/device/DeviceModel";
// import { DiscoveredDevice } from "@api/transport/model/DiscoveredDevice";
// import { DefaultDeviceSessionService } from "@internal/device-session/service/DefaultDeviceSessionService";
// import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
// import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";
// import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";
// import { AxiosManagerApiDataSource } from "@internal/manager-api/data/AxiosManagerApiDataSource";
// import { ManagerApiDataSource } from "@internal/manager-api/data/ManagerApiDataSource";
// import { DefaultManagerApiService } from "@internal/manager-api/service/DefaultManagerApiService";
// import { ManagerApiService } from "@internal/manager-api/service/ManagerApiService";
// import { UnknownDeviceError } from "@internal/transport/model/Errors";
// import { DefaultTransportService } from "@internal/transport/service/DefaultTransportService";
// import { TransportService } from "@internal/transport/service/TransportService";
//
// import { ConnectUseCase } from "./ConnectUseCase";
//
// jest.mock("@internal/manager-api/data/AxiosManagerApiDataSource");
//
// // TODO test several transports
// let transportService: TransportService;
// let logger: LoggerPublisherService;
// let sessionService: DeviceSessionService;
// let managerApi: ManagerApiService;
// let managerApiDataSource: ManagerApiDataSource;
// const fakeSessionId = "fakeSessionId";
//
// describe("ConnectUseCase", () => {
//   const stubDiscoveredDevice: DiscoveredDevice = {
//     id: "",
//     deviceModel: {} as DeviceModel,
//     transport: "USB",
//   };
//   // const stubConnectedDevice = connectedDeviceStubBuilder({ id: "1" });
//   const tag = "logger-tag";
//
//   beforeAll(() => {
//     logger = new DefaultLoggerPublisherService([], tag);
//     jest.spyOn(uuid, "v4").mockReturnValue(fakeSessionId);
//     transportService = new DefaultTransportService(() => logger);
//     sessionService = new DefaultDeviceSessionService(() => logger);
//     managerApiDataSource = new AxiosManagerApiDataSource({
//       managerApiUrl: "http://fake.url",
//     });
//     managerApi = new DefaultManagerApiService(managerApiDataSource);
//   });
//
//   afterAll(() => {
//     jest.restoreAllMocks();
//   });
//
//   test("If connect use case encounter an error, return it", async () => {
//     jest
//       .spyOn(transportService.getTransports()[0]!, "connect")
//       .mockResolvedValue(Left(new UnknownDeviceError()));
//
//     const usecase = new ConnectUseCase(
//       transportService,
//       sessionService,
//       managerApi,
//       () => logger,
//     );
//
//     await expect(
//       usecase.execute({ device: stubDiscoveredDevice }),
//     ).rejects.toBeInstanceOf(UnknownDeviceError);
//   });
//
//   // test("If connect is in success, return a deviceSession id", async () => {
//   //   jest
//   //     .spyOn(transports[0]!, "connect")
//   //     .mockResolvedValue(Promise.resolve(Right(stubConnectedDevice)));
//   //
//   //   const usecase = new ConnectUseCase(
//   //     transports,
//   //     sessionService,
//   //     () => logger,
//   //     managerApi,
//   //   );
//   //
//   //   const sessionId = await usecase.execute({
//   //     device: stubDiscoveredDevice,
//   //   });
//   //   expect(sessionId).toBe(fakeSessionId);
//   // });
// });

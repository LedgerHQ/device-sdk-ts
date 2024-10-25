// import { of } from "rxjs";
//
// import { DeviceModel } from "@api/device/DeviceModel";
// import { DeviceModelId, DiscoveredDevice } from "@api/types";
// import { InternalDeviceModel } from "@internal/device-model/model/DeviceModel";
// import { InternalDiscoveredDevice } from "@internal/transport/model/InternalDiscoveredDevice";
// import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";
//
// import { StartDiscoveringUseCase } from "./StartDiscoveringUseCase";
//
// let transport: WebUsbHidTransport;
//
// describe("StartDiscoveringUseCase", () => {
//   const stubDiscoveredDevice: InternalDiscoveredDevice = {
//     id: "internal-discovered-device-id",
//     deviceModel: {
//       id: "nanoSP" as DeviceModelId,
//       productName: "productName",
//     } as InternalDeviceModel,
//     transport: "USB",
//   };
//
//   beforeEach(() => {
//     transport = new WebUsbHidTransport();
//   });
//
//   afterEach(() => {
//     jest.restoreAllMocks();
//   });
//
//   test("If connect use case encounter an error, return it", (done) => {
//     const mockedStartDiscovering = jest.fn(() => {
//       return of(stubDiscoveredDevice);
//     });
//     jest
//       .spyOn(transport, "startDiscovering")
//       .mockImplementation(mockedStartDiscovering);
//     const usecase = new StartDiscoveringUseCase([transport]);
//
//     const discover = usecase.execute({ transport: "USB" });
//
//     expect(mockedStartDiscovering).toHaveBeenCalled();
//     discover.subscribe({
//       next: (discoveredDevice) => {
//         expect(discoveredDevice).toStrictEqual({
//           id: "internal-discovered-device-id",
//           transport: "USB",
//           deviceModel: new DeviceModel({
//             id: "internal-discovered-device-id",
//             model: "nanoSP" as DeviceModelId,
//             name: "productName",
//           }),
//         } as DiscoveredDevice);
//         done();
//       },
//       error: (error) => {
//         done(error);
//       },
//     });
//   });
// });

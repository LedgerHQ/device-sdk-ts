// import {
//   ApduResponse,
//   CommandResultFactory,
//   GlobalCommandErrorHandler,
// } from "@ledgerhq/device-management-kit";
//
// import { SW_INTERRUPTED_EXECUTION } from "@internal/app-binder/command/utils/constants";
// import { CommandUtils as BtcCommandUtils } from "@internal/utils/CommandUtils";
//
// import { ContinueCommand } from "./ContinueCommand";
//
// describe("ContinueCommand", (): void => {
//   const defaultArgs = {
//     payload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
//   };
//
//   const EXPECTED_APDU = new Uint8Array([
//     0xf8, // CLA
//     0x01, // INS
//     0x00, // P1
//     0x00, // P2
//     0x04, // Lc
//     0xde,
//     0xad,
//     0xbe,
//     0xef, // Payload data
//   ]);
//
//   const parser = (response: ApduResponse) => {
//     if (BtcCommandUtils.isContinueResponse(response)) {
//       return CommandResultFactory({
//         data: response,
//       });
//     }
//     return CommandResultFactory({
//       error: GlobalCommandErrorHandler.handle(response),
//     });
//   };
//
//   describe("getApdu", () => {
//     it("should return correct APDU for given payload", () => {
//       // given
//       const command = new ContinueCommand(defaultArgs, parser);
//       // when
//       const apdu = command.getApdu();
//       // then
//       expect(apdu.getRawApdu()).toStrictEqual(EXPECTED_APDU);
//     });
//   });
//
//   describe("parseResponse", () => {
//     it("should return the APDU response if it's a continue response", () => {
//       // given
//       const command = new ContinueCommand(defaultArgs, parser);
//       const continueResponseData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
//       const apduResponse = new ApduResponse({
//         statusCode: SW_INTERRUPTED_EXECUTION,
//         data: continueResponseData,
//       });
//
//       // when
//       const response = command.parseResponse(apduResponse);
//
//       // then
//       expect(response).toStrictEqual(
//         CommandResultFactory({
//           data: apduResponse,
//         }),
//       );
//     });
//   });
// });

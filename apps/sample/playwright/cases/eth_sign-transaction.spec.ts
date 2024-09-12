// /* eslint-disable no-restricted-imports */
// import { test } from "@playwright/test";

// import {
//   thenDeviceIsConnected,
//   thenVerifyResponseContains,
// } from "../utils/thenHandlers";
// import {
//   whenConnectingDevice,
//   whenExecuteDeviceAction,
//   whenNavigateTo,
// } from "../utils/whenHandlers";

// test.describe("keyrings: sign transaction", () => {
//   test.beforeEach(async ({ page }) => {
//     await page.goto("http://localhost:3000/");
//   });

//   const rawTransactionHex =
//     "0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca";

//   test("device should sign a transaction", async ({ page }) => {
//     await test.step("Given first device is connected", async () => {
//       // When we connect the device
//       await whenConnectingDevice(page);

//       // Then verify the device is connected
//       await thenDeviceIsConnected(page, 0);
//     });

//     await test.step("Then execute sign transaction", async () => {
//       // When we navigate to keyrings
//       await whenNavigateTo(page, "/keyring");

//       await page.getByTestId("CTA_command-Ethereum").click();

//       // And execute the "Sign transaction" command with the raw transaction hex
//       await whenExecuteDeviceAction(page, "Sign transaction", {
//         inputField: "input-text_transaction",
//         inputValue: rawTransactionHex,
//       });

//       // Then we verify the response contains "completed"
//       await thenVerifyResponseContains(page, '"status": "completed"');
//     });
//   });
// });

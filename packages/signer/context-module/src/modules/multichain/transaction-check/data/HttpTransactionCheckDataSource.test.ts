// import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
// import { Left, Right } from "purify-ts";

// import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
// import { HttpTransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/HttpTransactionCheckDataSource";

// describe("HttpTransactionCheckDataSource", () => {
//   const config = {
//     web3checks: { url: "https://web3checks.test" },
//     originToken: "originToken",
//   } as ContextModuleServiceConfig;

//   let httpMock: { post: ReturnType<typeof vi.fn> };
//   let dataSource: HttpTransactionCheckDataSource;

//   beforeEach(() => {
//     vi.resetAllMocks();
//     httpMock = { post: vi.fn() };
//     dataSource = new HttpTransactionCheckDataSource(
//       config,
//       httpMock as unknown as DmkNetworkClient,
//     );
//   });

//   describe("check", () => {
//     const path = "/ethereum/scan/tx";
//     const body = { tx: { from: "0xabc", raw: "0xdef" }, chain: 1 };

//     it("should return a result if the request is successful", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValueOnce({
//         public_key_id: "test-key-id",
//         descriptor: "test-descriptor",
//       });

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Right({ publicKeyId: "test-key-id", descriptor: "test-descriptor" }),
//       );
//     });

//     it("should call http.post with baseUrl + path and body", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValueOnce({
//         public_key_id: "test-key-id",
//         descriptor: "test-descriptor",
//       });

//       // WHEN
//       await dataSource.check({ path, body });

//       // THEN
//       expect(httpMock.post).toHaveBeenCalledWith(
//         `${config.web3checks.url}${path}`,
//         body,
//       );
//     });

//     it("should return an error if the request throws", async () => {
//       // GIVEN
//       httpMock.post.mockRejectedValue(new Error("network error"));

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Left(
//           new Error(
//             "[ContextModule] HttpTransactionCheckDataSource: Failed to fetch web3 check",
//           ),
//         ),
//       );
//     });

//     it("should return an error if the response is missing public_key_id", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValue({ descriptor: "test-descriptor" });

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Left(
//           new Error(
//             "[ContextModule] HttpTransactionCheckDataSource: Invalid web3 check response",
//           ),
//         ),
//       );
//     });

//     it("should return an error if the response is missing descriptor", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValue({ public_key_id: "test-key-id" });

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Left(
//           new Error(
//             "[ContextModule] HttpTransactionCheckDataSource: Invalid web3 check response",
//           ),
//         ),
//       );
//     });

//     it("should return an error if public_key_id is null", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValue({
//         public_key_id: null,
//         descriptor: "test-descriptor",
//       });

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Left(
//           new Error(
//             "[ContextModule] HttpTransactionCheckDataSource: Invalid web3 check response",
//           ),
//         ),
//       );
//     });

//     it("should return an error for an empty response object", async () => {
//       // GIVEN
//       httpMock.post.mockResolvedValue({});

//       // WHEN
//       const result = await dataSource.check({ path, body });

//       // THEN
//       expect(result).toEqual(
//         Left(
//           new Error(
//             "[ContextModule] HttpTransactionCheckDataSource: Invalid web3 check response",
//           ),
//         ),
//       );
//     });
//   });
// });

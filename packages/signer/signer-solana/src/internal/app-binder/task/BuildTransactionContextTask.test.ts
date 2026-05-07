// /* eslint-disable @typescript-eslint/no-unsafe-call */
// /* eslint-disable @typescript-eslint/no-unsafe-member-access */
// /* eslint-disable @typescript-eslint/no-explicit-any */
// import {
//   ClearSignContextType,
//   type ContextModule,
// } from "@ledgerhq/context-module";
// import {
//   CommandResultStatus,
//   DeviceModelId,
//   type InternalApi,
// } from "@ledgerhq/device-management-kit";
// import { beforeEach, describe, expect, it, vi } from "vitest";

// import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

// import {
//   BuildTransactionContextTask,
//   type SolanaBuildContextResult,
// } from "./BuildTransactionContextTask";

// const mockLoggerFactory = () => ({
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
//   subscribers: [],
// });

// const contextModuleMock: ContextModule = {
//   getContexts: vi.fn(),
// } as unknown as ContextModule;

// const defaultArgs = {
//   contextModule: contextModuleMock,
//   loggerFactory: mockLoggerFactory,
//   transactionBytes: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
//   signerAddress: null,
//   options: {
//     tokenAddress: "someAddress",
//     createATA: undefined,
//   },
// };

// const trustedNamePayload = new Uint8Array([1, 2, 3]);
// const trustedNameCert = {
//   payload: new Uint8Array([0xaa, 0xbb]),
//   keyUsageNumber: 1,
// };

// const solanaContextsPayload = [
//   {
//     type: ClearSignContextType.SOLANA_TRUSTED_NAME,
//     payload: trustedNamePayload as unknown as string,
//     certificate: trustedNameCert,
//   },
// ];

// let apiMock: InternalApi;

// describe("BuildTransactionContextTask", () => {
//   beforeEach(() => {
//     vi.resetAllMocks();

//     apiMock = {
//       getDeviceSessionState: vi
//         .fn()
//         .mockReturnValue({ deviceModelId: DeviceModelId.NANO_X }),
//       sendCommand: vi.fn().mockResolvedValue({
//         status: CommandResultStatus.Success,
//         data: { challenge: "someChallenge" },
//       }),
//     } as unknown as InternalApi;
//   });

//   it("returns context successfully when challenge command succeeds", async () => {
//     (contextModuleMock.getContexts as any).mockResolvedValue(
//       solanaContextsPayload,
//     );

//     const task = new BuildTransactionContextTask(apiMock, defaultArgs);
//     const result = await task.run();

//     // challenge is fetched
//     expect(apiMock.sendCommand).toHaveBeenCalledWith(
//       expect.any(GetChallengeCommand),
//     );

// <<<<<<< HEAD
//     expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
//       {
// =======
//     // getSolanaContext called with challenge and no transactionCheck (signerAddress is null)
//     expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith(
//       expect.objectContaining({
// >>>>>>> 580c73f2b (✨ (signer-solana): Add Web3Checks opt-in flow to SignTransactionDeviceAction)
//         deviceModelId: DeviceModelId.NANO_X,
//         tokenAddress: "someAddress",
//         challenge: "someChallenge",
//         createATA: undefined,
// <<<<<<< HEAD
//         tokenInternalId: undefined,
//         templateId: undefined,
//       },
//       [
//         ClearSignContextType.SOLANA_TOKEN,
//         ClearSignContextType.SOLANA_LIFI,
//         ClearSignContextType.SOLANA_TRUSTED_NAME,
//       ],
// =======
//         transactionCheck: undefined,
//       }),
// >>>>>>> 580c73f2b (✨ (signer-solana): Add Web3Checks opt-in flow to SignTransactionDeviceAction)
//     );

//     // matches SolanaBuildContextResult shape
//     expect(result).toEqual<SolanaBuildContextResult>({
//       tlvDescriptor: trustedNamePayload,
//       trustedNamePKICertificate: trustedNameCert,
//       loadersResults: [],
//       contextErrorCount: 0,
//     });
//   });

//   it("throws if challenge command fails", async () => {
//     (apiMock.sendCommand as any).mockResolvedValue({
//       status: CommandResultStatus.Error,
//       data: {},
//     });
//     (contextModuleMock.getContexts as any).mockResolvedValue(
//       solanaContextsPayload,
//     );

//     const task = new BuildTransactionContextTask(apiMock, defaultArgs);

//     await expect(task.run()).rejects.toThrow(
//       "Failed to get challenge from device",
//     );
//   });

// <<<<<<< HEAD
//   it("returns empty result when getContexts returns only errors and owner info is not required", async () => {
// =======
//   it("derives transactionCheck from signerAddress and transactionBytes", async () => {
//     (contextModuleMock.getSolanaContext as any).mockResolvedValue(
//       Right(solanaContextRightPayload),
//     );

//     const args = {
//       contextModule: contextModuleMock,
//       loggerFactory: mockLoggerFactory,
//       transactionBytes: new Uint8Array([0xca, 0xfe]),
//       signerAddress: "So1anaSignerPubKey111111111111111111111111111",
//       options: {
//         tokenAddress: undefined,
//         createATA: undefined,
//       },
//     };

//     const task = new BuildTransactionContextTask(apiMock, args);
//     await task.run();

//     expect(contextModuleMock.getSolanaContext).toHaveBeenCalledWith(
//       expect.objectContaining({
//         transactionCheck: {
//           from: "So1anaSignerPubKey111111111111111111111111111",
//           rawTx: expect.any(String),
//           chain: 1,
//         },
//       }),
//     );
//   });

//   it("throws if getSolanaContext returns Left", async () => {
// >>>>>>> 580c73f2b (✨ (signer-solana): Add Web3Checks opt-in flow to SignTransactionDeviceAction)
//     const error = new Error("Solana context failure");
//     const argsWithoutOwnerInfo = {
//       ...defaultArgs,
//       options: { tokenAddress: undefined, createATA: undefined },
//     };
//     (contextModuleMock.getContexts as any).mockResolvedValue([
//       { type: ClearSignContextType.ERROR, error },
//     ]);

//     const task = new BuildTransactionContextTask(apiMock, argsWithoutOwnerInfo);
//     const result = await task.run();

//     expect(result.trustedNamePKICertificate).toBeUndefined();
//     expect(result.tlvDescriptor).toBeUndefined();
//     expect(result.loadersResults).toHaveLength(1);
//     expect(result.loadersResults[0]).toEqual({
//       type: ClearSignContextType.ERROR,
//       error,
//     });
//     expect(result.contextErrorCount).toBe(1);
//   });

//   it("throws when owner info was required but only errors were returned", async () => {
//     const error = new Error("PKI cert load failure");
//     // defaultArgs has tokenAddress: "someAddress", so owner info IS required
//     (contextModuleMock.getContexts as any).mockResolvedValue([
//       { type: ClearSignContextType.ERROR, error },
//     ]);

//     const task = new BuildTransactionContextTask(apiMock, defaultArgs);

//     await expect(task.run()).rejects.toThrow(
//       "[SignerSolana] BuildTransactionContextTask: owner info was required but could not be resolved",
//     );
//   });

//   it("throws when owner info was required but getContexts returns empty array", async () => {
//     // (getOwnerInfo succeeded but tlvDescriptor is undefined) — no error, but no TRUSTED_NAME either.
//     (contextModuleMock.getContexts as any).mockResolvedValue([]);

//     const task = new BuildTransactionContextTask(apiMock, defaultArgs);

//     await expect(task.run()).rejects.toThrow(
//       "[SignerSolana] BuildTransactionContextTask: owner info was required but could not be resolved",
//     );
//   });

//   it("reports contextErrorCount when some contexts are errors alongside successes", async () => {
//     const error = new Error("token loader failure");
//     (contextModuleMock.getContexts as any).mockResolvedValue([
//       {
//         type: ClearSignContextType.SOLANA_TRUSTED_NAME,
//         payload: trustedNamePayload as unknown as string,
//         certificate: trustedNameCert,
//       },
//       { type: ClearSignContextType.ERROR, error },
//     ]);

//     const task = new BuildTransactionContextTask(apiMock, defaultArgs);
//     const result = await task.run();

//     expect(result.trustedNamePKICertificate).toEqual(trustedNameCert);
//     expect(result.tlvDescriptor).toEqual(trustedNamePayload);
//     expect(result.contextErrorCount).toBe(1);
//     expect(result.loadersResults).toHaveLength(1);
//     expect(result.loadersResults[0]).toEqual({
//       type: ClearSignContextType.ERROR,
//       error,
//     });
//   });
// });

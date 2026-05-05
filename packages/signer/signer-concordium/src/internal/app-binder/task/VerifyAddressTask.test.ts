import {
  type ClearSignContext,
  ClearSignContextType,
  ConcordiumAccountOwnershipError,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { AddressVerificationFailedError } from "@internal/app-binder/command/utils/AddressVerificationFailedError";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { TrustedMetadataServiceError } from "@internal/app-binder/command/utils/TrustedMetadataServiceError";
import { VerifyAddressTask } from "@internal/app-binder/task/VerifyAddressTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";
const ADDRESS = "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB";
const NETWORK = "mainnet" as const;
const PUBLIC_KEY = new Uint8Array(32).fill(0xab);
const CHALLENGE = "aabbccdd11223344";
const DESCRIPTOR_HEX = "0102030405";
const CERTIFICATE = {
  keyUsageNumber: 4,
  payload: new Uint8Array([0x10, 0x20, 0x30]),
};

function makeSuccessContext(withCertificate = true): ClearSignContext[] {
  return [
    {
      type: ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP,
      payload: DESCRIPTOR_HEX,
      certificate: withCertificate ? CERTIFICATE : undefined,
    },
  ];
}

function makeErrorContext(error: Error): ClearSignContext[] {
  return [
    {
      type: ClearSignContextType.ERROR,
      error,
    },
  ];
}

describe("VerifyAddressTask", () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;
  let contextModuleMock: ContextModule;

  beforeEach(() => {
    sendCommandMock = vi.fn();
    apiMock = {
      sendCommand: sendCommandMock,
      getDeviceModel: () => ({ id: DeviceModelId.NANO_SP }),
    } as unknown as InternalApi;
    loggerMock = {
      debug: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerPublisherService;
    contextModuleMock = {
      getContexts: vi.fn(),
    } as unknown as ContextModule;
  });

  function createTask() {
    return new VerifyAddressTask(
      apiMock,
      {
        derivationPath: DERIVATION_PATH,
        address: ADDRESS,
        network: NETWORK,
        contextModule: contextModuleMock,
      },
      loggerMock,
    );
  }

  function mockSendCommandSequence(
    ...results: ReturnType<typeof CommandResultFactory>[]
  ) {
    let callIndex = 0;
    sendCommandMock.mockImplementation(() =>
      Promise.resolve(results[callIndex++]),
    );
  }

  describe("success path", () => {
    it("should complete the full flow with certificate", async () => {
      // GetPublicKey → GetChallenge → LoadCertificate → SetTrustedName → VerifyAddress
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // LoadCertificate
        CommandResultFactory({ data: undefined }), // SetTrustedName
        CommandResultFactory({ data: undefined }), // VerifyAddress
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(true),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBe(true);
      }
      expect(sendCommandMock).toHaveBeenCalledTimes(5);
      expect(contextModuleMock.getContexts).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: "ab".repeat(32),
          address: ADDRESS,
          challenge: CHALLENGE,
          network: NETWORK,
          deviceModelId: DeviceModelId.NANO_SP,
        }),
        [ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP],
      );
    });

    it("should skip LoadCertificate when context has no certificate", async () => {
      // GetPublicKey → GetChallenge → SetTrustedName → VerifyAddress (no LoadCert)
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // SetTrustedName
        CommandResultFactory({ data: undefined }), // VerifyAddress
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(false),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(true);
      expect(sendCommandMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("failure cases", () => {
    it("should fail when GetPublicKey fails", async () => {
      const error = new ConcordiumAppCommandError({
        message: "User rejected",
        errorCode: ConcordiumErrorCodes.USER_REJECTED,
      });
      sendCommandMock.mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(sendCommandMock).toHaveBeenCalledTimes(1);
    });

    it("should fail when GetChallenge fails", async () => {
      const error = new ConcordiumAppCommandError({
        message: "INS not supported",
        errorCode: ConcordiumErrorCodes.INS_NOT_SUPPORTED,
      });
      sendCommandMock
        .mockResolvedValueOnce(
          CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        )
        .mockResolvedValueOnce(CommandResultFactory({ error }));

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(sendCommandMock).toHaveBeenCalledTimes(2);
    });

    it("should fail with TrustedMetadataServiceError when context loader returns a plain Error (service_unavailable)", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeErrorContext(new Error("Backend unavailable")),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(TrustedMetadataServiceError);
        expect(result.error).toHaveProperty(
          "errorCode",
          ConcordiumErrorCodes.TRUSTED_METADATA_SERVICE_ERROR,
        );
      }
    });

    it("should fail with TrustedMetadataServiceError when ConcordiumAccountOwnershipError kind is service_unavailable", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeErrorContext(
          new ConcordiumAccountOwnershipError(
            "service_unavailable",
            "backend 503",
          ),
        ),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(TrustedMetadataServiceError);
        expect((result.error as TrustedMetadataServiceError).message).toBe(
          "backend 503",
        );
      }
    });

    it("should fail with AddressVerificationFailedError when ConcordiumAccountOwnershipError kind is verification_failed", async () => {
      const backendMessage =
        "Address ByteVector(32 bytes, 0xa63c) is not associated with the given public key ByteVector(32 bytes, 0x9dc1) on the network Testnet";
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeErrorContext(
          new ConcordiumAccountOwnershipError(
            "verification_failed",
            backendMessage,
          ),
        ),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(AddressVerificationFailedError);
        expect(result.error).toHaveProperty(
          "errorCode",
          ConcordiumErrorCodes.ADDRESS_VERIFICATION_FAILED,
        );
        expect((result.error as AddressVerificationFailedError).message).toBe(
          backendMessage,
        );
      }
    });

    it("should fail when context module returns empty contexts", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue([]);

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should fail when context module throws", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockRejectedValue(
        new Error("Network timeout"),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should fail when LoadCertificate fails", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({
          error: new InvalidStatusWordError("cert error"),
        }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(true),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
      expect(sendCommandMock).toHaveBeenCalledTimes(3);
    });

    it("should fail when descriptor payload is empty", async () => {
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // LoadCertificate
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue([
        {
          type: ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP,
          payload: "",
          certificate: CERTIFICATE,
        },
      ]);

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("should fail when SetTrustedName fails", async () => {
      const error = new ConcordiumAppCommandError({
        message: "Data invalid",
        errorCode: ConcordiumErrorCodes.DATA_INVALID,
      });
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // LoadCertificate
        CommandResultFactory({ error }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(true),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(sendCommandMock).toHaveBeenCalledTimes(4);
    });

    it("should fail when VerifyAddress is rejected by user", async () => {
      const error = new ConcordiumAppCommandError({
        message: "User rejected",
        errorCode: ConcordiumErrorCodes.USER_REJECTED,
      });
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // LoadCertificate
        CommandResultFactory({ data: undefined }), // SetTrustedName
        CommandResultFactory({ error }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(true),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.USER_REJECTED);
      }
      expect(sendCommandMock).toHaveBeenCalledTimes(5);
    });

    it("should fail when VerifyAddress returns trusted name mismatch", async () => {
      const error = new ConcordiumAppCommandError({
        message: "Trusted name mismatch",
        errorCode: ConcordiumErrorCodes.TRUSTED_NAME_MISMATCH,
      });
      mockSendCommandSequence(
        CommandResultFactory({ data: { publicKey: PUBLIC_KEY } }),
        CommandResultFactory({ data: { challenge: CHALLENGE } }),
        CommandResultFactory({ data: undefined }), // LoadCertificate
        CommandResultFactory({ data: undefined }), // SetTrustedName
        CommandResultFactory({ error }),
      );
      vi.spyOn(contextModuleMock, "getContexts").mockResolvedValue(
        makeSuccessContext(true),
      );

      const result = await createTask().run();

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as ConcordiumAppCommandError;
        expect(err.errorCode).toBe(ConcordiumErrorCodes.TRUSTED_NAME_MISMATCH);
      }
    });
  });
});

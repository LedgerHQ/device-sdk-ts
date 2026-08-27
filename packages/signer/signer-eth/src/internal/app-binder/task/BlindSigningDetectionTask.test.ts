import {
  ClearSignContextType,
  type ContextModule,
  type EthSignReportParams,
  SigningMethod,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";

import { ClearSigningType } from "@api/model/ClearSigningType";

import {
  type BlindSigningDetectionInput,
  BlindSigningDetectionTask,
  type BlindSigningDetectionTaskArgs,
} from "./BlindSigningDetectionTask";

vi.mock("@ledgerhq/signer-utils", () => ({
  generateSignatureId: () => "aBcDeF-1700000000000",
}));

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const mockLoggerFactory = (_tag: string) => mockLogger;

const baseInput: BlindSigningDetectionInput = {
  type: "transaction",
  hasContext: false,
  usedFallback: false,
  chainId: 1,
  targetAddress: "0xabc",
  deviceModelId: DeviceModelId.FLEX,
  signerAppVersion: "1.12.1",
  deviceVersion: "2.2.3",
  clearSigningType: null,
  partialContextErrors: 0,
  selectorId: null,
};

describe("BlindSigningDetectionTask", () => {
  const mockContextModule = {
    getContexts: vi.fn(),
    getFieldContext: vi.fn(),
    getTypedDataFilters: vi.fn(),
    report: vi.fn(),
    signReport: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContextModule;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect blind signing for transaction and report with mapped params", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: false,
        usedFallback: false,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
    expect(mockContextModule.report).toHaveBeenCalledWith({
      signatureId: "aBcDeF-1700000000000",
      signingMethod: "eth_signTransaction",
      isBlindSign: true,
      chainId: 1,
      targetAddress: "0xabc",
      blindSignReason: "no_clear_signing_context",
      modelId: "flex",
      signerAppVersion: "1.12.1",
      deviceVersion: "2.2.3",
      ethContext: null,
    });
  });

  it("should detect non-blind signing for transaction and report", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(false);
    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({ isBlindSign: false, blindSignReason: null }),
    );
  });

  it("should use device_rejected_context reason when usedFallback is true", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: true,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({
        blindSignReason: "device_rejected_context",
      }),
    );
  });

  it("should detect blind signing for typed data", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        type: "typedData",
        hasContext: false,
        usedFallback: true,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({
        signingMethod: "eth_signTypedData",
        blindSignReason: "device_rejected_context",
      }),
    );
  });

  it("should not fail if contextModule.report throws", async () => {
    (mockContextModule.report as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: false,
        usedFallback: false,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should return true when hasContext is true but only metadata-only context types are present", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [ClearSignContextType.ETHEREUM_TRANSACTION_CHECK],
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
  });

  it("should return true when hasContext is true but only DYNAMIC_NETWORK and GATED_SIGNING context types are present", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [
          ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK,
          ClearSignContextType.ETHEREUM_GATED_SIGNING,
        ],
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
  });

  it("should return false when hasContext is true and real clear-signing context types are present alongside metadata", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [
          ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
          ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
        ],
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(false);
  });

  it("should return false when hasContext is true with empty contextTypes (no calldata scenario)", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [],
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(false);
  });

  it("should return true when hasContext is false even with contextTypes provided", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: false,
        usedFallback: false,
        contextTypes: [],
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    const result = await task.run();

    expect(result.isBlindSign).toBe(true);
  });

  it("should map DeviceModelId to BlindSigningModelId correctly", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: false,
        usedFallback: false,
        deviceModelId: DeviceModelId.NANO_X,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    await task.run();

    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "nanoX" }),
    );
  });

  it("should populate ethContext when clearSigningType is provided", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        clearSigningType: ClearSigningType.EIP7730,
        partialContextErrors: 2,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    await task.run();

    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({
        ethContext: {
          clearSigningType: "eip7730",
          partialContextErrors: 2,
        },
      }),
    );
  });

  it("should set ethContext to null when clearSigningType is null", async () => {
    const args: BlindSigningDetectionTaskArgs = {
      input: {
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        clearSigningType: null,
        partialContextErrors: 0,
      },
      contextModule: mockContextModule,
      loggerFactory: mockLoggerFactory,
    };

    const task = new BlindSigningDetectionTask(args);
    await task.run();

    expect(mockContextModule.report).toHaveBeenCalledWith(
      expect.objectContaining({
        ethContext: null,
      }),
    );
  });

  describe("signReport (v2 API)", () => {
    it("calls signReport with EthSignReportParams for a blind transaction", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: { ...baseInput, hasContext: false, usedFallback: false },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      expect(mockContextModule.signReport).toHaveBeenCalledOnce();
      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params).toMatchObject({
        chain: "ETH",
        signatureId: "aBcDeF-1700000000000",
        signingMethod: SigningMethod.ETH_SIGN_TRANSACTION,
        isBlindSign: true,
        chainId: 1,
        targetAddress: "0xabc",
        blindSignReason: "no_clear_signing_context",
        modelId: "flex",
        signerAppVersion: "1.12.1",
        deviceVersion: "2.2.3",
      });
      expect(params.clearSigningType).toBeUndefined();
      expect(params.partialContextErrors).toBeUndefined();
    });

    it("calls signReport with signingMethod eth_signTypedData for typed data", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: {
          ...baseInput,
          type: "typedData",
          hasContext: false,
          usedFallback: false,
        },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      expect(mockContextModule.signReport).toHaveBeenCalledOnce();
      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params.signingMethod).toBe(SigningMethod.ETH_SIGN_TYPED_DATA);
    });

    it("flattens clearSigningType and partialContextErrors (no ethContext nesting)", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: {
          ...baseInput,
          hasContext: true,
          usedFallback: false,
          clearSigningType: ClearSigningType.EIP7730,
          partialContextErrors: 3,
        },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params.clearSigningType).toBe("eip7730");
      expect(params.partialContextErrors).toBe(3);
      expect(params).not.toHaveProperty("ethContext");
    });

    it("omits clearSigningType and partialContextErrors when clearSigningType is null", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: {
          ...baseInput,
          hasContext: true,
          usedFallback: false,
          clearSigningType: null,
          partialContextErrors: 0,
        },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params.clearSigningType).toBeUndefined();
      expect(params.partialContextErrors).toBeUndefined();
    });

    it("passes selectorId when provided", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: {
          ...baseInput,
          hasContext: true,
          usedFallback: false,
          selectorId: "0xa9059cbb",
        },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params.selectorId).toBe("0xa9059cbb");
    });

    it("omits selectorId when not provided", async () => {
      const args: BlindSigningDetectionTaskArgs = {
        input: { ...baseInput, hasContext: true, usedFallback: false },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      await new BlindSigningDetectionTask(args).run();

      const [params] = (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mock.calls[0] as [EthSignReportParams];
      expect(params.selectorId).toBeUndefined();
    });

    it("swallows errors from signReport without affecting the result", async () => {
      (
        mockContextModule.signReport as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("v2 network error"));

      const args: BlindSigningDetectionTaskArgs = {
        input: { ...baseInput, hasContext: false, usedFallback: false },
        contextModule: mockContextModule,
        loggerFactory: mockLoggerFactory,
      };

      const result = await new BlindSigningDetectionTask(args).run();

      expect(result.isBlindSign).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[run] Failed to report signing event",
        expect.objectContaining({ data: { error: expect.any(Error) } }),
      );
    });

    it("does nothing when signReport is not defined on the context module", async () => {
      const moduleWithoutSignReport = {
        ...mockContextModule,
        signReport: undefined,
      } as unknown as ContextModule;

      const args: BlindSigningDetectionTaskArgs = {
        input: { ...baseInput, hasContext: false, usedFallback: false },
        contextModule: moduleWithoutSignReport,
        loggerFactory: mockLoggerFactory,
      };

      await expect(new BlindSigningDetectionTask(args).run()).resolves.toEqual({
        isBlindSign: true,
      });
    });
  });
});

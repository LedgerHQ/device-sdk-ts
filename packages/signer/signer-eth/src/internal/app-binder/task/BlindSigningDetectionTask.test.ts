import {
  ClearSignContextType,
  type ContextModule,
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
};

describe("BlindSigningDetectionTask", () => {
  const mockContextModule = {
    getContexts: vi.fn(),
    getFieldContext: vi.fn(),
    getTypedDataFilters: vi.fn(),
    report: vi.fn(),
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
});

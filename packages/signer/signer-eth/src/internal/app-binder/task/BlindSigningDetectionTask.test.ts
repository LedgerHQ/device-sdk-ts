import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";

import {
  type BlindSigningDetectionInput,
  BlindSigningDetectionTask,
  type BlindSigningDetectionTaskArgs,
  computeIsBlindSign,
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
};

describe("computeIsBlindSign", () => {
  it("should return false when hasContext is true and no fallback", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: false,
      }),
    ).toBe(false);
  });

  it("should return true when hasContext is false and no fallback", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: false,
        usedFallback: false,
      }),
    ).toBe(true);
  });

  it("should return true when usedFallback is true even with context", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: true,
      }),
    ).toBe(true);
  });

  it("should return true when usedFallback is true and no context", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: false,
        usedFallback: true,
      }),
    ).toBe(true);
  });

  it("should work for typedData type", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        type: "typedData",
        hasContext: true,
        usedFallback: false,
      }),
    ).toBe(false);

    expect(
      computeIsBlindSign({
        ...baseInput,
        type: "typedData",
        hasContext: false,
        usedFallback: false,
      }),
    ).toBe(true);
  });

  it("should return true when hasContext is true but only metadata-only context types are present", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [ClearSignContextType.TRANSACTION_CHECK],
      }),
    ).toBe(true);
  });

  it("should return true when hasContext is true but only DYNAMIC_NETWORK and GATED_SIGNING context types are present", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [
          ClearSignContextType.DYNAMIC_NETWORK,
          ClearSignContextType.GATED_SIGNING,
        ],
      }),
    ).toBe(true);
  });

  it("should return false when hasContext is true and real clear-signing context types are present alongside metadata", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [
          ClearSignContextType.TRANSACTION_CHECK,
          ClearSignContextType.TRANSACTION_INFO,
        ],
      }),
    ).toBe(false);
  });

  it("should return false when hasContext is true with empty contextTypes (no calldata scenario)", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: true,
        usedFallback: false,
        contextTypes: [],
      }),
    ).toBe(false);
  });

  it("should return true when hasContext is false even with contextTypes provided", () => {
    expect(
      computeIsBlindSign({
        ...baseInput,
        hasContext: false,
        usedFallback: false,
        contextTypes: [],
      }),
    ).toBe(true);
  });
});

describe("BlindSigningDetectionTask", () => {
  const mockContextModule = {
    getContexts: vi.fn(),
    getFieldContext: vi.fn(),
    getTypedDataFilters: vi.fn(),
    getSolanaContext: vi.fn(),
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
});

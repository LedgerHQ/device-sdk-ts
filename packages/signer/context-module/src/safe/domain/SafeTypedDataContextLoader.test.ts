import { DeviceModelId } from "@ledgerhq/device-management-kit";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import type { ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { SafeTypedDataContextLoader } from "@/safe/domain/SafeTypedDataContextLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import type { TypedDataContext } from "@/shared/model/TypedDataContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import type { TypedDataDataSource } from "@/typed-data/data/TypedDataDataSource";
import { DefaultTypedDataContextLoader } from "@/typed-data/domain/DefaultTypedDataContextLoader";

// Mock the DefaultTypedDataContextLoader
vi.mock("@/typed-data/domain/DefaultTypedDataContextLoader");

describe("SafeTypedDataContextLoader", () => {
  const mockTypedDataDataSource: TypedDataDataSource = {
    getTypedDataFilters: vi.fn(),
  };

  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };

  const mockProxyDataSource: ProxyDataSource = {
    getProxyDelegateCall: vi.fn(),
    getProxyImplementationAddress: vi.fn(),
  };

  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  const mockTypedDataContext: TypedDataContext = {
    deviceModelId: DeviceModelId.STAX,
    verifyingContract: "0x1234567890abcdef",
    chainId: SupportedChainIds.BASE,
    version: "v2" as const,
    schema: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
    },
    fieldsValues: [{ path: "name", value: new Uint8Array([1, 2, 3]) }],
    challenge: "test-challenge",
  };

  const mockSuccessResult = {
    type: "success" as const,
    messageInfo: {
      displayName: "Test Message",
      filtersCount: 1,
      signature: "0xsignature",
    },
    filters: {},
    trustedNamesAddresses: {},
    tokens: {},
    calldatas: {},
  };

  let mockDefaultTypedDataContextLoader: {
    load: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockDefaultTypedDataContextLoader = {
      load: vi.fn(),
    };

    // Mock the DefaultTypedDataContextLoader constructor
    vi.mocked(DefaultTypedDataContextLoader).mockImplementation(
      () =>
        mockDefaultTypedDataContextLoader as unknown as DefaultTypedDataContextLoader,
    );
  });

  describe("constructor", () => {
    it("should create SafeTypedDataContextLoader with correct data sources", () => {
      // WHEN
      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // THEN
      expect(loader).toBeInstanceOf(SafeTypedDataContextLoader);
      expect(DefaultTypedDataContextLoader).toHaveBeenCalledTimes(1);
      expect(DefaultTypedDataContextLoader).toHaveBeenCalledWith(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );
    });

    it("should initialize internal DefaultTypedDataContextLoader with all dependencies", () => {
      // WHEN
      new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // THEN
      expect(DefaultTypedDataContextLoader).toHaveBeenCalledWith(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );
    });

    it("should pass SafeProxyDataSource specifically (not regular ProxyDataSource)", () => {
      // GIVEN
      const safeMockProxyDataSource = {
        ...mockProxyDataSource,
        resolver: "SAFE_GATEWAY" as const,
      };

      // WHEN
      new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        safeMockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // THEN
      expect(DefaultTypedDataContextLoader).toHaveBeenCalledWith(
        mockTypedDataDataSource,
        mockTokenDataSource,
        safeMockProxyDataSource,
        mockPkiCertificateLoader,
      );
    });
  });

  describe("load", () => {
    it("should delegate load call to internal DefaultTypedDataContextLoader", async () => {
      // GIVEN
      mockDefaultTypedDataContextLoader.load.mockResolvedValue(
        mockSuccessResult,
      );

      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // WHEN
      const result = await loader.load(mockTypedDataContext);

      // THEN
      expect(mockDefaultTypedDataContextLoader.load).toHaveBeenCalledTimes(1);
      expect(mockDefaultTypedDataContextLoader.load).toHaveBeenCalledWith(
        mockTypedDataContext,
      );
      expect(result).toEqual(mockSuccessResult);
    });

    it("should return success result from internal loader", async () => {
      // GIVEN
      mockDefaultTypedDataContextLoader.load.mockResolvedValue(
        mockSuccessResult,
      );

      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // WHEN
      const result = await loader.load(mockTypedDataContext);

      // THEN
      expect(result).toEqual(mockSuccessResult);
    });

    it("should return error result from internal loader", async () => {
      // GIVEN
      const mockErrorResult = {
        type: "error" as const,
        error: new Error("Internal loader failed"),
      };
      mockDefaultTypedDataContextLoader.load.mockResolvedValue(mockErrorResult);

      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // WHEN
      const result = await loader.load(mockTypedDataContext);

      // THEN
      expect(result).toEqual(mockErrorResult);
    });

    it("should return error when chain id is not supported", async () => {
      // GIVEN
      const mockTypedDataContextWithUnsupportedChain = {
        ...mockTypedDataContext,
        chainId: 999999,
      };

      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // WHEN
      const result = await loader.load(
        mockTypedDataContextWithUnsupportedChain,
      );

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: new Error("Invalid chain id"),
      });
    });
  });

  describe("dependency injection", () => {
    it("should store references to all injected dependencies", () => {
      // WHEN
      const loader = new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // THEN - accessing private fields to verify they're set
      expect(loader["typedDataDataSource"]).toBe(mockTypedDataDataSource);
      expect(loader["tokenDataSource"]).toBe(mockTokenDataSource);
      expect(loader["proxyDataSource"]).toBe(mockProxyDataSource);
      expect(loader["certificateLoader"]).toBe(mockPkiCertificateLoader);
    });

    it("should create internal loader exactly once", () => {
      // WHEN
      new SafeTypedDataContextLoader(
        mockTypedDataDataSource,
        mockTokenDataSource,
        mockProxyDataSource,
        mockPkiCertificateLoader,
      );

      // THEN
      expect(DefaultTypedDataContextLoader).toHaveBeenCalledTimes(1);
    });
  });
});

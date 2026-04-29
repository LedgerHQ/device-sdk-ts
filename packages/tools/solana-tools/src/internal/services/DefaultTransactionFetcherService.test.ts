import { Connection } from "@solana/web3.js";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

const fakeMessageBytes = new Uint8Array([1, 2, 3, 4]);

vi.mock("@ledgerhq/device-management-kit", () => ({
  bufferToBase64String: (bytes: Uint8Array): string => toBase64(bytes),
}));

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Connection: vi.fn(),
  };
});

import { DefaultTransactionFetcherService } from "./DefaultTransactionFetcherService";

describe("DefaultTransactionFetcherService", () => {
  let getTransactionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getTransactionMock = vi.fn();
    vi.mocked(Connection).mockImplementation(
      () =>
        ({
          getTransaction: getTransactionMock,
        }) as unknown as Connection,
    );
  });

  it("should use the default RPC URL when none is provided", async () => {
    getTransactionMock.mockResolvedValue({
      transaction: {
        message: { serialize: () => fakeMessageBytes },
        signatures: ["sig1base58"],
      },
    });
    const service = new DefaultTransactionFetcherService();
    await service.fetchTransaction("test-sig");
    expect(Connection).toHaveBeenCalledWith(
      "https://solana.coin.ledger.com",
      "confirmed",
    );
  });

  it("should use a custom RPC URL when provided", async () => {
    getTransactionMock.mockResolvedValue({
      transaction: {
        message: { serialize: () => fakeMessageBytes },
        signatures: ["sig1base58"],
      },
    });
    const service = new DefaultTransactionFetcherService();
    await service.fetchTransaction(
      "test-sig",
      "https://custom-rpc.example.com",
    );
    expect(Connection).toHaveBeenCalledWith(
      "https://custom-rpc.example.com",
      "confirmed",
    );
  });

  it("should throw when the transaction is not found", async () => {
    getTransactionMock.mockResolvedValue(null);
    const service = new DefaultTransactionFetcherService();

    await expect(service.fetchTransaction("missing-sig")).rejects.toThrow(
      "Transaction not found: missing-sig",
    );
  });

  it("should return base64 serialised message bytes on success", async () => {
    getTransactionMock.mockResolvedValue({
      transaction: {
        message: { serialize: () => fakeMessageBytes },
        signatures: ["sig1base58", "sig2base58"],
      },
    });

    const service = new DefaultTransactionFetcherService();
    const result = await service.fetchTransaction("test-signature");

    expect(getTransactionMock).toHaveBeenCalledWith("test-signature", {
      maxSupportedTransactionVersion: 0,
    });
    expect(result).toBe(toBase64(fakeMessageBytes));
  });

  it("should call getTransaction with maxSupportedTransactionVersion 0", async () => {
    getTransactionMock.mockResolvedValue(null);
    const service = new DefaultTransactionFetcherService();

    await expect(service.fetchTransaction("any-sig")).rejects.toThrow();
    expect(getTransactionMock).toHaveBeenCalledWith("any-sig", {
      maxSupportedTransactionVersion: 0,
    });
  });
});

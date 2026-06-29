import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";

import { DefaultTransactionFetcherService } from "./DefaultTransactionFetcherService";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

const fakeMessageBytes = new Uint8Array([1, 2, 3, 4]);

vi.mock("@ledgerhq/device-management-kit", () => ({
  bufferToBase64String: (bytes: Uint8Array): string => toBase64(bytes),
}));

describe("DefaultTransactionFetcherService", () => {
  let getTransactionMessageMock: ReturnType<typeof vi.fn>;
  let dataSource: SolanaTransactionDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    getTransactionMessageMock = vi.fn();
    dataSource = {
      getAccountsData: vi.fn(),
      getTransactionMessage: getTransactionMessageMock,
    };
  });

  it("should pass the signature and RPC URL through to the datasource", async () => {
    getTransactionMessageMock.mockResolvedValue(fakeMessageBytes);
    const service = new DefaultTransactionFetcherService(dataSource);

    await service.fetchTransaction(
      "test-sig",
      "https://custom-rpc.example.com",
    );

    expect(getTransactionMessageMock).toHaveBeenCalledWith(
      "test-sig",
      "https://custom-rpc.example.com",
    );
  });

  it("should throw when the transaction is not found", async () => {
    getTransactionMessageMock.mockResolvedValue(null);
    const service = new DefaultTransactionFetcherService(dataSource);

    await expect(service.fetchTransaction("missing-sig")).rejects.toThrow(
      "Transaction not found: missing-sig",
    );
  });

  it("should return base64 serialised message bytes on success", async () => {
    getTransactionMessageMock.mockResolvedValue(fakeMessageBytes);
    const service = new DefaultTransactionFetcherService(dataSource);

    const result = await service.fetchTransaction("test-signature");

    expect(result).toBe(toBase64(fakeMessageBytes));
  });
});

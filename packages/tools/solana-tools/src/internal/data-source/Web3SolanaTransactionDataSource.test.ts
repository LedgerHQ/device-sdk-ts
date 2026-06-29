import { Connection, PublicKey } from "@solana/web3.js";

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Connection: vi.fn(),
  };
});

import { Web3SolanaTransactionDataSource } from "./Web3SolanaTransactionDataSource";

const addressOne = new PublicKey(new Uint8Array(32).fill(1));
const addressTwo = new PublicKey(new Uint8Array(32).fill(2));

describe("Web3SolanaTransactionDataSource", () => {
  let getMultipleAccountsInfoMock: ReturnType<typeof vi.fn>;
  let getTransactionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getMultipleAccountsInfoMock = vi.fn();
    getTransactionMock = vi.fn();
    vi.mocked(Connection).mockImplementation(
      () =>
        ({
          getMultipleAccountsInfo: getMultipleAccountsInfoMock,
          getTransaction: getTransactionMock,
        }) as unknown as Connection,
    );
  });

  describe("getAccountsData", () => {
    it("should use the default RPC URL when none is provided", async () => {
      getMultipleAccountsInfoMock.mockResolvedValue([]);
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getAccountsData([addressOne]);

      expect(Connection).toHaveBeenCalledWith(
        "https://solana.coin.ledger.com",
        "confirmed",
      );
    });

    it("should use a custom RPC URL when provided", async () => {
      getMultipleAccountsInfoMock.mockResolvedValue([]);
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getAccountsData(
        [addressOne],
        "https://custom-rpc.example.com",
      );

      expect(Connection).toHaveBeenCalledWith(
        "https://custom-rpc.example.com",
        "confirmed",
      );
    });

    it("should batch every address into a single RPC request", async () => {
      getMultipleAccountsInfoMock.mockResolvedValue([]);
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getAccountsData([addressOne, addressTwo]);

      expect(getMultipleAccountsInfoMock).toHaveBeenCalledTimes(1);
      expect(getMultipleAccountsInfoMock).toHaveBeenCalledWith([
        addressOne,
        addressTwo,
      ]);
    });

    it("should return the raw data buffers aligned with the requested order", async () => {
      const dataOne = new Uint8Array([1]);
      const dataTwo = new Uint8Array([2]);
      getMultipleAccountsInfoMock.mockResolvedValue([
        { data: dataOne },
        { data: dataTwo },
      ]);
      const dataSource = new Web3SolanaTransactionDataSource();

      const result = await dataSource.getAccountsData([addressOne, addressTwo]);

      expect(result).toEqual([dataOne, dataTwo]);
    });

    it("should map a missing account to null", async () => {
      getMultipleAccountsInfoMock.mockResolvedValue([
        { data: new Uint8Array([1]) },
        null,
      ]);
      const dataSource = new Web3SolanaTransactionDataSource();

      const result = await dataSource.getAccountsData([addressOne, addressTwo]);

      expect(result[1]).toBeNull();
    });
  });

  describe("getTransactionMessage", () => {
    const fakeMessageBytes = new Uint8Array([1, 2, 3, 4]);

    it("should use the default RPC URL when none is provided", async () => {
      getTransactionMock.mockResolvedValue({
        transaction: { message: { serialize: () => fakeMessageBytes } },
      });
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getTransactionMessage("test-sig");

      expect(Connection).toHaveBeenCalledWith(
        "https://solana.coin.ledger.com",
        "confirmed",
      );
    });

    it("should use a custom RPC URL when provided", async () => {
      getTransactionMock.mockResolvedValue({
        transaction: { message: { serialize: () => fakeMessageBytes } },
      });
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getTransactionMessage(
        "test-sig",
        "https://custom-rpc.example.com",
      );

      expect(Connection).toHaveBeenCalledWith(
        "https://custom-rpc.example.com",
        "confirmed",
      );
    });

    it("should request the transaction with maxSupportedTransactionVersion 0", async () => {
      getTransactionMock.mockResolvedValue({
        transaction: { message: { serialize: () => fakeMessageBytes } },
      });
      const dataSource = new Web3SolanaTransactionDataSource();

      await dataSource.getTransactionMessage("test-sig");

      expect(getTransactionMock).toHaveBeenCalledWith("test-sig", {
        maxSupportedTransactionVersion: 0,
      });
    });

    it("should return the serialized message bytes on success", async () => {
      getTransactionMock.mockResolvedValue({
        transaction: { message: { serialize: () => fakeMessageBytes } },
      });
      const dataSource = new Web3SolanaTransactionDataSource();

      const result = await dataSource.getTransactionMessage("test-sig");

      expect(result).toBe(fakeMessageBytes);
    });

    it("should return null when the transaction is not found", async () => {
      getTransactionMock.mockResolvedValue(null);
      const dataSource = new Web3SolanaTransactionDataSource();

      const result = await dataSource.getTransactionMessage("missing-sig");

      expect(result).toBeNull();
    });
  });
});

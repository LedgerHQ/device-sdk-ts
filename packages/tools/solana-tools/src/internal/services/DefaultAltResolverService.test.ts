import {
  AddressLookupTableAccount,
  PublicKey,
  type VersionedMessage,
} from "@solana/web3.js";

import { type SolanaTransactionDataSource } from "@internal/data-source/SolanaTransactionDataSource";

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    AddressLookupTableAccount: class {
      key: PublicKey;
      state: unknown;
      constructor(args: { key: PublicKey; state: unknown }) {
        this.key = args.key;
        this.state = args.state;
      }
      static deserialize = vi.fn();
    },
  };
});

import { DefaultAltResolverService } from "./DefaultAltResolverService";

const tableKeyOne = new PublicKey(new Uint8Array(32).fill(1));
const tableKeyTwo = new PublicKey(new Uint8Array(32).fill(2));

function legacyMessage(): VersionedMessage {
  return { version: "legacy" } as unknown as VersionedMessage;
}

function v0Message(tableKeys: PublicKey[]): VersionedMessage {
  return {
    version: 0,
    addressTableLookups: tableKeys.map((accountKey) => ({
      accountKey,
      writableIndexes: [],
      readonlyIndexes: [],
    })),
  } as unknown as VersionedMessage;
}

describe("DefaultAltResolverService", () => {
  let getAccountsDataMock: ReturnType<typeof vi.fn>;
  let deserializeMock: ReturnType<typeof vi.fn>;
  let dataSource: SolanaTransactionDataSource;

  beforeEach(() => {
    vi.clearAllMocks();
    getAccountsDataMock = vi.fn();
    dataSource = {
      getAccountsData: getAccountsDataMock,
      getTransactionMessage: vi.fn(),
    };
    deserializeMock = vi.mocked(AddressLookupTableAccount.deserialize);
  });

  it("should return an empty array for a legacy message without hitting the datasource", async () => {
    const service = new DefaultAltResolverService(dataSource);

    const result = await service.resolveAddressLookupTables(legacyMessage());

    expect(result).toEqual([]);
    expect(getAccountsDataMock).not.toHaveBeenCalled();
  });

  it("should return an empty array for a v0 message with no lookup tables", async () => {
    const service = new DefaultAltResolverService(dataSource);

    const result = await service.resolveAddressLookupTables(v0Message([]));

    expect(result).toEqual([]);
    expect(getAccountsDataMock).not.toHaveBeenCalled();
  });

  it("should forward the referenced tables and the RPC URL to the datasource", async () => {
    getAccountsDataMock.mockResolvedValue([new Uint8Array([1])]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService(dataSource);

    await service.resolveAddressLookupTables(
      v0Message([tableKeyOne]),
      "https://custom-rpc.example.com",
    );

    expect(getAccountsDataMock).toHaveBeenCalledWith(
      [tableKeyOne],
      "https://custom-rpc.example.com",
    );
  });

  it("should return the fully built tables aligned with the requested order", async () => {
    const stateOne = { addresses: ["one"] };
    const stateTwo = { addresses: ["two"] };
    getAccountsDataMock.mockResolvedValue([
      new Uint8Array([1]),
      new Uint8Array([2]),
    ]);
    deserializeMock.mockReturnValueOnce(stateOne).mockReturnValueOnce(stateTwo);
    const service = new DefaultAltResolverService(dataSource);

    const result = await service.resolveAddressLookupTables(
      v0Message([tableKeyOne, tableKeyTwo]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]!.key).toBe(tableKeyOne);
    expect(result[0]!.state).toBe(stateOne);
    expect(result[1]!.key).toBe(tableKeyTwo);
    expect(result[1]!.state).toBe(stateTwo);
  });

  it("should deserialize each table from its raw account data", async () => {
    const data = new Uint8Array([9, 9, 9]);
    getAccountsDataMock.mockResolvedValue([data]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService(dataSource);

    await service.resolveAddressLookupTables(v0Message([tableKeyOne]));

    expect(deserializeMock).toHaveBeenCalledWith(data);
  });

  it("should throw a clear error when a referenced table is missing or closed", async () => {
    getAccountsDataMock.mockResolvedValue([new Uint8Array([1]), null]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService(dataSource);

    await expect(
      service.resolveAddressLookupTables(v0Message([tableKeyOne, tableKeyTwo])),
    ).rejects.toThrow(
      `Address lookup table not found or closed: ${tableKeyTwo.toBase58()}`,
    );
  });
});

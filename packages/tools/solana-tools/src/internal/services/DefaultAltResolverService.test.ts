import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  type VersionedMessage,
} from "@solana/web3.js";

vi.mock("@solana/web3.js", async () => {
  const actual = await vi.importActual("@solana/web3.js");
  return {
    ...actual,
    Connection: vi.fn(),
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
  let getMultipleAccountsInfoMock: ReturnType<typeof vi.fn>;
  let deserializeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getMultipleAccountsInfoMock = vi.fn();
    vi.mocked(Connection).mockImplementation(
      () =>
        ({
          getMultipleAccountsInfo: getMultipleAccountsInfoMock,
        }) as unknown as Connection,
    );
    deserializeMock = vi.mocked(AddressLookupTableAccount.deserialize);
  });

  it("should return an empty array for a legacy message without hitting the RPC", async () => {
    const service = new DefaultAltResolverService();

    const result = await service.resolveAddressLookupTables(legacyMessage());

    expect(result).toEqual([]);
    expect(Connection).not.toHaveBeenCalled();
  });

  it("should return an empty array for a v0 message with no lookup tables", async () => {
    const service = new DefaultAltResolverService();

    const result = await service.resolveAddressLookupTables(v0Message([]));

    expect(result).toEqual([]);
    expect(Connection).not.toHaveBeenCalled();
  });

  it("should use the default RPC URL when none is provided", async () => {
    getMultipleAccountsInfoMock.mockResolvedValue([
      { data: new Uint8Array([1]) },
    ]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService();

    await service.resolveAddressLookupTables(v0Message([tableKeyOne]));

    expect(Connection).toHaveBeenCalledWith(
      "https://solana.coin.ledger.com",
      "confirmed",
    );
  });

  it("should use a custom RPC URL when provided", async () => {
    getMultipleAccountsInfoMock.mockResolvedValue([
      { data: new Uint8Array([1]) },
    ]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService();

    await service.resolveAddressLookupTables(
      v0Message([tableKeyOne]),
      "https://custom-rpc.example.com",
    );

    expect(Connection).toHaveBeenCalledWith(
      "https://custom-rpc.example.com",
      "confirmed",
    );
  });

  it("should batch every referenced table into a single RPC request", async () => {
    getMultipleAccountsInfoMock.mockResolvedValue([
      { data: new Uint8Array([1]) },
      { data: new Uint8Array([2]) },
    ]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService();

    await service.resolveAddressLookupTables(
      v0Message([tableKeyOne, tableKeyTwo]),
    );

    expect(getMultipleAccountsInfoMock).toHaveBeenCalledTimes(1);
    expect(getMultipleAccountsInfoMock).toHaveBeenCalledWith([
      tableKeyOne,
      tableKeyTwo,
    ]);
  });

  it("should return the fully built tables aligned with the requested order", async () => {
    const stateOne = { addresses: ["one"] };
    const stateTwo = { addresses: ["two"] };
    getMultipleAccountsInfoMock.mockResolvedValue([
      { data: new Uint8Array([1]) },
      { data: new Uint8Array([2]) },
    ]);
    deserializeMock.mockReturnValueOnce(stateOne).mockReturnValueOnce(stateTwo);
    const service = new DefaultAltResolverService();

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
    getMultipleAccountsInfoMock.mockResolvedValue([{ data }]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService();

    await service.resolveAddressLookupTables(v0Message([tableKeyOne]));

    expect(deserializeMock).toHaveBeenCalledWith(data);
  });

  it("should throw a clear error when a referenced table is missing or closed", async () => {
    getMultipleAccountsInfoMock.mockResolvedValue([
      { data: new Uint8Array([1]) },
      null,
    ]);
    deserializeMock.mockReturnValue({ addresses: [] });
    const service = new DefaultAltResolverService();

    await expect(
      service.resolveAddressLookupTables(v0Message([tableKeyOne, tableKeyTwo])),
    ).rejects.toThrow(
      `Address lookup table not found or closed: ${tableKeyTwo.toBase58()}`,
    );
  });
});

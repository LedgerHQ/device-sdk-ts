import {
  CommandResultFactory,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";

import { GetTrustedInputCommand } from "@internal/app-binder/command/GetTrustedInputCommand";
import { signTransactionFromLedgerWalletLogs20260615 } from "@internal/app-binder/task/__fixtures__/signTransactionFromLedgerWalletLogs2026-06-15";
import {
  getZcashBranchId,
  serializeTransaction,
  toInternalTransaction,
} from "@internal/app-binder/task/utils/legacyTransactionUtils";

import { GetTrustedInputTask } from "./GetTrustedInputTask";

const TRANSPARENT_V5_TX_HEX =
  "050000800a27a7265510e7c8000000000000000001e1360c957489515ddfb5c564962e2c8cb2dc3c651c4a219e25e0b5e569f49d33000000006b4830450221008844cfb8d9983226f74cdd20cb63ee282360374def5de88d093df7f340775d65022072673cea8cd2092484c11c6e8c35ab765a9501024a96265bdd3b80d0c46f9190012102495e50ff5127b9b74083bad438208c7a39ddd83301cd04e40bff5556d3351ab30000000002a0860100000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388accedb0e00000000001976a9142495eecd3d7ea979d2066da533f45956a3a6b5c888ac000000";
const V4_NU6_TX_HEX =
  "0400008085202f89f04dec4d02ffc3d6a9f3ce6b33c05b7499746418b7bbcb17c9a866524a564987bc49b3e294010000006a47304402205adbc4bd6f79d13382f7164a45896c163061649eb39ad21eb7e59e7977f400c202203ade10c6b9a9807791fa6d0bf2c4c3d7bcb4215175e8f2145662a4e8e4c09bdd012103fa6cc45c6e74329a47794ed716525d4b13c4f939adc85e3349ef613eb351bf72feffffff8d191647f23b95ac8d4fd5cf33d946c24a6107046deeaae83704b832dac59217000000006b483045022100f3ca4de2dc6a5c3b00b2cfe31346c050485c65528f7baa24b77fb2507da00dfc0220593452243ded66620cbec5a698e8b2209e5d54c3106fc5ecbd7621bd1acb6f34012103fa6cc45c6e74329a47794ed716525d4b13c4f939adc85e3349ef613eb351bf72feffffff0270af8b00000000001976a9140a773e79f573c395ebee90498d944dedd733e88988acf9261a00000000001976a914657114e0abfc055161fcf9c95c5e238c59bc30cb88ac000000000000000f000000000000000000000000000000000000";

const EXPECTED_APDUS = [
  "e04200001100000001050000800a27a7265510e7c801",
  "e042800025e1360c957489515ddfb5c564962e2c8cb2dc3c651c4a219e25e0b5e569f49d33000000006b",
  "e0428000324830450221008844cfb8d9983226f74cdd20cb63ee282360374def5de88d093df7f340775d65022072673cea8cd2092484c1",
  "e0428000321c6e8c35ab765a9501024a96265bdd3b80d0c46f9190012102495e50ff5127b9b74083bad438208c7a39ddd83301cd04e40b",
  "e04280000bff5556d3351ab300000000",
  "e04280000102",
  "e042800022a0860100000000001976a914a96e684ec46cd8a2f98d6ef4b847c0ee88395e9388ac",
  "e042800022cedb0e00000000001976a9142495eecd3d7ea979d2066da533f45956a3a6b5c888ac",
  "e042800003000000",
  "e042800009000000000400000000",
];

const hexToBytes = (hex: string): Uint8Array =>
  Uint8Array.from(Buffer.from(hex, "hex"));
const bytesToHex = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("hex");

const makeSuccessResponse = (byte: number) => ({
  statusCode: new Uint8Array([0x90, 0x00]),
  data: new Uint8Array([byte]),
});

describe("GetTrustedInputTask", () => {
  let apiMock: InternalApi;

  beforeEach(() => {
    apiMock = {
      sendCommand: vi.fn(),
    } as unknown as InternalApi;
  });

  it("sends the expected trusted-input APDU sequence and returns the last response", async () => {
    const txBytes = hexToBytes(TRANSPARENT_V5_TX_HEX);
    const lastResponse = makeSuccessResponse(0x09);

    EXPECTED_APDUS.forEach((_, index) => {
      const response =
        index === EXPECTED_APDUS.length - 1
          ? lastResponse
          : makeSuccessResponse(index);
      vi.mocked(apiMock.sendCommand).mockResolvedValueOnce(
        CommandResultFactory({ data: response }),
      );
    });

    const result = await new GetTrustedInputTask(apiMock, {
      transaction: txBytes,
      indexLookup: 1,
    }).run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(EXPECTED_APDUS.length);
    EXPECTED_APDUS.forEach((expectedApduHex, index) => {
      const command = vi.mocked(apiMock.sendCommand).mock.calls[index]?.[0];
      expect(command).toBeInstanceOf(GetTrustedInputCommand);
      const apdu = (command as GetTrustedInputCommand).getApdu().getRawApdu();
      expect(apdu).toEqual(hexToBytes(expectedApduHex));
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data).toEqual(lastResponse);
    }
  });

  it("returns the first command error without sending remaining chunks", async () => {
    const txBytes = hexToBytes(TRANSPARENT_V5_TX_HEX);
    const expectedError = new InvalidStatusWordError("Command failed");

    vi.mocked(apiMock.sendCommand)
      .mockResolvedValueOnce(
        CommandResultFactory({ data: makeSuccessResponse(0x01) }),
      )
      .mockResolvedValueOnce(CommandResultFactory({ error: expectedError }));

    const result = await new GetTrustedInputTask(apiMock, {
      transaction: txBytes,
      indexLookup: 1,
    }).run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toEqual(DmkResultFactory({ error: expectedError }));
  });

  it("uses the v4 trailing bytes as the final chunk", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    await new GetTrustedInputTask(apiMock, {
      transaction: hexToBytes(V4_NU6_TX_HEX),
      indexLookup: 1,
    }).run();

    const sentCommands = vi
      .mocked(apiMock.sendCommand)
      .mock.calls.map(([command]) => command as GetTrustedInputCommand);

    const firstChunkData = sentCommands[0]?.getApdu().getRawApdu().slice(5);
    expect(firstChunkData).toBeDefined();
    expect(bytesToHex(firstChunkData ?? new Uint8Array())).toBe(
      "000000010400008085202f89f04dec4d02",
    );

    const lastChunkData = sentCommands.at(-1)?.getApdu().getRawApdu().slice(5);
    expect(lastChunkData).toBeDefined();
    expect(bytesToHex(lastChunkData ?? new Uint8Array())).toBe(
      "000000000f000000000000000000000000000000000000",
    );
  });

  it("frames a v4/Sapling previous transaction with the input count right after the branch id (regression: 2026-06-15 device 6a80)", async () => {
    vi.mocked(apiMock.sendCommand).mockResolvedValue(
      CommandResultFactory({ data: makeSuccessResponse(0x01) }),
    );

    // Reproduce SignTransactionTask's prep for input[0]: the v4/Sapling prev tx
    // with a (valid) consensus branch id attached, then serialized for GetTrustedInput.
    const [legacyPrevTx, , , , branchHeight] =
      signTransactionFromLedgerWalletLogs20260615.transactionArg.inputs[0]!;
    const prevTx = toInternalTransaction(legacyPrevTx);
    prevTx.consensusBranchId = getZcashBranchId(branchHeight);
    const serialized = serializeTransaction(prevTx, prevTx.timestamp);

    await new GetTrustedInputTask(apiMock, {
      transaction: serialized,
      indexLookup: 0,
    }).run();

    const firstChunkData = vi
      .mocked(apiMock.sendCommand)
      .mock.calls[0]?.[0] as GetTrustedInputCommand;
    const header = bytesToHex(
      firstChunkData.getApdu().getRawApdu().slice(5),
    );

    // indexLookup(00000000) | version(04000080) | vgid(85202f89) | branchId | vin_count.
    // The prev tx has 3 transparent inputs, so the count MUST be 03.
    // Before the fix, serializeTransaction put locktime/expiry in the v4 header,
    // so the chunker read the count off the locktime byte → "...f04dec4d00" (0 inputs)
    // → the device misparsed the stream and returned 6a80.
    expect(header).toBe("000000000400008085202f89f04dec4d03");
  });

  it("throws for malformed transaction input before sending any command", async () => {
    await expect(
      new GetTrustedInputTask(apiMock, {
        transaction: new Uint8Array([0x01, 0x02, 0x03]),
      }).run(),
    ).rejects.toThrow(
      "Malformed transaction while splitting trusted input chunks",
    );

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});

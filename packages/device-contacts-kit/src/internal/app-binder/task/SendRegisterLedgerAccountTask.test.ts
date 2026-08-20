// Validates that the TLV serializer + tag ordering + chunk framing produce the
// expected wire bytes for op 0x11 (Register Ledger Account). The framed chunk =
// 2-byte BE total length + TLV, with DERIVATION_PATH under tag 0x69. Tag order:
// STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME, DERIVATION_PATH, CHAIN_ID
// (Ethereum only), BLOCKCHAIN_FAMILY.
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";

import { SendRegisterLedgerAccountTask } from "./SendRegisterLedgerAccountTask";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// name="Alice", path="m/44'/60'/0'/0/0", chainId=1, family=ethereum(0x01).
const FRAMED_CHUNK_WITH_CHAIN = hexToBytes(
  "002a01012f020101f005416c6963656915058000002c8000003c800000000000000000000000230101510101",
);
// Same input without chainId — the 23 01 01 CHAIN_ID TLV is dropped.
const FRAMED_CHUNK_NO_CHAIN = hexToBytes(
  "002701012f020101f005416c6963656915058000002c8000003c800000000000000000000000510101",
);

const OK_PROOF = { hmacProof: hexToBytes("dd".repeat(32)) };

function makeApiMock(): InternalApi & {
  sendCommand: ReturnType<typeof vi.fn>;
} {
  return { sendCommand: vi.fn() } as unknown as InternalApi & {
    sendCommand: ReturnType<typeof vi.fn>;
  };
}

describe("SendRegisterLedgerAccountTask", () => {
  it("assembles the framed chunk and dispatches RegisterLedgerAccountCommand", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOF }),
    );

    const result = await new SendRegisterLedgerAccountTask(api, {
      accountName: "Alice",
      derivationPath: "m/44'/60'/0'/0/0",
      blockchainFamily: "ethereum",
      chainId: 1n,
    }).run();

    expect(api.sendCommand.mock.calls).toHaveLength(1);
    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterLedgerAccountCommand({
        data: FRAMED_CHUNK_WITH_CHAIN,
        p2: 0x00,
      }),
    );
    expect(result).toStrictEqual(CommandResultFactory({ data: OK_PROOF }));
  });

  it("accepts a path without the leading master 'm' segment", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOF }),
    );

    await new SendRegisterLedgerAccountTask(api, {
      accountName: "Alice",
      derivationPath: "44'/60'/0'/0/0",
      blockchainFamily: "ethereum",
      chainId: 1n,
    }).run();

    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterLedgerAccountCommand({
        data: FRAMED_CHUNK_WITH_CHAIN,
        p2: 0x00,
      }),
    );
  });

  it("omits the CHAIN_ID TLV when chainId is not provided", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOF }),
    );

    await new SendRegisterLedgerAccountTask(api, {
      accountName: "Alice",
      derivationPath: "m/44'/60'/0'/0/0",
      blockchainFamily: "ethereum",
    }).run();

    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterLedgerAccountCommand({
        data: FRAMED_CHUNK_NO_CHAIN,
        p2: 0x00,
      }),
    );
  });

  it("returns an InvalidStatusWordError when the final chunk carries no hmac_proof", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(CommandResultFactory({ data: {} }));

    const result = await new SendRegisterLedgerAccountTask(api, {
      accountName: "Alice",
      derivationPath: "m/44'/60'/0'/0/0",
      blockchainFamily: "ethereum",
      chainId: 1n,
    }).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError(
          "RegisterLedgerAccount final-chunk response did not carry hmac_proof",
        ),
      }),
    );
  });

  it("propagates command-level errors", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );

    const result = await new SendRegisterLedgerAccountTask(api, {
      accountName: "Alice",
      derivationPath: "m/44'/60'/0'/0/0",
      blockchainFamily: "ethereum",
      chainId: 1n,
    }).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );
  });

  it("throws on an unsupported blockchain family", async () => {
    const api = makeApiMock();

    await expect(
      new SendRegisterLedgerAccountTask(api, {
        accountName: "Alice",
        derivationPath: "m/44'/60'/0'/0/0",
        blockchainFamily: "dogecoin",
        chainId: 1n,
      }).run(),
    ).rejects.toThrow(/Unsupported blockchain family/);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});

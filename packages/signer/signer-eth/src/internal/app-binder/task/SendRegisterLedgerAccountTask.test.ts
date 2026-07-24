// Validates op 5 (Register Ledger Account): the TLV is framed (2-byte BE length
// prefix, DERIVATION_PATH under tag 0x69) and dispatched, then a silent
// GetAddress derives the address. The playground fixtures are stale (pre-1.23
// tag 0x21, no length prefix).
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendRegisterLedgerAccountTask } from "./SendRegisterLedgerAccountTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const TASK_ARGS = {
  name: "Vault",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
};

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Framed chunk for name="Vault", path=m/44'/60'/0'/0/0, chainId=1.
const VAULT_FRAMED_CHUNK = hexToBytes(
  "002b01012f02010181f0055661756c746915058000002c8000003c800000000000000000000000230101510101",
);

const HMAC_PROOF_HEX = "ab".repeat(32);

describe("SendRegisterLedgerAccountTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("frames + dispatches the Register APDU then GetAddress, returning { hmacProofHex, addressHex } normalised", async () => {
    apiMock.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: "0xDEADBEEFdeadbeefDEADBEEFdeadbeefDEADBEEF" },
        }),
      );

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterLedgerAccountCommand({ data: VAULT_FRAMED_CHUNK, p2: 0x00 }),
    );
    expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
      new GetAddressCommand({
        derivationPath: TASK_ARGS.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
        chainId: TASK_ARGS.chainId,
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          hmacProofHex: HMAC_PROOF_HEX,
          addressHex: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        },
      }),
    );
  });

  it("returns the Register error without invoking GetAddress when the first APDU fails", async () => {
    const registerError = CommandResultFactory({
      error: new InvalidStatusWordError("user cancelled"),
    });
    apiMock.sendCommand.mockResolvedValueOnce(registerError);

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(result).toBe(registerError);
  });

  it("propagates GetAddress errors", async () => {
    const addressError = CommandResultFactory({
      error: new InvalidStatusWordError("get address failed"),
    });
    apiMock.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      )
      .mockResolvedValueOnce(addressError);

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
    expect(result).toBe(addressError);
  });
});

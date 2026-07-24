// Validates op 6 (Edit Ledger Account / rename): the TLV is framed (2-byte BE
// length prefix, DERIVATION_PATH under tag 0x69) and dispatched as a single
// EditLedgerAccountCommand. The playground fixtures are stale (pre-1.23 tag
// 0x21, no length prefix).
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { EditLedgerAccountCommand } from "@internal/app-binder/command/EditLedgerAccountCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendEditLedgerAccountTask } from "./SendEditLedgerAccountTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const TASK_ARGS = {
  name: "Safe",
  oldName: "Vault",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
  hmacProofHex: "ee".repeat(32),
};

const ROTATED_PROOF_HEX = "ab".repeat(32);

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Framed chunk: edit "Vault" → "Safe", path m/44'/60'/0'/0/0, chainId 1,
// hmac_proof = ee*32.
const EDIT_FRAMED_CHUNK = hexToBytes(
  "005401013002010181f0045361666581f3055661756c746915058000002c8000003c8000000000000000000000002301012920eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee510101",
);

describe("SendEditLedgerAccountTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("frames + sends a single EditLedgerAccountCommand and returns the rotated hmacProofHex", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: { hmacProofHex: ROTATED_PROOF_HEX } }),
    );

    const result = await new SendEditLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new EditLedgerAccountCommand({ data: EDIT_FRAMED_CHUNK, p2: 0x00 }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({ data: { hmacProofHex: ROTATED_PROOF_HEX } }),
    );
  });

  it("propagates the command error (e.g. seed mismatch)", async () => {
    const error = CommandResultFactory({
      error: new InvalidStatusWordError("seed mismatch"),
    });
    apiMock.sendCommand.mockResolvedValueOnce(error);

    const result = await new SendEditLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(result).toBe(error);
  });
});

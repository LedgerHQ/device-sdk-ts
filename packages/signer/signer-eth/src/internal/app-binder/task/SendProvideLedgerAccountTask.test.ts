// Validates that the TLV serializer + tag ordering produces byte-equal
// payloads against the playground fixture
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - send_eth_with_both_provides → exchange 0 (Provide Ledger Account,
//     P1=0x21, "Vault" from-side decoration)
// Single chunk (frame length 0x004d = 77-byte TLV; total post-header 79
// bytes including the 2-byte frame length prefix).
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { ProvideLedgerAccountCommand } from "@internal/app-binder/command/ProvideLedgerAccountCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendProvideLedgerAccountTask } from "./SendProvideLedgerAccountTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

const APDU_HEADER_LENGTH = 5;

const PROVIDE_LEDGER_ACCOUNT_REQUEST = hexToBytes(
  "b01021004f" +
    "004d" +
    "010134" +
    "020101" +
    "81f0055661756c74" +
    "69" +
    "15" +
    "058000002c8000003c800000000000000000000000" +
    "230101" +
    "510101" +
    "2920" +
    "ee".repeat(32),
);
const EXPECTED_FRAMED_PAYLOAD =
  PROVIDE_LEDGER_ACCOUNT_REQUEST.slice(APDU_HEADER_LENGTH);

describe("SendProvideLedgerAccountTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const okResponse = CommandResultFactory<Record<string, never>>({
    data: {},
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("assembles a single-chunk payload byte-equal to the fixture and dispatches ProvideLedgerAccountCommand", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(okResponse);

    await new SendProvideLedgerAccountTask(apiMock, {
      accountName: "Vault",
      hmacProofHex: "ee".repeat(32),
      derivationPath: "44'/60'/0'/0/0",
      chainId: 1,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new ProvideLedgerAccountCommand({
        data: EXPECTED_FRAMED_PAYLOAD,
        p2: 0x00,
      }),
    );
  });

  it("propagates command-level errors", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("HMAC mismatch"),
      }),
    );

    const result = await new SendProvideLedgerAccountTask(apiMock, {
      accountName: "Vault",
      hmacProofHex: "ee".repeat(32),
      derivationPath: "44'/60'/0'/0/0",
      chainId: 1,
      logger: mockLogger,
    }).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("HMAC mismatch"),
      }),
    );
  });
});

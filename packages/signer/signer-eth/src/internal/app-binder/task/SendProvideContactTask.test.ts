// Validates that the TLV serializer + tag ordering produces byte-equal
// payloads against the playground fixture
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - send_eth_with_both_provides → exchange 1 (Provide Contact, P1=0x20)
// Single chunk (frame length 0x00d5 = 213-byte TLV; total post-header 215
// bytes including the 2-byte frame length prefix).
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { ProvideContactCommand } from "@internal/app-binder/command/ProvideContactCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendProvideContactTask } from "./SendProvideContactTask";

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

// Full APDU from the fixture; the Command receives the post-header bytes
// (Lc-counted body) = 2-byte frame length prefix + 213-byte TLV.
const PROVIDE_CONTACT_REQUEST = hexToBytes(
  "b0102000d7" +
    "00d5" +
    "010133" +
    "020101" +
    "81f005416c696365" +
    "81f108457468206d61696e" +
    "81f21400000000000000000000000000000000deadbeef" +
    "81f640" +
    "cc".repeat(64) +
    "69" +
    "15" +
    "058000002c8000003c800000000000000000000000" +
    "230101" +
    "510101" +
    "2920" +
    "dd".repeat(32) +
    "81f720" +
    "aa".repeat(32),
);
const EXPECTED_FRAMED_PAYLOAD =
  PROVIDE_CONTACT_REQUEST.slice(APDU_HEADER_LENGTH);

describe("SendProvideContactTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const okResponse = CommandResultFactory<Record<string, never>>({
    data: {},
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("assembles a single-chunk payload byte-equal to the fixture and dispatches ProvideContactCommand", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(okResponse);

    await new SendProvideContactTask(apiMock, {
      contactName: "Alice",
      scope: "Eth main",
      addressHex: "00000000000000000000000000000000deadbeef",
      groupHandleHex: "cc".repeat(64),
      hmacNameHex: "dd".repeat(32),
      hmacRestHex: "aa".repeat(32),
      derivationPath: "44'/60'/0'/0/0",
      chainId: 1,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new ProvideContactCommand({
        data: EXPECTED_FRAMED_PAYLOAD,
        p2: 0x00,
      }),
    );
  });

  it("propagates command-level errors", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );

    const result = await new SendProvideContactTask(apiMock, {
      contactName: "Alice",
      scope: "Eth main",
      addressHex: "00000000000000000000000000000000deadbeef",
      groupHandleHex: "cc".repeat(64),
      hmacNameHex: "dd".repeat(32),
      hmacRestHex: "aa".repeat(32),
      derivationPath: "44'/60'/0'/0/0",
      chainId: 1,
      logger: mockLogger,
    }).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );
  });
});

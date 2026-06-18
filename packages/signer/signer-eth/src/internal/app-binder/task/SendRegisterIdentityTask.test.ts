// Validates that the TLV serializer + tag ordering produces byte-equal
// payloads against the playground fixtures at
// ~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json
//   - register_external_address_first_time
//   - register_external_address_extends_existing
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { RegisterIdentityCommand } from "@internal/app-binder/command/RegisterIdentityCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendRegisterIdentityTask } from "./SendRegisterIdentityTask";

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

const FRESH_FIXTURE_REQUEST = hexToBytes(
  "b01001004d01012d02010181f005416c69636581f108457468206d61696e81f21400000000000000000000000000000000deadbeef2115058000002c8000003c800000000000000000000000230101510101",
);
const FRESH_EXPECTED_PAYLOAD = FRESH_FIXTURE_REQUEST.slice(APDU_HEADER_LENGTH);

const EXTENSION_FIXTURE_REQUEST = hexToBytes(
  "b0100100b301012d02010181f005416c69636581f108417262206d61696e81f21444444444444444444444444444444444444444442115058000002c8000003c8000000000000000000000002302a4b151010181f640cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc2920dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);
const EXTENSION_EXPECTED_PAYLOAD =
  EXTENSION_FIXTURE_REQUEST.slice(APDU_HEADER_LENGTH);

describe("SendRegisterIdentityTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const okResponse = CommandResultFactory({
    data: {
      groupHandleHex: "cc".repeat(64),
      hmacNameHex: "dd".repeat(32),
      hmacRestHex: "aa".repeat(32),
    },
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("assembles a fresh-register payload byte-equal to fixture and dispatches RegisterIdentityCommand", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(okResponse);

    await new SendRegisterIdentityTask(apiMock, {
      name: "Alice",
      addressHex: "00000000000000000000000000000000deadbeef",
      scope: "Eth main",
      derivationPath: "44'/60'/0'/0/0",
      chainId: 1,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterIdentityCommand({ data: FRESH_EXPECTED_PAYLOAD }),
    );
  });

  it("appends GROUP_HANDLE + HMAC_PROOF on extension and matches the extension fixture", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(okResponse);

    await new SendRegisterIdentityTask(apiMock, {
      name: "Alice",
      addressHex: "4444444444444444444444444444444444444444",
      scope: "Arb main",
      derivationPath: "44'/60'/0'/0/0",
      chainId: 42161,
      extension: {
        groupHandleHex: "cc".repeat(64),
        hmacProofHex: "dd".repeat(32),
      },
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterIdentityCommand({ data: EXTENSION_EXPECTED_PAYLOAD }),
    );
  });

  it("propagates command-level errors", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );

    const result = await new SendRegisterIdentityTask(apiMock, {
      name: "Alice",
      addressHex: "00000000000000000000000000000000deadbeef",
      scope: "Eth main",
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

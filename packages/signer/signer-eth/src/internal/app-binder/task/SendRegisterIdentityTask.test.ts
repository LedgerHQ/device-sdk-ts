// Validates that the TLV serializer + tag ordering + chunk framing produce the
// expected wire bytes for op 1 (Register Identity). The framed chunk = 2-byte
// BE total length + TLV, with DERIVATION_PATH under tag 0x69 (SDK 963d72b7).
// (The playground fixtures at ~/dev/ledger-contacts-playground were generated
// against the pre-1.23 protocol — tag 0x21, no length prefix — and are stale.)
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

// Framed chunk = "00 <Lc>" (2-byte BE total TLV length) + TLV. Derivation path
// under tag 0x69.
const FRESH_FRAMED_CHUNK = hexToBytes(
  "004d01012d02010181f005416c69636581f108457468206d61696e81f21400000000000000000000000000000000deadbeef6915058000002c8000003c800000000000000000000000230101510101",
);

const EXTENSION_FRAMED_CHUNK = hexToBytes(
  "00b301012d02010181f005416c69636581f108417262206d61696e81f21444444444444444444444444444444444444444446915058000002c8000003c8000000000000000000000002302a4b151010181f640cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc2920dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);

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

  it("assembles a fresh-register framed chunk and dispatches RegisterIdentityCommand", async () => {
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
      new RegisterIdentityCommand({ data: FRESH_FRAMED_CHUNK, p2: 0x00 }),
    );
  });

  it("appends GROUP_HANDLE + HMAC_PROOF on extension and frames the extension payload", async () => {
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
      new RegisterIdentityCommand({ data: EXTENSION_FRAMED_CHUNK, p2: 0x00 }),
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

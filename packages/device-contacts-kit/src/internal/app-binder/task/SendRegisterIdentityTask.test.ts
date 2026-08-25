// Validates that the TLV serializer + tag ordering + chunk framing produce the
// expected wire bytes for op 1 (Register Identity) on the TEST-ENV branch:
// tags >= 0x80 use the 2-byte DER form [0x81, tag], and REGISTER IDENTITY
// carries DERIVATION_PATH (tag 0x69, m/44'/60'/0'/0/0) as the deployed dev app
// requires. The framed chunk = 2-byte BE total length + TLV.
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { RegisterIdentityCommand } from "@internal/app-binder/command/RegisterIdentityCommand";

import { SendRegisterIdentityTask } from "./SendRegisterIdentityTask";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Framed chunk = "00 <Lc>" (2-byte BE total TLV length) + TLV. TEST-ENV tag
// order: STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER,
// DERIVATION_PATH, CHAIN_ID, BLOCKCHAIN_FAMILY, then optional GROUP_HANDLE +
// HMAC_PROOF. Tags >= 0x80 are encoded as [0x81, tag]; DERIVATION_PATH (0x69)
// packs m/44'/60'/0'/0/0 as "05 8000002c 8000003c 80000000 00000000 00000000".
const FRESH_FRAMED_CHUNK = hexToBytes(
  "004d01012d020101" +
    "81f005416c696365" +
    "81f108457468206d61696e" +
    "81f21400000000000000000000000000000000deadbeef" +
    "6915058000002c8000003c800000000000000000000000" +
    "230101510101",
);

const EXTENSION_FRAMED_CHUNK = hexToBytes(
  "00b301012d020101" +
    "81f005416c696365" +
    "81f108417262206d61696e" +
    "81f2144444444444444444444444444444444444444444" +
    "6915058000002c8000003c800000000000000000000000" +
    "2302a4b1510101" +
    "81f640cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" +
    "2920dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
);

const OK_PROOFS = {
  groupHandle: hexToBytes("cc".repeat(64)),
  hmacProof: hexToBytes("dd".repeat(32)),
  hmacRest: hexToBytes("aa".repeat(32)),
};

function makeApiMock(): InternalApi & {
  sendCommand: ReturnType<typeof vi.fn>;
} {
  return { sendCommand: vi.fn() } as unknown as InternalApi & {
    sendCommand: ReturnType<typeof vi.fn>;
  };
}

describe("SendRegisterIdentityTask", () => {
  it("assembles a fresh-register framed chunk and dispatches RegisterIdentityCommand", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOFS }),
    );

    const result = await new SendRegisterIdentityTask(api, {
      contactName: "Alice",
      scope: "Eth main",
      identifier: hexToBytes("00000000000000000000000000000000deadbeef"),
      blockchainFamily: "ethereum",
      chainId: 1n,
    }).run();

    expect(api.sendCommand.mock.calls).toHaveLength(1);
    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterIdentityCommand({ data: FRESH_FRAMED_CHUNK, p2: 0x00 }),
    );
    expect(result).toStrictEqual(CommandResultFactory({ data: OK_PROOFS }));
  });

  it("appends GROUP_HANDLE + HMAC_PROOF on extension and frames the extension payload", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOFS }),
    );

    await new SendRegisterIdentityTask(api, {
      contactName: "Alice",
      scope: "Arb main",
      identifier: hexToBytes("44".repeat(20)),
      blockchainFamily: "ethereum",
      chainId: 42161n,
      existingContactGroup: {
        groupHandle: hexToBytes("cc".repeat(64)),
        hmacProof: hexToBytes("dd".repeat(32)),
      },
    }).run();

    expect(api.sendCommand.mock.calls).toHaveLength(1);
    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterIdentityCommand({ data: EXTENSION_FRAMED_CHUNK, p2: 0x00 }),
    );
  });

  it("omits the CHAIN_ID TLV when chainId is not provided", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOFS }),
    );

    await new SendRegisterIdentityTask(api, {
      contactName: "Alice",
      scope: "Eth main",
      identifier: hexToBytes("00000000000000000000000000000000deadbeef"),
      blockchainFamily: "ethereum",
    }).run();

    const command = api.sendCommand.mock
      .calls[0]![0] as RegisterIdentityCommand;
    // No `23 01 ..` CHAIN_ID TLV; BLOCKCHAIN_FAMILY 51 01 01 follows the path.
    const framedHex = Buffer.from(command.args.data).toString("hex");
    expect(framedHex).not.toContain("230101");
    expect(framedHex.endsWith("510101")).toBe(true);
  });

  it("propagates command-level errors", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );

    const result = await new SendRegisterIdentityTask(api, {
      contactName: "Alice",
      scope: "Eth main",
      identifier: hexToBytes("00000000000000000000000000000000deadbeef"),
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
      new SendRegisterIdentityTask(api, {
        contactName: "Alice",
        scope: "Eth main",
        identifier: hexToBytes("00000000000000000000000000000000deadbeef"),
        blockchainFamily: "dogecoin",
        chainId: 1n,
      }).run(),
    ).rejects.toThrow(/Unsupported blockchain family/);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});

// Asserts the op-3 (Edit Identifier) framed chunk (2-byte BE length + TLV) is
// byte-for-byte parity with the signer-eth `edit_external_address` fixture.
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { EditExternalAddressIdentifierCommand } from "@internal/app-binder/command/EditExternalAddressIdentifierCommand";

import { SendEditExternalAddressIdentifierTask } from "./SendEditExternalAddressIdentifierTask";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

// Framed chunk = "00 d5" (2-byte BE total TLV length = 213) + TLV. No
// DERIVATION_PATH TLV (external-address ops carry no path).
const FRAMED_CHUNK = hexToBytes(
  "00d5" +
    "010131" +
    "020101" +
    "81f005416c696365" +
    "81f108457468206d61696e" +
    "81f2145555555555555555555555555555555555555555" +
    "81f41400000000000000000000000000000000deadbeef" +
    "81f640" +
    "cc".repeat(64) +
    "230101" +
    "2920" +
    "dd".repeat(32) +
    "81f720" +
    "aa".repeat(32) +
    "510101",
);

const OK_PROOF = { hmacRest: hexToBytes("88".repeat(32)) };

const BASE_ARGS = {
  contactName: "Alice",
  scope: "Eth main",
  newIdentifier: hexToBytes("55".repeat(20)),
  previousIdentifier: hexToBytes("00000000000000000000000000000000deadbeef"),
  blockchainFamily: "ethereum",
  chainId: 1n,
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

describe("SendEditExternalAddressIdentifierTask", () => {
  it("assembles the framed chunk byte-equal to the fixture and dispatches EditExternalAddressIdentifierCommand", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOF }),
    );

    const result = await new SendEditExternalAddressIdentifierTask(
      api,
      BASE_ARGS,
    ).run();

    expect(api.sendCommand.mock.calls).toHaveLength(1);
    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new EditExternalAddressIdentifierCommand({
        data: FRAMED_CHUNK,
        p2: 0x00,
      }),
    );
    expect(result).toStrictEqual(CommandResultFactory({ data: OK_PROOF }));
  });

  it("omits the CHAIN_ID TLV when chainId is not provided", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: OK_PROOF }),
    );

    await new SendEditExternalAddressIdentifierTask(api, {
      ...BASE_ARGS,
      chainId: undefined,
    }).run();

    const command = api.sendCommand.mock
      .calls[0]![0] as EditExternalAddressIdentifierCommand;
    const framedHex = Buffer.from(command.args.data).toString("hex");
    // No `23 01 ..` CHAIN_ID TLV; HMAC_PROOF (29 20 ..) follows the path directly.
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

    const result = await new SendEditExternalAddressIdentifierTask(
      api,
      BASE_ARGS,
    ).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );
  });

  it("errors when the final-chunk response does not carry hmac_rest", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(CommandResultFactory({ data: {} }));

    const result = await new SendEditExternalAddressIdentifierTask(
      api,
      BASE_ARGS,
    ).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError(
          "EditIdentifier final-chunk response did not carry hmac_rest",
        ),
      }),
    );
  });

  it("throws on an unsupported blockchain family", async () => {
    const api = makeApiMock();

    await expect(
      new SendEditExternalAddressIdentifierTask(api, {
        ...BASE_ARGS,
        blockchainFamily: "dogecoin",
      }).run(),
    ).rejects.toThrow(/Unsupported blockchain family/);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});

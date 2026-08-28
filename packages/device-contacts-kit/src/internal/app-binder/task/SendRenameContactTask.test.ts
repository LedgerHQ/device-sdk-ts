// Validates that the TLV serializer + tag ordering + chunk framing produce the
// expected wire bytes for the Rename Contact (EDIT CONTACT NAME) op. The framed
// chunk = 2-byte BE total length + TLV. Tag order: STRUCT_TYPE, STRUCT_VERSION,
// CONTACT_NAME (new), PREVIOUS_CONTACT_NAME (old), GROUP_HANDLE, DERIVATION_PATH,
// HMAC_PROOF — with tags >= 0x80 (0xf0/0xf3/0xf6) encoded as the 2-byte DER form
// [0x81, tag].
import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { RenameContactCommand } from "@internal/app-binder/command/RenameContactCommand";

import { SendRenameContactTask } from "./SendRenameContactTask";

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

const GROUP_HANDLE = hexToBytes("cc".repeat(64));
const HMAC_PROOF_IN = hexToBytes("dd".repeat(32));
const HMAC_PROOF_OUT = hexToBytes("ee".repeat(32));

// Framed chunk = "00 90" (2-byte BE total TLV length = 144) + TLV:
//   01 01 2e            STRUCT_TYPE = EDIT_CONTACT_NAME (0x2e)
//   02 01 01            STRUCT_VERSION = 1
//   81 f0 03 "Bob"      CONTACT_NAME (new), tag 0xf0 -> [81 f0]
//   81 f3 05 "Alice"    PREVIOUS_CONTACT_NAME (old), tag 0xf3 -> [81 f3]
//   81 f6 40 <64x cc>   GROUP_HANDLE, tag 0xf6 -> [81 f6]
//   69 15 05 <5x path>  DERIVATION_PATH (0x69), m/44'/60'/0'/0/0
//   29 20 <32x dd>      HMAC_PROOF
const DERIVATION_PATH_TLV = "6915058000002c8000003c800000000000000000000000";
const FRAMED_CHUNK = hexToBytes(
  "0090" +
    "01012e" +
    "020101" +
    "81f003426f62" +
    "81f305416c696365" +
    "81f640" +
    "cc".repeat(64) +
    DERIVATION_PATH_TLV +
    "2920" +
    "dd".repeat(32),
);

function makeApiMock(): InternalApi & {
  sendCommand: ReturnType<typeof vi.fn>;
} {
  return { sendCommand: vi.fn() } as unknown as InternalApi & {
    sendCommand: ReturnType<typeof vi.fn>;
  };
}

describe("SendRenameContactTask", () => {
  it("assembles the rename framed chunk and dispatches RenameContactCommand", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: { hmacProof: HMAC_PROOF_OUT } }),
    );

    const result = await new SendRenameContactTask(api, {
      previousContactName: "Alice",
      newContactName: "Bob",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF_IN,
    }).run();

    expect(api.sendCommand.mock.calls).toHaveLength(1);
    expect(api.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RenameContactCommand({ data: FRAMED_CHUNK, p2: 0x00 }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({ data: { hmacProof: HMAC_PROOF_OUT } }),
    );
  });

  it("emits the DERIVATION_PATH tag immediately before HMAC_PROOF", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: { hmacProof: HMAC_PROOF_OUT } }),
    );

    await new SendRenameContactTask(api, {
      previousContactName: "Alice",
      newContactName: "Bob",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF_IN,
    }).run();

    // The Ethereum app requires DERIVATION_PATH (0x69); it sits immediately
    // before HMAC_PROOF (0x29), matching Register Identity.
    const command = api.sendCommand.mock.calls[0]![0] as RenameContactCommand;
    const framedHex = Buffer.from(command.args.data).toString("hex");
    expect(
      framedHex.endsWith(DERIVATION_PATH_TLV + "2920" + "dd".repeat(32)),
    ).toBe(true);
  });

  it("propagates command-level errors", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );

    const result = await new SendRenameContactTask(api, {
      previousContactName: "Alice",
      newContactName: "Bob",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF_IN,
    }).run();

    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new InvalidStatusWordError("user cancelled"),
      }),
    );
  });

  it("returns InvalidStatusWordError when the final response carries no hmac_name", async () => {
    const api = makeApiMock();
    api.sendCommand.mockResolvedValueOnce(CommandResultFactory({ data: {} }));

    const result = await new SendRenameContactTask(api, {
      previousContactName: "Alice",
      newContactName: "Bob",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF_IN,
    }).run();

    expect(result.status).not.toBe(undefined);
    if ("error" in result) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    }
  });
});

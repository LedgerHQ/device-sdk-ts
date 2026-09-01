import {
  bufferToHexaString,
  CommandResultFactory,
  CommandResultStatus,
} from "@ledgerhq/device-management-kit";

import { type ProvideContactInput } from "@api/model/ProvideContact";
import { ProvideContactCommand } from "@internal/app-binder/command/ProvideContactCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { ContactsCommandError } from "@internal/app-binder/model/contactsErrors";

import {
  buildProvideContactPayload,
  sendProvideContactPayload,
} from "./provideContact";

const IDENTIFIER = new Uint8Array(20).fill(0x11);
const GROUP_HANDLE = new Uint8Array(64).fill(0x22);
const HMAC_PROOF = new Uint8Array(32).fill(0x33);
const HMAC_REST = new Uint8Array(32).fill(0x44);

const INPUT: ProvideContactInput = {
  contactName: "Alice",
  scope: "Ethereum",
  identifier: IDENTIFIER,
  groupHandle: GROUP_HANDLE,
  hmacProof: HMAC_PROOF,
  hmacRest: HMAC_REST,
  blockchainFamily: "ethereum",
  chainId: 1n,
};

// Tags >= 0x80 use the DER long form (0x81 then the tag), hence the "81" prefix
// on CONTACT_NAME (0xf0), SCOPE (0xf1), ACCOUNT_IDENTIFIER (0xf2),
// GROUP_HANDLE (0xf6) and HMAC_REST (0xf7).
const STRUCT_TYPE_TLV = "010133";
const STRUCT_VERSION_TLV = "020101";
const CONTACT_NAME_TLV = "81f005" + "416c696365"; // "Alice"
const SCOPE_TLV = "81f108" + "457468657265756d"; // "Ethereum"
const IDENTIFIER_TLV = "81f214" + "11".repeat(20);
const GROUP_HANDLE_TLV = "81f640" + "22".repeat(64);
const CHAIN_ID_TLV = "230101";
const FAMILY_TLV = "510101";
const HMAC_PROOF_TLV = "2920" + "33".repeat(32);
const HMAC_REST_TLV = "81f720" + "44".repeat(32);

describe("buildProvideContactPayload", () => {
  it("encodes every tag in the order the spec lists", () => {
    const payload = buildProvideContactPayload(INPUT);

    expect(bufferToHexaString(payload, false)).toBe(
      STRUCT_TYPE_TLV +
        STRUCT_VERSION_TLV +
        CONTACT_NAME_TLV +
        SCOPE_TLV +
        IDENTIFIER_TLV +
        GROUP_HANDLE_TLV +
        CHAIN_ID_TLV +
        FAMILY_TLV +
        HMAC_PROOF_TLV +
        HMAC_REST_TLV,
    );
  });

  it("fits an Ethereum contact in a single 255-byte chunk", () => {
    expect(buildProvideContactPayload(INPUT).length).toBeLessThanOrEqual(253);
  });

  it("omits CHAIN_ID for a family that does not carry one", () => {
    const payload = buildProvideContactPayload({
      ...INPUT,
      blockchainFamily: "bitcoin",
      chainId: undefined,
    });

    expect(bufferToHexaString(payload, false)).toContain(
      GROUP_HANDLE_TLV + "510100",
    );
  });

  it("encodes a multi-byte chain id big-endian with no leading zeroes", () => {
    const payload = buildProvideContactPayload({ ...INPUT, chainId: 8453n });

    expect(bufferToHexaString(payload, false)).toContain("2302" + "2105");
  });

  it("accepts the family name case-insensitively", () => {
    expect(
      buildProvideContactPayload({ ...INPUT, blockchainFamily: "Ethereum" }),
    ).toStrictEqual(buildProvideContactPayload(INPUT));
  });

  it("throws on an unknown blockchain family", () => {
    expect(() =>
      buildProvideContactPayload({ ...INPUT, blockchainFamily: "dogecoin" }),
    ).toThrow("Unsupported blockchain family: dogecoin");
  });
});

describe("sendProvideContactPayload", () => {
  it("sends one chunk under P2=0x00, prefixed with the 2-byte BE total length", async () => {
    const api = makeDeviceActionInternalApiMock();
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
    const payload = buildProvideContactPayload(INPUT);

    const result = await sendProvideContactPayload(api, { payload });

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    const command = api.sendCommand.mock.calls[0]![0] as ProvideContactCommand;
    expect(command).toBeInstanceOf(ProvideContactCommand);
    expect(command.args.p2).toBe(0x00);
    expect(command.args.data.slice(0, 2)).toStrictEqual(
      Uint8Array.from([(payload.length >> 8) & 0xff, payload.length & 0xff]),
    );
    expect(command.args.data.slice(2)).toStrictEqual(payload);
    expect(result.status).toBe(CommandResultStatus.Success);
  });

  it("propagates a device rejection instead of throwing", async () => {
    const api = makeDeviceActionInternalApiMock();
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({
        error: new ContactsCommandError({
          errorCode: "6982",
          message: "wrong seed",
        }),
      }),
    );

    const result = await sendProvideContactPayload(api, {
      payload: buildProvideContactPayload(INPUT),
    });

    expect(result.status).toBe(CommandResultStatus.Error);
  });
});

import {
  buildProvideContactPayload,
  resolveContactsVersionRequirements,
  TRON_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import {
  EMPTY_TRON_ADDRESS_BOOK,
  type TronAddressBook,
} from "@api/model/TronAddressBook";
import { encodeTronAddress } from "@internal/shared/utils/tronBase58Check";

import {
  buildExternalContactPayload,
  type BuildExternalContactPayloadArgs,
} from "./buildExternalContactPayload";

const RECIPIENT = new Uint8Array(21).fill(0x11);
const OTHER_ADDRESS = new Uint8Array(21).fill(0x22);
const GROUP_HANDLE = new Uint8Array(64).fill(0xaa);
const HMAC_PROOF = new Uint8Array(32).fill(0xbb);
const HMAC_REST = new Uint8Array(32).fill(0xcc);

const addressBook: TronAddressBook = {
  contactGroups: [
    {
      contactName: "Alice",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF,
      externalAddresses: [
        {
          scope: "Tron",
          address: encodeTronAddress(OTHER_ADDRESS),
          hmacRest: new Uint8Array(32).fill(0xdd),
        },
        {
          scope: "Tron",
          address: encodeTronAddress(RECIPIENT),
          hmacRest: HMAC_REST,
        },
      ],
    },
  ],
  ledgerAccounts: [],
};

const minContactsAppVersion = (() => {
  const requirement = resolveContactsVersionRequirements(DeviceModelId.FLEX);
  if (!requirement.supported) throw new Error("Flex must be supported");
  const version = requirement.minAppVersion[TRON_APP_NAME];
  if (version === undefined) throw new Error("Tron min version required");
  return version;
})();

function deviceState(
  appVersion = minContactsAppVersion,
  deviceModelId = DeviceModelId.FLEX,
): DeviceSessionState {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: "Tron", version: appVersion },
    deviceModelId,
    isSecureConnectionAllowed: false,
  };
}

function appConfig(version = minContactsAppVersion): AppConfiguration {
  return {
    version,
    versionN: 800,
    allowData: true,
    allowContract: true,
    truncateAddress: false,
    signByHash: false,
  };
}

function args(
  overrides: Partial<BuildExternalContactPayloadArgs> = {},
): BuildExternalContactPayloadArgs {
  return {
    addressBook,
    recipient: RECIPIENT,
    deviceState: deviceState(),
    appConfig: appConfig(),
    ...overrides,
  };
}

describe("buildExternalContactPayload", () => {
  it("encodes the matching address and its group proofs", () => {
    expect(buildExternalContactPayload(args())).toStrictEqual(
      buildProvideContactPayload({
        contactName: "Alice",
        scope: "Tron",
        identifier: RECIPIENT,
        groupHandle: GROUP_HANDLE,
        hmacProof: HMAC_PROOF,
        hmacRest: HMAC_REST,
        blockchainFamily: "tron",
      }),
    );
  });

  it("returns undefined when no address matches", () => {
    expect(
      buildExternalContactPayload({
        ...args(),
        recipient: new Uint8Array(21).fill(0x99),
      }),
    ).toBeUndefined();
  });

  it("returns undefined for an empty address book", () => {
    expect(
      buildExternalContactPayload(
        args({ addressBook: EMPTY_TRON_ADDRESS_BOOK }),
      ),
    ).toBeUndefined();
  });

  it("ignores a malformed address and continues matching", () => {
    const malformedFirst: TronAddressBook = {
      ...addressBook,
      contactGroups: [
        {
          ...addressBook.contactGroups[0]!,
          externalAddresses: [
            {
              scope: "Tron",
              address: "invalid",
              hmacRest: HMAC_REST,
            },
            ...addressBook.contactGroups[0]!.externalAddresses,
          ],
        },
      ],
    };

    expect(
      buildExternalContactPayload(args({ addressBook: malformedFirst })),
    ).toBeDefined();
  });

  it("returns undefined when the app is too old", () => {
    expect(
      buildExternalContactPayload(args({ deviceState: deviceState("0.7.9") })),
    ).toBeUndefined();
  });

  it("encodes the contact on a prerelease of the minimum app version", () => {
    expect(
      buildExternalContactPayload(
        args({ deviceState: deviceState(`${minContactsAppVersion}-dev2`) }),
      ),
    ).toBeDefined();
  });

  it("returns undefined on an unsupported device model", () => {
    expect(
      buildExternalContactPayload(
        args({ deviceState: deviceState("0.8.0", DeviceModelId.NANO_S) }),
      ),
    ).toBeUndefined();
  });
});

import { type TransactionSubset } from "@ledgerhq/context-module";
import {
  buildProvideContactPayload,
  ETHEREUM_APP_NAME,
  resolveContactsVersionRequirements,
} from "@ledgerhq/device-contacts-kit";
import {
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import {
  type EvmAddressBook,
  type EvmExternalAddress,
} from "@api/model/EvmAddressBook";

import {
  buildExternalContactPayload,
  type BuildExternalContactPayloadArgs,
} from "./buildExternalContactPayload";

const ALICE_MAINNET = "0x1111111111111111111111111111111111111111" as const;
const ALICE_BASE = "0x2222222222222222222222222222222222222222" as const;
const UNKNOWN = "0x9999999999999999999999999999999999999999";

const GROUP_HANDLE = new Uint8Array(64).fill(0xaa);
const HMAC_PROOF = new Uint8Array(32).fill(0xbb);
const HMAC_REST_MAINNET = new Uint8Array(32).fill(0xcc);
const HMAC_REST_BASE = new Uint8Array(32).fill(0xdd);

const mainnetAddress: EvmExternalAddress = {
  scope: "Ethereum",
  address: ALICE_MAINNET,
  chainId: 1n,
  hmacRest: HMAC_REST_MAINNET,
};

const baseAddress: EvmExternalAddress = {
  scope: "Base",
  address: ALICE_BASE,
  chainId: 8453n,
  hmacRest: HMAC_REST_BASE,
};

const addressBook: EvmAddressBook = {
  contactGroups: [
    {
      contactName: "Alice",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF,
      externalAddresses: [mainnetAddress, baseAddress],
    },
  ],
  ledgerAccounts: [],
};

const emptyBook: EvmAddressBook = { contactGroups: [], ledgerAccounts: [] };

const minContactsAppVersion = (() => {
  const requirement = resolveContactsVersionRequirements(DeviceModelId.FLEX);
  if (!requirement.supported) throw new Error("Flex must be supported");
  const version = requirement.minAppVersion[ETHEREUM_APP_NAME];
  if (version === undefined) throw new Error("Ethereum min version required");
  return version;
})();

function subset(overrides: Partial<TransactionSubset> = {}): TransactionSubset {
  return {
    chainId: 1,
    data: "0x",
    selector: "0x",
    to: ALICE_MAINNET,
    ...overrides,
  };
}

// No `firmwareVersion`: the session refresher drops it once an app is open, so
// this is the shape a real signing flow sees.
function deviceState({
  appName = "Ethereum",
  appVersion = minContactsAppVersion,
  deviceModelId = DeviceModelId.FLEX,
}: {
  appName?: string;
  appVersion?: string;
  deviceModelId?: DeviceModelId;
} = {}): DeviceSessionState {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: appName, version: appVersion },
    deviceModelId,
    isSecureConnectionAllowed: false,
  };
}

function appConfig(version = minContactsAppVersion): GetConfigCommandResponse {
  return {
    blindSigningEnabled: false,
    web3ChecksEnabled: false,
    web3ChecksOptIn: false,
    version,
  };
}

function args(
  overrides: Partial<BuildExternalContactPayloadArgs> = {},
): BuildExternalContactPayloadArgs {
  return {
    addressBook,
    subset: subset(),
    deviceState: deviceState(),
    appConfig: appConfig(),
    ...overrides,
  };
}

describe("buildExternalContactPayload", () => {
  describe("matching", () => {
    it("encodes the contact when recipient and chain both match", () => {
      const payload = buildExternalContactPayload(args());

      expect(payload).toStrictEqual(
        buildProvideContactPayload({
          contactName: "Alice",
          scope: "Ethereum",
          identifier: new Uint8Array(20).fill(0x11),
          groupHandle: GROUP_HANDLE,
          hmacProof: HMAC_PROOF,
          hmacRest: HMAC_REST_MAINNET,
          blockchainFamily: "ethereum",
          chainId: 1n,
        }),
      );
    });

    it("pairs the matched address with the proofs of its own group", () => {
      const twoGroups: EvmAddressBook = {
        contactGroups: [
          {
            contactName: "Bob",
            groupHandle: new Uint8Array(64).fill(0x01),
            hmacProof: new Uint8Array(32).fill(0x02),
            externalAddresses: [],
          },
          ...addressBook.contactGroups,
        ],
        ledgerAccounts: [],
      };

      expect(
        buildExternalContactPayload(args({ addressBook: twoGroups })),
      ).toStrictEqual(buildExternalContactPayload(args()));
    });

    it("selects the address registered for the transaction's chain", () => {
      const payload = buildExternalContactPayload(
        args({ subset: subset({ to: ALICE_BASE, chainId: 8453 }) }),
      );

      expect(payload).toStrictEqual(
        buildProvideContactPayload({
          contactName: "Alice",
          scope: "Base",
          identifier: new Uint8Array(20).fill(0x22),
          groupHandle: GROUP_HANDLE,
          hmacProof: HMAC_PROOF,
          hmacRest: HMAC_REST_BASE,
          blockchainFamily: "ethereum",
          chainId: 8453n,
        }),
      );
    });

    it("does not match a known address on a chain it is not registered for", () => {
      expect(
        buildExternalContactPayload(
          args({ subset: subset({ chainId: 8453 }) }),
        ),
      ).toBeUndefined();
    });

    it("does not match an address absent from the book", () => {
      expect(
        buildExternalContactPayload(args({ subset: subset({ to: UNKNOWN }) })),
      ).toBeUndefined();
    });

    it("matches regardless of recipient checksum casing", () => {
      const checksummed = subset({ to: ALICE_MAINNET.toUpperCase() });

      expect(
        buildExternalContactPayload(args({ subset: checksummed })),
      ).toStrictEqual(buildExternalContactPayload(args()));
    });

    it("returns undefined for a transaction with no recipient", () => {
      expect(
        buildExternalContactPayload(
          args({ subset: subset({ to: undefined }) }),
        ),
      ).toBeUndefined();
    });

    it("returns undefined for an empty address book", () => {
      expect(
        buildExternalContactPayload(args({ addressBook: emptyBook })),
      ).toBeUndefined();
    });
  });

  describe("device support", () => {
    it("returns undefined when the app is too old for Contacts", () => {
      expect(
        buildExternalContactPayload(
          args({ deviceState: deviceState({ appVersion: "1.14.0" }) }),
        ),
      ).toBeUndefined();
    });

    // The version compared is the one on `currentApp`, not `appConfig`:
    // EthereumApplicationResolver only falls back to the config version for a
    // clone. Setting it here would leave the prerelease string uncompared.
    it("encodes the contact on a prerelease build of the minimum app version", () => {
      expect(
        buildExternalContactPayload(
          args({
            deviceState: deviceState({
              appVersion: `${minContactsAppVersion}-rc2`,
            }),
          }),
        ),
      ).toBeDefined();
    });

    it("returns undefined on a device model without Contacts support", () => {
      expect(
        buildExternalContactPayload(
          args({
            deviceState: deviceState({ deviceModelId: DeviceModelId.NANO_S }),
          }),
        ),
      ).toBeUndefined();
    });

    it("encodes the contact inside a clone of the Ethereum app", () => {
      // A clone reports its own name and its own version. The Ethereum minimum
      // is the one that applies, measured against the version the app config
      // reports — the clone's `currentApp.version` says nothing about it.
      const payload = buildExternalContactPayload(
        args({
          deviceState: deviceState({ appName: "Polygon", appVersion: "1.0.0" }),
          appConfig: appConfig(minContactsAppVersion),
        }),
      );

      expect(payload).toBeDefined();
    });

    it("returns undefined in a clone whose underlying app is too old", () => {
      expect(
        buildExternalContactPayload(
          args({
            deviceState: deviceState({
              appName: "Polygon",
              appVersion: "999.0.0",
            }),
            appConfig: appConfig("1.14.0"),
          }),
        ),
      ).toBeUndefined();
    });

    it("encodes the contact even though the session state carries no OS version", () => {
      // Regression guard: gating on `firmwareVersion` here rejected every
      // device, because the refresher drops it on the transition out of
      // Connected and GET OS VERSION is a dashboard-only command.
      const state = deviceState();

      expect(state).not.toHaveProperty("firmwareVersion");
      expect(
        buildExternalContactPayload(args({ deviceState: state })),
      ).toBeDefined();
    });
  });
});

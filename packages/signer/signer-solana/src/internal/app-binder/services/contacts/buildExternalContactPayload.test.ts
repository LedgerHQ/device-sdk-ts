import * as contactsKit from "@ledgerhq/device-contacts-kit";
import {
  buildProvideContactPayload,
  SOLANA_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { Keypair, PublicKey } from "@solana/web3.js";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";
import {
  EMPTY_SOLANA_ADDRESS_BOOK,
  type SolanaAddressBook,
} from "@api/model/SolanaAddressBook";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@internal/app-binder/services/utils/splToken";

import {
  buildExternalContactPayload,
  type BuildExternalContactPayloadArgs,
} from "./buildExternalContactPayload";
import { type TransferRecipient } from "./extractTransferRecipient";

vi.mock("@ledgerhq/device-contacts-kit", async (importOriginal) => {
  const actual = await importOriginal<typeof contactsKit>();
  return {
    ...actual,
    resolveContactsVersionRequirements: vi.fn(
      actual.resolveContactsVersionRequirements,
    ),
  };
});

// The app runs at the contacts minimum, so only the condition under test can
// keep the contact out.
const CONTACTS_APP_VERSION = (() => {
  const requirement = contactsKit.resolveContactsVersionRequirements(
    DeviceModelId.FLEX,
  );
  const version = requirement.supported
    ? requirement.minAppVersion[SOLANA_APP_NAME]
    : undefined;
  if (version === undefined) throw new Error("Flex must support Solana");
  return version;
})();

const alice = Keypair.generate().publicKey;
const other = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const GROUP_HANDLE = new Uint8Array(64).fill(0xaa);
const HMAC_PROOF = new Uint8Array(32).fill(0xbb);
const HMAC_REST = new Uint8Array(32).fill(0xcc);

const addressBook: SolanaAddressBook = {
  contactGroups: [
    {
      contactName: "Alice",
      groupHandle: GROUP_HANDLE,
      hmacProof: HMAC_PROOF,
      externalAddresses: [
        {
          scope: "Solana",
          address: "not-base58-0OIl",
          hmacRest: new Uint8Array(32).fill(0xd0),
        },
        {
          scope: "Solana",
          address: other.toBase58(),
          hmacRest: new Uint8Array(32).fill(0xdd),
        },
        {
          scope: "Solana",
          address: alice.toBase58(),
          hmacRest: HMAC_REST,
        },
      ],
    },
  ],
  ledgerAccounts: [],
};

const expectedAlicePayload = buildProvideContactPayload({
  contactName: "Alice",
  scope: "Solana",
  identifier: alice.toBytes(),
  groupHandle: GROUP_HANDLE,
  hmacProof: HMAC_PROOF,
  hmacRest: HMAC_REST,
  blockchainFamily: "solana",
});

function deviceState({
  appName = SOLANA_APP_NAME,
  deviceModelId = DeviceModelId.FLEX,
}: {
  appName?: string;
  deviceModelId?: DeviceModelId;
} = {}): DeviceSessionState {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: appName, version: CONTACTS_APP_VERSION },
    deviceModelId,
    isSecureConnectionAllowed: false,
  };
}

const appConfig: AppConfiguration = {
  blindSigningEnabled: false,
  pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
  version: CONTACTS_APP_VERSION,
};

function native(address: PublicKey): TransferRecipient {
  return { kind: "native", address };
}

function tokenTo(
  wallet: PublicKey,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): TransferRecipient {
  return {
    kind: "token",
    tokenAccount: getAssociatedTokenAddressSync(
      mint,
      wallet,
      true,
      tokenProgram,
    ),
    mint,
    tokenProgram,
  };
}

function args(
  overrides: Partial<BuildExternalContactPayloadArgs> = {},
): BuildExternalContactPayloadArgs {
  return {
    addressBook,
    recipient: native(alice),
    deviceState: deviceState(),
    appConfig,
    ...overrides,
  };
}

describe("buildExternalContactPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("matching", () => {
    it("encodes the contact whose wallet receives a native transfer", () => {
      expect(buildExternalContactPayload(args())).toEqual(expectedAlicePayload);
    });

    it("encodes the wallet, not the token account, for a token transfer", () => {
      expect(
        buildExternalContactPayload(args({ recipient: tokenTo(alice) })),
      ).toEqual(expectedAlicePayload);
    });

    it("matches a Token-2022 associated token account", () => {
      expect(
        buildExternalContactPayload(
          args({ recipient: tokenTo(alice, TOKEN_2022_PROGRAM_ID) }),
        ),
      ).toEqual(expectedAlicePayload);
    });

    it("does not match a token account that is not the wallet's associated one", () => {
      expect(
        buildExternalContactPayload(
          args({
            recipient: {
              kind: "token",
              tokenAccount: Keypair.generate().publicKey,
              mint,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
          }),
        ),
      ).toBeUndefined();
    });

    it("returns undefined when no contact receives the transfer", () => {
      expect(
        buildExternalContactPayload(
          args({ recipient: native(Keypair.generate().publicKey) }),
        ),
      ).toBeUndefined();
    });

    it("returns undefined for an empty address book", () => {
      expect(
        buildExternalContactPayload(
          args({ addressBook: EMPTY_SOLANA_ADDRESS_BOOK }),
        ),
      ).toBeUndefined();
    });

    it("skips an address that does not decode to 32 bytes", () => {
      const shortKey: SolanaAddressBook = {
        contactGroups: [
          {
            ...addressBook.contactGroups[0]!,
            // Decodes to a single zero byte, which `new PublicKey` would
            // otherwise pad into the all-zero key.
            externalAddresses: [
              { scope: "Solana", address: "1", hmacRest: HMAC_REST },
            ],
          },
        ],
        ledgerAccounts: [],
      };

      expect(
        buildExternalContactPayload(
          args({
            addressBook: shortKey,
            recipient: native(new PublicKey(new Uint8Array(32))),
          }),
        ),
      ).toBeUndefined();
    });
  });

  describe("app support", () => {
    it("returns undefined on a model without contacts", () => {
      expect(
        buildExternalContactPayload(
          args({
            deviceState: deviceState({ deviceModelId: DeviceModelId.NANO_S }),
          }),
        ),
      ).toBeUndefined();
    });

    it("returns undefined when the app is older than the contacts minimum", () => {
      vi.mocked(
        contactsKit.resolveContactsVersionRequirements,
      ).mockReturnValueOnce({
        supported: true,
        minOsVersion: "1.0.0",
        minAppVersion: { [SOLANA_APP_NAME]: "99.0.0" },
      });

      expect(buildExternalContactPayload(args())).toBeUndefined();
    });

    it("returns undefined when the model declares no Solana minimum", () => {
      vi.mocked(
        contactsKit.resolveContactsVersionRequirements,
      ).mockReturnValueOnce({
        supported: true,
        minOsVersion: "1.0.0",
        minAppVersion: {},
      });

      expect(buildExternalContactPayload(args())).toBeUndefined();
    });

    it("returns undefined while Exchange orchestrates the signature", () => {
      expect(
        buildExternalContactPayload(
          args({ deviceState: deviceState({ appName: "Exchange" }) }),
        ),
      ).toBeUndefined();
    });
  });
});

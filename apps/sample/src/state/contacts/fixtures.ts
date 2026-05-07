import {
  emptyWallet,
  ResponseType,
  type Wallet,
} from "@ledgerhq/device-management-kit";

/**
 * Bundled snapshot wallets for the Contacts page "Load fixture"
 * dropdown. Hex values are illustrative — they don't pass device-side
 * HMAC verification. The fixtures exist to populate UI pickers during
 * M1 (no-device) and to scaffold UI development before M2 lands the
 * Register-external-address device path.
 *
 * When real fixtures are needed for byte-level parity testing, those
 * live in `~/dev/ledger-contacts-playground/docs/fixtures/apdu-traces.json`
 * and are consumed by vitest in the DMK packages, not here.
 */

const ONE_CONTACT_ONE_ENTRY: Wallet = {
  schemaVersion: 1,
  contacts: {
    Alice: {
      name: "Alice",
      groupHandleHex: "00".repeat(64),
      hmacNameHex: "11".repeat(32),
      entries: [
        {
          network: "ethereum",
          chainId: 1,
          addressHex: "00000000000000000000000000000000000000de",
          scope: "Eth main",
          derivationPath: "m/44'/60'/0'/0/0",
          hmacRestHex: "22".repeat(32),
          lastResponseType: ResponseType.RegisterIdentity,
        },
      ],
    },
  },
  accounts: {},
};

const THREE_EXTERNALS_TWO_ACCOUNTS: Wallet = {
  schemaVersion: 1,
  contacts: {
    Alice: {
      name: "Alice",
      groupHandleHex: "00".repeat(64),
      hmacNameHex: "11".repeat(32),
      entries: [
        {
          network: "ethereum",
          chainId: 1,
          addressHex: "00000000000000000000000000000000000000de",
          scope: "Eth main",
          derivationPath: "m/44'/60'/0'/0/0",
          hmacRestHex: "22".repeat(32),
          lastResponseType: ResponseType.RegisterIdentity,
        },
        {
          network: "polygon",
          chainId: 137,
          addressHex: "11111111111111111111111111111111111111be",
          scope: "Polygon hot",
          derivationPath: "m/44'/60'/0'/0/0",
          hmacRestHex: "33".repeat(32),
          lastResponseType: ResponseType.RegisterIdentity,
        },
      ],
    },
    Bob: {
      name: "Bob",
      groupHandleHex: "44".repeat(64),
      hmacNameHex: "55".repeat(32),
      entries: [
        {
          network: "arbitrum",
          chainId: 42161,
          addressHex: "22222222222222222222222222222222222222ca",
          scope: "ARB cold",
          derivationPath: "m/44'/60'/1'/0/0",
          hmacRestHex: "66".repeat(32),
          lastResponseType: ResponseType.RegisterIdentity,
        },
      ],
    },
  },
  accounts: {
    Vault: {
      name: "Vault",
      derivationPath: "m/44'/60'/0'/0/0",
      chainId: 1,
      hmacProofHex: "77".repeat(32),
      addressHex: "33333333333333333333333333333333333333aa",
      lastResponseType: ResponseType.RegisterLedgerAccount,
    },
    Spending: {
      name: "Spending",
      derivationPath: "m/44'/60'/2'/0/0",
      chainId: 1,
      hmacProofHex: "88".repeat(32),
      addressHex: "44444444444444444444444444444444444444bb",
      lastResponseType: ResponseType.RegisterLedgerAccount,
    },
  },
};

export const FIXTURES: { id: string; label: string; wallet: Wallet }[] = [
  { id: "empty", label: "Empty wallet", wallet: emptyWallet() },
  {
    id: "one-contact-one-entry",
    label: "1 contact / 1 entry",
    wallet: ONE_CONTACT_ONE_ENTRY,
  },
  {
    id: "three-externals-two-accounts",
    label: "3 externals / 2 accounts",
    wallet: THREE_EXTERNALS_TWO_ACCOUNTS,
  },
];

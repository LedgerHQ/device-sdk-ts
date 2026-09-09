import {
  type Scenario,
  type ScenarioDevice,
} from "@root/src/domain/models/Scenario";

const TOUCHSCREEN: readonly ScenarioDevice[] = ["stax", "flex"];
const ALL_DEVICES: readonly ScenarioDevice[] = ["stax", "nanox", "flex"];
const NANO_AND_STAX: readonly ScenarioDevice[] = ["stax", "nanox"];

/** Dapps whose calldata fixtures are exercised. */
const ERC7730_CALLDATA_DAPPS = [
  "1inch",
  "aave",
  "ethena",
  "lido",
  "lombard",
  "poap",
  "swissborg",
  "tether",
  "uniswap",
  "velora",
  "yieldxyz",
] as const;

/** Dapps whose typed-data fixtures are exercised. */
const ERC7730_TYPED_DATA_DAPPS = [
  "1inch",
  "degate",
  "ledgerquest",
  "lens",
  "lombard",
  "opensea",
  "permit",
  "smartcredit",
  "tally",
  "uniswap",
  "velora",
] as const;

/**
 * Gating fixtures, which assert the device falls back to its gating screen for
 * an unauthenticated caller. Blind signing is accepted because a gated
 * transaction has no descriptor to clear-sign from.
 */
const GATING_FIXTURES = [
  ["1inch-swap-eth-usdt", "signTransaction", "raw-1inch-swap-eth-usdt"],
  ["aave-supply-eth", "signTransaction", "raw-aave-supply-eth"],
  ["every-10-tx", "signTransaction", "raw-gating-every-10-tx"],
  ["multisig", "signTransaction", "raw-multisig"],
  ["1inch-arb-swap", "signTypedData", "typed-data-1inch-arb-swap"],
  [
    "1inch-limit-usdt-eth",
    "signTypedData",
    "typed-data-1inch-limit-order-usdt-eth",
  ],
  [
    "1inch-limit-weth-usdc",
    "signTypedData",
    "typed-data-1inch-limit-order-weth-usdc",
  ],
  ["arb-permit", "signTypedData", "typed-data-arb-permit"],
] as const;

const SOLANA_FIXTURES = [
  ["system-transfers", "system-transfers"],
  ["spl-legacy", "spl-legacy"],
  ["spl-token2022", "spl-token2022"],
  ["stake", "stake"],
] as const;

const SOLANA_PROGRAMS = ["system", "stake", "spl-token", "token-2022"] as const;

/**
 * Every scenario the tester knows how to run.
 *
 * Paths follow the fixture layout rather than being discovered, so a missing
 * file surfaces as a clear error naming the scenario instead of silently
 * shrinking a run.
 */
export const SCENARIO_CATALOG: readonly Scenario[] = [
  // --- Ethereum core fixtures -------------------------------------------
  {
    name: "core:complete",
    group: "core",
    devices: NANO_AND_STAX,
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/core/raw-complete.json",
  },
  {
    name: "core:multisig",
    group: "core",
    devices: NANO_AND_STAX,
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/core/raw-multisig.json",
  },
  {
    name: "core:erc20",
    group: "core",
    devices: NANO_AND_STAX,
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/core/raw-erc20.json",
  },
  {
    name: "core:typed-data-multisig",
    group: "core",
    devices: NANO_AND_STAX,
    coinApp: "Ethereum",
    action: "signTypedData",
    fixture: "./ressources/core/typed-data-multisig.json",
  },

  // --- Contacts, which need the pre-release firmware pair ----------------
  {
    name: "contacts:register",
    group: "contacts",
    devices: ["flex"],
    coinApp: "Ethereum",
    action: "registerContact",
    fixture: "./ressources/contacts/contacts.json",
  },
  {
    name: "contacts:sign",
    group: "contacts",
    devices: ["flex"],
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/contacts/sign-with-contact.json",
    options: { addressBook: "./ressources/contacts/address-book.json" },
  },
  {
    name: "contacts:sign-rejected",
    group: "contacts",
    devices: ["flex"],
    coinApp: "Ethereum",
    action: "signTransaction",
    fixture: "./ressources/contacts/sign-rejected-contact.json",
    options: {
      addressBook: "./ressources/contacts/address-book-rejected.json",
    },
  },

  // --- Gating -----------------------------------------------------------
  ...GATING_FIXTURES.map(([name, action, file]) => ({
    name: `gating:${name}`,
    group: "gating",
    devices: TOUCHSCREEN,
    coinApp: "Ethereum" as const,
    action,
    fixture: `./ressources/gating/${file}.json`,
    options: { blindSigningEnabled: true, skipOriginToken: true },
  })),

  // --- ERC7730 descriptors, per dapp ------------------------------------
  ...ERC7730_CALLDATA_DAPPS.map((dapp) => ({
    name: `erc7730:${dapp}`,
    group: "erc7730",
    devices: ALL_DEVICES,
    coinApp: "Ethereum" as const,
    action: "signTransaction" as const,
    fixture: `./ressources/erc7730/${dapp}/raw-${dapp}.json`,
  })),
  ...ERC7730_TYPED_DATA_DAPPS.map((dapp) => ({
    name: `erc7730-typed-data:${dapp}`,
    group: "erc7730-typed-data",
    devices: ALL_DEVICES,
    coinApp: "Ethereum" as const,
    action: "signTypedData" as const,
    fixture: `./ressources/erc7730/${dapp}/typed-data-${dapp}.json`,
  })),

  // --- Solana -----------------------------------------------------------
  ...SOLANA_FIXTURES.map(([name, file]) => ({
    name: `solana:${name}`,
    group: "solana",
    devices: ALL_DEVICES,
    coinApp: "Solana" as const,
    action: "signTransaction" as const,
    fixture: `./ressources/solana/${file}.json`,
  })),
  ...SOLANA_PROGRAMS.map((program) => ({
    name: `solana-programs:${program}`,
    group: "solana-programs",
    devices: ALL_DEVICES,
    coinApp: "Solana" as const,
    action: "solanaProgram" as const,
    program,
    options: { useRpc: true, distill: true },
  })),
];

/** Every group name in the catalog, in catalog order. */
export const scenarioGroups = (
  catalog: readonly Scenario[] = SCENARIO_CATALOG,
): readonly string[] => [...new Set(catalog.map((s) => s.group))];

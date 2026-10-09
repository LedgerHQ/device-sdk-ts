import { buildProvideContactPayload } from "@ledgerhq/device-contacts-kit";
import { Keypair, PublicKey } from "@solana/web3.js";

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
    ...overrides,
  };
}

describe("buildExternalContactPayload", () => {
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
});

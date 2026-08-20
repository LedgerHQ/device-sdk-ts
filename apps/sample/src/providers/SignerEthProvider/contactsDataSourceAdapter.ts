import {
  type ContactDecoration,
  type ContactLedgerAccountDecoration,
  type ContactsDataSource,
  type ContactsLookupKey,
} from "@ledgerhq/context-module";
import { type Wallet } from "@ledgerhq/device-management-kit";

/**
 * Bridges the sample-app Redux wallet store to the SDK's
 * `ContactsDataSource` port. Closed-over getters (rather than a
 * captured snapshot) so each lookup sees the freshest wallet state and
 * the QA "disable auto-decoration" toggle.
 *
 * Wire-format alignment: DMK core stores `addressHex` as 40 lowercase
 * hex chars WITHOUT the `0x` prefix; the SDK passes lookup keys that
 * usually arrive WITH the prefix (they come from a parsed
 * `TransactionSubset`). The adapter normalises both sides before
 * comparing.
 */
type Args = {
  getWallet: () => Wallet;
  getAutoDecorationDisabled: () => boolean;
};

const normaliseAddress = (raw: string): string =>
  raw.toLowerCase().replace(/^0x/, "");

const matches = (
  candidateAddressHex: string | undefined,
  candidateChainId: number,
  key: ContactsLookupKey,
): boolean =>
  candidateAddressHex !== undefined &&
  candidateChainId === key.chainId &&
  normaliseAddress(candidateAddressHex) === normaliseAddress(key.address);

export const makeContactsDataSourceAdapter = ({
  getWallet,
  getAutoDecorationDisabled,
}: Args): ContactsDataSource => ({
  async lookupFrom(
    key: ContactsLookupKey,
  ): Promise<ContactLedgerAccountDecoration | null> {
    if (getAutoDecorationDisabled()) return null;

    const wallet = getWallet();
    for (const account of Object.values(wallet.accounts)) {
      if (matches(account.addressHex, account.chainId, key)) {
        return {
          accountName: account.name,
          hmacProofHex: account.hmacProofHex,
          derivationPath: account.derivationPath,
          chainId: account.chainId,
        };
      }
    }
    return null;
  },

  async lookupTo(key: ContactsLookupKey): Promise<ContactDecoration | null> {
    if (getAutoDecorationDisabled()) return null;

    const wallet = getWallet();

    // Contacts win over self-Ledger-accounts when an external entry
    // happens to share an address: the user explicitly named that
    // recipient as a contact, so use the contact name on device.
    for (const contact of Object.values(wallet.contacts)) {
      for (const entry of contact.entries) {
        if (matches(entry.addressHex, entry.chainId, key)) {
          return {
            kind: "external",
            contactName: contact.name,
            scope: entry.scope,
            addressHex: entry.addressHex,
            groupHandleHex: contact.groupHandleHex,
            hmacNameHex: contact.hmacNameHex,
            hmacRestHex: entry.hmacRestHex,
            derivationPath: entry.derivationPath,
            chainId: entry.chainId,
          };
        }
      }
    }

    for (const account of Object.values(wallet.accounts)) {
      if (matches(account.addressHex, account.chainId, key)) {
        return {
          kind: "ledgerAccount",
          accountName: account.name,
          hmacProofHex: account.hmacProofHex,
          derivationPath: account.derivationPath,
          chainId: account.chainId,
        };
      }
    }

    return null;
  },
});

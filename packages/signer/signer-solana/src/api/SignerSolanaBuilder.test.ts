import { type ContextModule } from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import {
  EMPTY_SOLANA_ADDRESS_BOOK,
  type SolanaAddressBook,
} from "@api/model/SolanaAddressBook";
import { SignerSolanaBuilder } from "@api/SignerSolanaBuilder";
import { DefaultSignerSolana } from "@internal/DefaultSignerSolana";
import { externalTypes } from "@internal/externalTypes";

describe("SignerSolanaBuilder", () => {
  const dmk = {
    getLoggerFactory: vi.fn().mockReturnValue(vi.fn()),
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  it("should build a DefaultSignerSolana", () => {
    const signer = new SignerSolanaBuilder(defaultConstructorArgs).build();

    expect(signer).toBeInstanceOf(DefaultSignerSolana);
  });

  it("should build with a custom context module", () => {
    const contextModule = { getContexts: vi.fn() } as unknown as ContextModule;

    const signer = new SignerSolanaBuilder(defaultConstructorArgs)
      .withContextModule(contextModule)
      .build();

    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });

  it("should build with an empty address book by default", () => {
    const signer = new SignerSolanaBuilder(defaultConstructorArgs).build();

    expect(
      signer["_container"].get<SolanaAddressBook>(externalTypes.AddressBook),
    ).toBe(EMPTY_SOLANA_ADDRESS_BOOK);
  });

  it("should build with a custom address book", () => {
    const addressBook: SolanaAddressBook = {
      contactGroups: [
        {
          contactName: "Alice",
          groupHandle: Uint8Array.from([0x01, 0x02]),
          hmacProof: Uint8Array.from([0x03, 0x04]),
          externalAddresses: [
            {
              scope: "Solana",
              address: "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5",
              hmacRest: Uint8Array.from([0x05]),
            },
          ],
        },
      ],
      ledgerAccounts: [
        {
          accountName: "Main account",
          derivationPath: "44'/501'/0'/0'",
          hmacProof: Uint8Array.from([0x06]),
        },
      ],
    };

    const signer = new SignerSolanaBuilder(defaultConstructorArgs)
      .withAddressBook(addressBook)
      .build();

    expect(
      signer["_container"].get<SolanaAddressBook>(externalTypes.AddressBook),
    ).toBe(addressBook);
  });
});

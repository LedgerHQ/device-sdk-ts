import { type ContextModule } from "@ledgerhq/context-module";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { type EvmAddressBook } from "@api/model/EvmAddressBook";
import { SignerEthBuilder } from "@api/SignerEthBuilder";
import { DefaultSignerEth } from "@internal/DefaultSignerEth";
import { externalTypes } from "@internal/externalTypes";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("SignerEthBuilder", () => {
  const dmk: DeviceManagementKit = {
    getLoggerFactory: () => () => mockLogger,
  } as unknown as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "", originToken: "test" };

  test("should be an instance of SignerEth", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);

    // WHEN
    builder.build();

    // THEN
    expect(builder).toBeInstanceOf(SignerEthBuilder);
  });

  test("should instanciate with default context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);

    // WHEN
    const signer = builder.build();
    const contextModule = signer["_container"].get<ContextModule>(
      externalTypes.ContextModule,
    );

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(contextModule).toBeDefined();
  });

  test("should instanciate with custom context module", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);
    const contextModule = {} as ContextModule;

    // WHEN
    const signer = builder.withContextModule(contextModule).build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(
      signer["_container"].get<ContextModule>(externalTypes.ContextModule),
    ).toBe(contextModule);
  });

  test("should instanciate with an empty address book by default", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);

    // WHEN
    const signer = builder.build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(
      signer["_container"].get<EvmAddressBook>(externalTypes.AddressBook),
    ).toEqual({
      contactGroups: [],
      ledgerAccounts: [],
    });
  });

  test("should instanciate with a custom address book", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);
    const addressBook: EvmAddressBook = {
      contactGroups: [
        {
          contactName: "Alice",
          groupHandle: Uint8Array.from([0x01, 0x02]),
          hmacProof: Uint8Array.from([0x03, 0x04]),
          externalAddresses: [
            {
              scope: "ETH",
              address: "0x1111111111111111111111111111111111111111",
              chainId: 1n,
              hmacRest: Uint8Array.from([0x05]),
            },
          ],
        },
      ],
      ledgerAccounts: [
        {
          accountName: "Main account",
          derivationPath: "44'/60'/0'/0/0",
          chainId: 1n,
          hmacProof: Uint8Array.from([0x06]),
        },
      ],
    };

    // WHEN
    const signer = builder.withAddressBook(addressBook).build();

    // THEN
    expect(signer).toBeInstanceOf(DefaultSignerEth);
    expect(
      signer["_container"].get<EvmAddressBook>(externalTypes.AddressBook),
    ).toBe(addressBook);
  });

  test("should preserve a contact group holding several addresses across chains", () => {
    // GIVEN
    const builder = new SignerEthBuilder(defaultConstructorArgs);
    const addressBook: EvmAddressBook = {
      contactGroups: [
        {
          contactName: "Bob",
          groupHandle: Uint8Array.from([0x0a]),
          hmacProof: Uint8Array.from([0x0b]),
          externalAddresses: [
            {
              scope: "ETH",
              address: "0x2222222222222222222222222222222222222222",
              chainId: 1n,
              hmacRest: Uint8Array.from([0x0c]),
            },
            {
              scope: "POL",
              address: "0x2222222222222222222222222222222222222222",
              chainId: 137n,
              hmacRest: Uint8Array.from([0x0d]),
            },
          ],
        },
      ],
      ledgerAccounts: [],
    };

    // WHEN
    const signer = builder.withAddressBook(addressBook).build();
    const bound = signer["_container"].get<EvmAddressBook>(
      externalTypes.AddressBook,
    );

    // THEN
    expect(bound.contactGroups).toHaveLength(1);
    expect(bound.contactGroups[0]!.externalAddresses).toHaveLength(2);
    expect(
      bound.contactGroups[0]!.externalAddresses.map((a) => a.chainId),
    ).toEqual([1n, 137n]);
  });
});

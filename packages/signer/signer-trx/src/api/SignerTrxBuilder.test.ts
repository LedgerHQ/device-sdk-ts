import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { type TronAddressBook } from "@api/model/TronAddressBook";
import { SignerTrxBuilder } from "@api/SignerTrxBuilder";
import { APP_NAME, INS, LEDGER_CLA } from "@internal/app-binder/constants";
import { DefaultSignerTrx } from "@internal/DefaultSignerTrx";
import { externalTypes } from "@internal/externalTypes";

describe("SignerTrxBuilder", () => {
  const dmk = {} as DeviceManagementKit;
  const defaultConstructorArgs = { dmk, sessionId: "" };

  test("should be an instance of SignerTrxBuilder", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    expect(builder).toBeInstanceOf(SignerTrxBuilder);
  });

  test("should build a DefaultSignerTrx", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    const signer = builder.build();

    expect(signer).toBeInstanceOf(DefaultSignerTrx);
  });
  test("should build with an empty address book by default", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);

    const signer = builder.build();

    expect(
      signer["_container"].get<TronAddressBook>(externalTypes.AddressBook),
    ).toEqual({ contactGroups: [], ledgerAccounts: [] });
  });

  test("should build with a custom address book", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);
    const addressBook: TronAddressBook = {
      contactGroups: [
        {
          contactName: "Alice",
          groupHandle: Uint8Array.from([0x01, 0x02]),
          hmacProof: Uint8Array.from([0x03, 0x04]),
          externalAddresses: [
            {
              scope: "TRX",
              address: "TQ3zvJoxUCS3PtcAJ8f1FhezAxrEDbjyKh",
              hmacRest: Uint8Array.from([0x05]),
            },
          ],
        },
      ],
      ledgerAccounts: [
        {
          accountName: "Main account",
          derivationPath: "44'/195'/0'/0/0",
          hmacProof: Uint8Array.from([0x06]),
        },
      ],
    };

    const signer = builder.withAddressBook(addressBook).build();

    expect(signer).toBeInstanceOf(DefaultSignerTrx);
    expect(
      signer["_container"].get<TronAddressBook>(externalTypes.AddressBook),
    ).toBe(addressBook);
  });

  test("should preserve a contact group holding several addresses", () => {
    const builder = new SignerTrxBuilder(defaultConstructorArgs);
    const addressBook: TronAddressBook = {
      contactGroups: [
        {
          contactName: "Bob",
          groupHandle: Uint8Array.from([0x0a]),
          hmacProof: Uint8Array.from([0x0b]),
          externalAddresses: [
            {
              scope: "TRX",
              address: "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9",
              hmacRest: Uint8Array.from([0x0c]),
            },
            {
              scope: "USDT",
              address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
              hmacRest: Uint8Array.from([0x0d]),
            },
          ],
        },
      ],
      ledgerAccounts: [],
    };

    const signer = builder.withAddressBook(addressBook).build();
    const bound = signer["_container"].get<TronAddressBook>(
      externalTypes.AddressBook,
    );

    expect(bound.contactGroups).toHaveLength(1);
    expect(bound.contactGroups[0]!.externalAddresses).toHaveLength(2);
    expect(
      bound.contactGroups[0]!.externalAddresses.map((a) => a.scope),
    ).toEqual(["TRX", "USDT"]);
  });
});

describe("Tron APDU constants", () => {
  test("APP_NAME should be Tron", () => {
    expect(APP_NAME).toBe("Tron");
  });

  test("LEDGER_CLA should be 0xE0", () => {
    expect(LEDGER_CLA).toBe(0xe0);
  });

  test("INS values should match the Tron app protocol", () => {
    expect(INS.GET_ADDRESS).toBe(0x02);
    expect(INS.SIGN_TRANSACTION).toBe(0x04);
    expect(INS.GET_APP_CONFIGURATION).toBe(0x06);
    expect(INS.SIGN_PERSONAL_MESSAGE).toBe(0x08);
  });
});

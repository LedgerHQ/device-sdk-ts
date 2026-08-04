import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { ContactsManagerBuilder } from "@api/ContactsManagerBuilder";
import { DefaultContactsManager } from "@internal/DefaultContactsManager";

describe("ContactsManagerBuilder", () => {
  const dmk = {} as DeviceManagementKit;
  const defaultConstructorArgs = {
    dmk,
    sessionId: "session-id",
    appName: "Ethereum",
  };

  test("should be an instance of ContactsManagerBuilder", () => {
    const builder = new ContactsManagerBuilder(defaultConstructorArgs);

    expect(builder).toBeInstanceOf(ContactsManagerBuilder);
  });

  test("should build a DefaultContactsManager", () => {
    const builder = new ContactsManagerBuilder(defaultConstructorArgs);

    const contactsManager = builder.build();

    expect(contactsManager).toBeInstanceOf(DefaultContactsManager);
  });
});

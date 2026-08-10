import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";

import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { makeContainer } from "@internal/di";
import { externalTypes } from "@internal/externalTypes";

describe("makeContainer", () => {
  const dmk = {} as DeviceManagementKit;
  const sessionId = "session-id";
  const appName = "Ethereum";

  const container = makeContainer({ dmk, sessionId, appName });

  it("binds dmk, sessionId and appName as external values", () => {
    expect(container.get(externalTypes.Dmk)).toBe(dmk);
    expect(container.get(externalTypes.SessionId)).toBe(sessionId);
    expect(container.get(externalTypes.AppName)).toBe(appName);
  });

  it("binds the ContactsAppBinder", () => {
    expect(container.get(appBinderTypes.AppBinder)).toBeInstanceOf(
      ContactsAppBinder,
    );
  });
});

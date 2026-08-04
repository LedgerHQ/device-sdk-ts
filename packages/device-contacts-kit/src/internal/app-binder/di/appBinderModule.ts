import { ContainerModule } from "inversify";

import { ContactsAppBinder } from "@internal/app-binder/ContactsAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

export const appBinderModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(appBinderTypes.AppBinder).to(ContactsAppBinder);
  });

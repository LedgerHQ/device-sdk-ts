import {
  CONTACT_NAME_BUFFER_LENGTH,
  ETH_ADDRESS_BYTES,
  SCOPE_BUFFER_LENGTH,
  validateAddressHex,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterExternalAddressArgs } from "@api/model/RegisterExternalAddressArgs";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class RegisterExternalAddressUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(
    args: RegisterExternalAddressArgs,
  ): RegisterExternalAddressDAReturnType {
    validatePrintableLabel(args.name, {
      field: "name",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.scope, {
      field: "scope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });
    validateAddressHex(args.addressHex, { expectedBytes: ETH_ADDRESS_BYTES });
    validateDerivationPath(args.derivationPath);
    validateChainId(args.chainId);

    return this._appBinder.registerExternalAddress({
      ...args,
      derivationPath: stripMPrefix(args.derivationPath),
    });
  }
}

// `validateDerivationPath` accepts both "m/44'/60'/..." and "44'/60'/..." forms,
// but the downstream `DerivationPathUtils.splitPath` only accepts the latter.
// Normalize here so both inputs work.
function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) {
    return path.slice(2);
  }
  return path;
}

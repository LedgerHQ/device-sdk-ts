import {
  ACCOUNT_NAME_BUFFER_LENGTH,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type EditLedgerAccountDAReturnType } from "@api/app-binder/EditLedgerAccountDeviceActionTypes";
import { type EditLedgerAccountArgs } from "@api/model/EditLedgerAccountArgs";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class EditLedgerAccountUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(args: EditLedgerAccountArgs): EditLedgerAccountDAReturnType {
    validatePrintableLabel(args.name, {
      field: "name",
      bufferLength: ACCOUNT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.oldName, {
      field: "oldName",
      bufferLength: ACCOUNT_NAME_BUFFER_LENGTH,
    });
    validateDerivationPath(args.derivationPath);
    validateChainId(args.chainId);

    return this._appBinder.editLedgerAccount({
      ...args,
      derivationPath: stripMPrefix(args.derivationPath),
    });
  }
}

// Mirrors RegisterLedgerAccountUseCase: validateDerivationPath accepts both
// "m/44'/..." and "44'/..." forms but DerivationPathUtils.splitPath only accepts
// the latter, so normalize once at the boundary.
function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) {
    return path.slice(2);
  }
  return path;
}

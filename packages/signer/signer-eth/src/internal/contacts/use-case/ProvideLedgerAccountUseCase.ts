import {
  ACCOUNT_NAME_BUFFER_LENGTH,
  HMAC_PROOF_LENGTH,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
  ValidationError,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type ProvideLedgerAccountDAReturnType } from "@api/app-binder/ProvideLedgerAccountDeviceActionTypes";
import { type ProvideLedgerAccountArgs } from "@api/model/ProvideLedgerAccountArgs";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class ProvideLedgerAccountUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(args: ProvideLedgerAccountArgs): ProvideLedgerAccountDAReturnType {
    validatePrintableLabel(args.accountName, {
      field: "accountName",
      bufferLength: ACCOUNT_NAME_BUFFER_LENGTH,
    });
    validateDerivationPath(args.derivationPath);
    validateChainId(args.chainId);
    assertHexByteLength(args.hmacProofHex, HMAC_PROOF_LENGTH, "hmacProofHex");

    return this._appBinder.provideLedgerAccount({
      ...args,
      derivationPath: stripMPrefix(args.derivationPath),
    });
  }
}

function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) {
    return path.slice(2);
  }
  return path;
}

function assertHexByteLength(
  hex: string,
  expectedBytes: number,
  field: string,
): void {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (raw.length !== expectedBytes * 2) {
    throw new ValidationError(
      `${field} must be ${expectedBytes} bytes (${expectedBytes * 2} hex chars), got ${raw.length} hex chars`,
    );
  }
  if (!/^[0-9a-fA-F]*$/.test(raw)) {
    throw new ValidationError(`${field} contains non-hex characters`);
  }
}

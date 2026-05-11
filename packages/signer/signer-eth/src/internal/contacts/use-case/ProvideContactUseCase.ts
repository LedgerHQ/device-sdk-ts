import {
  CONTACT_NAME_BUFFER_LENGTH,
  ETH_ADDRESS_BYTES,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  SCOPE_BUFFER_LENGTH,
  validateAddressHex,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
  ValidationError,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type ProvideContactDAReturnType } from "@api/app-binder/ProvideContactDeviceActionTypes";
import { type ProvideContactArgs } from "@api/model/ProvideContactArgs";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class ProvideContactUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  execute(args: ProvideContactArgs): ProvideContactDAReturnType {
    validatePrintableLabel(args.contactName, {
      field: "contactName",
      bufferLength: CONTACT_NAME_BUFFER_LENGTH,
    });
    validatePrintableLabel(args.scope, {
      field: "scope",
      bufferLength: SCOPE_BUFFER_LENGTH,
    });
    validateAddressHex(args.addressHex, {
      expectedBytes: ETH_ADDRESS_BYTES,
    });
    validateDerivationPath(args.derivationPath);
    validateChainId(args.chainId);
    assertHexByteLength(
      args.groupHandleHex,
      GROUP_HANDLE_SIZE,
      "groupHandleHex",
    );
    assertHexByteLength(args.hmacNameHex, HMAC_PROOF_LENGTH, "hmacNameHex");
    assertHexByteLength(args.hmacRestHex, HMAC_PROOF_LENGTH, "hmacRestHex");

    return this._appBinder.provideContact({
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

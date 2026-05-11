import { type EditExternalAddressLabelDAReturnType } from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
import { type EditExternalAddressLabelArgs } from "@api/contacts/model/EditExternalAddressLabelArgs";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";

/**
 * Cross-chain Contacts service: hosts the OS-dispatchable operations that
 * mutate the device-side Contacts state across coins.
 *
 * Today both ops dispatch via the open ETH app's CLA (0xB0) as a polyfill.
 * When firmware OS-dispatch lands, internal dispatch swaps to OS-level CLA;
 * the public API stays identical.
 */
export interface ContactsService {
  /**
   * Op 4 — Rename Contact (`SUB_CMD_EDIT_CONTACT_NAME`, P1=0x02).
   *
   * Single APDU regardless of the contact's entry count. Rotates the
   * contact-level `hmac_name`; per-entry `hmac_rest` values stay untouched.
   */
  renameContact(args: RenameContactArgs): RenameContactDAReturnType;

  /**
   * Op 2 — Edit external address label (`SUB_CMD_EDIT_SCOPE`, P1=0x04).
   *
   * **Not yet implemented — lands in M4.** Method is declared here so the
   * interface stays stable across the M3/M4 split.
   */
  editExternalAddressLabel(
    args: EditExternalAddressLabelArgs,
  ): EditExternalAddressLabelDAReturnType;
}

export {
  type EditExternalAddressLabelDAError,
  type EditExternalAddressLabelDAIntermediateValue,
  type EditExternalAddressLabelDAOutput,
  type EditExternalAddressLabelDAReturnType,
  type EditExternalAddressLabelDAState,
} from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
export {
  type RenameContactDAError,
  type RenameContactDAIntermediateValue,
  type RenameContactDAOutput,
  type RenameContactDAReturnType,
  type RenameContactDAState,
} from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
export { type ContactsService } from "@api/contacts/ContactsService";
export { ContactsServiceBuilder } from "@api/contacts/ContactsServiceBuilder";
export {
  type EditExternalAddressLabelArgs,
  type EditExternalAddressLabelResult,
} from "@api/contacts/model/EditExternalAddressLabelArgs";
export {
  type RenameContactArgs,
  type RenameContactResult,
} from "@api/contacts/model/RenameContactArgs";
export {
  type Account,
  type Contact,
  type ContactEntry,
  emptyWallet,
  ResponseType,
  type Wallet,
  WALLET_SCHEMA_VERSION,
} from "@api/contacts/types";
export {
  BLOCKCHAIN_FAMILY_ETH,
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_EDIT_CONTACT_NAME,
  STRUCT_TYPE_EDIT_IDENTIFIER,
  STRUCT_TYPE_EDIT_SCOPE,
  STRUCT_TYPE_PROVIDE_CONTACT,
  STRUCT_TYPE_PROVIDE_LEDGER_ACCOUNT_CONTACT,
  STRUCT_TYPE_REGISTER_IDENTITY,
  STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@api/contacts/utils/contactsTlvSerializer";
export {
  sendFramedContactsPayload,
  type SendFramedContactsPayloadArgs,
} from "@api/contacts/utils/sendFramedContactsPayload";
export {
  ACCOUNT_NAME_BUFFER_LENGTH,
  CONTACT_NAME_BUFFER_LENGTH,
  ETH_ADDRESS_BYTES,
  GID_SIZE,
  GROUP_HANDLE_SIZE,
  HMAC_PROOF_LENGTH,
  IDENTIFIER_MAX_LENGTH,
  MAX_BIP32_DEPTH,
  SCOPE_BUFFER_LENGTH,
  validateAddressHex,
  validateChainId,
  validateDerivationPath,
  validatePrintableLabel,
  ValidationError,
} from "@api/contacts/validation";

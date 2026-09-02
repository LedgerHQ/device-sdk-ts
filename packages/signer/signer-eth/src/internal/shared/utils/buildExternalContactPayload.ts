import { type TransactionSubset } from "@ledgerhq/context-module";
import {
  buildProvideContactPayload,
  ETHEREUM_APP_NAME,
  resolveContactsVersionRequirements,
} from "@ledgerhq/device-contacts-kit";
import {
  ApplicationChecker,
  type DeviceSessionState,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type EvmAddressBook } from "@api/model/EvmAddressBook";
import { EthereumApplicationResolver } from "@internal/app-binder/EthereumApplicationResolver";

/**
 * The `BLOCKCHAIN_FAMILY` byte is mandatory on the wire but absent from the
 * public address-book model: the host has already filtered the snapshot down to
 * the EVM family, so the signer supplies it as a constant.
 */
const BLOCKCHAIN_FAMILY = "ethereum";

export type BuildExternalContactPayloadArgs = {
  readonly addressBook: EvmAddressBook;
  readonly subset: TransactionSubset;
  readonly deviceState: DeviceSessionState;
  readonly appConfig: GetConfigCommandResponse;
};

/**
 * Find the recipient of `subset` in the address book and encode it as the
 * PROVIDE CONTACT payload, or return `undefined` when the device cannot serve
 * the Contacts APDUs or the book holds no entry for that address on that chain.
 *
 * Matching is on `address` and `chainId` alone. The host resolves the
 * blockchain family upstream, so no entry of another family can be present;
 * within EVM, `chainId` is what separates the same address on different chains.
 *
 * Scope, deliberately narrow for a first version: the only address considered
 * is `subset.to`, the transaction's own recipient. A recipient that lives in
 * calldata — the `to` of an ERC-20 `transfer`, or any address inside a nested
 * call — is never matched, so those still review as a raw address even when the
 * book holds a contact for them. Covering them means resolving contacts per
 * decoded field, alongside the trusted-name references in
 * `BuildSubcontextsTask`, which is a separate piece of work.
 */
export function buildExternalContactPayload({
  addressBook,
  subset,
  deviceState,
  appConfig,
}: BuildExternalContactPayloadArgs): Uint8Array | undefined {
  if (!supportsContacts(deviceState, appConfig)) return undefined;

  const recipient = subset.to?.toLowerCase();
  if (recipient === undefined) return undefined;

  for (const group of addressBook.contactGroups) {
    const match = group.externalAddresses.find(
      (candidate) =>
        candidate.address.toLowerCase() === recipient &&
        candidate.chainId === BigInt(subset.chainId),
    );
    if (match === undefined) continue;

    const identifier = hexaStringToBuffer(match.address);
    if (identifier === null) continue;

    return buildProvideContactPayload({
      contactName: group.contactName,
      scope: match.scope,
      identifier,
      groupHandle: group.groupHandle,
      hmacProof: group.hmacProof,
      hmacRest: match.hmacRest,
      blockchainFamily: BLOCKCHAIN_FAMILY,
      chainId: match.chainId,
    });
  }

  return undefined;
}

/**
 * Gated on the device model and the running app, never on the OS version:
 * `GET OS VERSION` is a dashboard command, and the session refresher drops
 * `firmwareVersion` from the session state on the transition out of
 * `Connected` — so an OS check here would reject every device. An app new
 * enough to serve the Contacts APDUs implies an OS new enough to back it.
 *
 * The model minimum comes from the Contacts requirements table; the version
 * comparison goes through `ApplicationChecker`, as the clear-signing gates do,
 * so a clone of the Ethereum app is measured by the app version its config
 * reports rather than the clone's own.
 */
function supportsContacts(
  deviceState: DeviceSessionState,
  appConfig: GetConfigCommandResponse,
): boolean {
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!requirement.supported) {
    return false;
  }

  const minAppVersion = requirement.minAppVersion[ETHEREUM_APP_NAME];
  if (minAppVersion === undefined) {
    return false;
  }

  return new ApplicationChecker(
    deviceState,
    appConfig,
    new EthereumApplicationResolver(),
  )
    .withMinVersionInclusiveAcceptingPrerelease(minAppVersion)
    .check();
}

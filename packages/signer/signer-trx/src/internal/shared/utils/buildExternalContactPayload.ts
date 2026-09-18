import {
  buildProvideContactPayload,
  resolveContactsVersionRequirements,
  TRON_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  ApplicationChecker,
  type DeviceSessionState,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type TronAddressBook } from "@api/model/TronAddressBook";
import { TronApplicationResolver } from "@internal/app-binder/TronApplicationResolver";
import { decodeTronAddress } from "@internal/shared/utils/tronBase58Check";

const BLOCKCHAIN_FAMILY = "tron";

export type BuildExternalContactPayloadArgs = {
  readonly addressBook: TronAddressBook;
  readonly recipient: Uint8Array;
  readonly deviceState: DeviceSessionState;
  readonly appConfig: AppConfiguration;
};

export function buildExternalContactPayload({
  addressBook,
  recipient,
  deviceState,
  appConfig,
}: BuildExternalContactPayloadArgs): Uint8Array | undefined {
  if (!supportsContacts(deviceState, appConfig)) return undefined;

  for (const group of addressBook.contactGroups) {
    const match = group.externalAddresses.find((candidate) => {
      const decoded = decodeTronAddress(candidate.address);
      return (
        decoded?.length === recipient.length &&
        decoded.every((byte, index) => byte === recipient[index])
      );
    });
    if (match === undefined) continue;

    return buildProvideContactPayload({
      contactName: group.contactName,
      scope: match.scope,
      identifier: recipient,
      groupHandle: group.groupHandle,
      hmacProof: group.hmacProof,
      hmacRest: match.hmacRest,
      blockchainFamily: BLOCKCHAIN_FAMILY,
    });
  }

  return undefined;
}

function supportsContacts(
  deviceState: DeviceSessionState,
  appConfig: AppConfiguration,
): boolean {
  const requirement = resolveContactsVersionRequirements(
    deviceState.deviceModelId,
  );
  if (!requirement.supported) return false;

  const minAppVersion = requirement.minAppVersion[TRON_APP_NAME];
  if (minAppVersion === undefined) return false;

  return new ApplicationChecker(
    deviceState,
    appConfig,
    new TronApplicationResolver(),
  )
    .withMinVersionInclusiveAcceptingPrerelease(minAppVersion)
    .check();
}

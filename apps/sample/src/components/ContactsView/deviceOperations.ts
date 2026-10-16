/**
 * The device operations behind the Contacts page, as sequences of device
 * action steps run by the device step dialog.
 *
 * Each step starts one kit device action and folds its output into the address
 * book. Editing both the address and its name chains two steps, as Ledger
 * Wallet does: Edit Identifier, then Edit Scope with the rotated `hmacRest`.
 */
import {
  type EditExternalAddressIdentifierOutput,
  type EditExternalAddressScopeOutput,
  type RegisterExternalAddressOutput,
  type RenameContactOutput,
} from "@ledgerhq/device-contacts-kit";
import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
} from "@ledgerhq/device-management-kit";
import { type Observable } from "rxjs";

import { type AddressBookStore } from "@/components/ContactsView/AddressBookStore";
import {
  type ContactGroup,
  type ExternalAddress,
  isRegisteredGroup,
  parseHexField,
  type RegisteredContactGroup,
} from "@/lib/contacts/addressBook";
import { type ContactsOperationKind } from "@/lib/contacts/contactsErrors";
import {
  CONTACTS_FAMILIES,
  type ContactsFamily,
  toContactsFamilyOrThrow,
} from "@/lib/contacts/families";
import { type ContactsManagers } from "@/providers/ContactsProvider";

type Interaction = { readonly requiredUserInteraction: string };

export type DeviceStepState = DeviceActionState<unknown, unknown, Interaction>;

export type DeviceStep = Readonly<{
  label: string;
  /** Start the device action; `previous` is the prior step's output. */
  run: (
    managers: ContactsManagers,
    previous: unknown,
  ) => { observable: Observable<DeviceStepState>; cancel: () => void };
  /** Fold the step's output into the address book. */
  apply: (output: unknown) => void;
}>;

export type ContactsDeviceOperation = Readonly<{
  kind: ContactsOperationKind;
  /** App opened by the operation (none for an OS operation). */
  appName?: string;
  steps: readonly DeviceStep[];
}>;

function step<Output, Previous = unknown>(
  label: string,
  run: (
    managers: ContactsManagers,
    previous: Previous | undefined,
  ) => ExecuteDeviceActionReturnType<Output, unknown, Interaction>,
  apply: (output: Output) => void,
): DeviceStep {
  return {
    label,
    run: (managers, previous) =>
      run(managers, previous as Previous | undefined),
    apply: (output) => apply(output as Output),
  };
}

function identifierOf(address: ExternalAddress): Uint8Array {
  return parseHexField(address.address, "address");
}

export function registerAddressOperation(
  store: AddressBookStore,
  input: {
    group: ContactGroup;
    family: ContactsFamily;
    chainId: bigint | undefined;
    identifier: Uint8Array;
    scope: string;
  },
): ContactsDeviceOperation {
  const { group, family, chainId, identifier, scope } = input;
  const existingContactGroup = isRegisteredGroup(group)
    ? { groupHandle: group.groupHandle, hmacProof: group.hmacProof }
    : undefined;
  return {
    kind: "app",
    appName: CONTACTS_FAMILIES[family].appName,
    steps: [
      step<RegisterExternalAddressOutput>(
        existingContactGroup ? "Add address" : "Create contact",
        (managers) =>
          managers[family].registerExternalAddress({
            contactName: group.contactName,
            scope,
            identifier,
            blockchainFamily: family,
            chainId,
            existingContactGroup,
          }),
        (output) => store.onRegister(output, group.id),
      ),
    ],
  };
}

export function renameContactOperation(
  store: AddressBookStore,
  group: RegisteredContactGroup,
  newContactName: string,
): ContactsDeviceOperation {
  return {
    kind: "os",
    steps: [
      step<RenameContactOutput>(
        "Rename contact",
        // Rename is a dashboard operation: any family's manager serves it.
        (managers) =>
          managers.ethereum.renameContact({
            previousContactName: group.contactName,
            newContactName,
            groupHandle: group.groupHandle,
            hmacProof: group.hmacProof,
          }),
        store.onRename,
      ),
    ],
  };
}

/**
 * Edit an address and/or its name. Returns undefined when nothing changes.
 * `newIdentifier` / `newScope` are undefined when that field is unchanged.
 */
export function editAddressOperation(
  store: AddressBookStore,
  input: {
    group: RegisteredContactGroup;
    address: ExternalAddress;
    newIdentifier?: Uint8Array;
    newScope?: string;
  },
): ContactsDeviceOperation | undefined {
  const { group, address, newIdentifier, newScope } = input;
  const family = toContactsFamilyOrThrow(address.blockchainFamily);
  const common = {
    contactName: group.contactName,
    blockchainFamily: family,
    chainId: address.chainId,
    groupHandle: group.groupHandle,
    hmacProof: group.hmacProof,
  };

  const steps: DeviceStep[] = [];
  if (newIdentifier) {
    steps.push(
      step<EditExternalAddressIdentifierOutput>(
        "Edit address",
        (managers) =>
          managers[family].editExternalAddressIdentifier({
            ...common,
            scope: address.scope,
            previousIdentifier: identifierOf(address),
            newIdentifier,
            hmacRest: address.hmacRest,
          }),
        store.onEditIdentifier,
      ),
    );
  }
  if (newScope !== undefined) {
    steps.push(
      step<EditExternalAddressScopeOutput, EditExternalAddressIdentifierOutput>(
        "Edit address name",
        (managers, previous) =>
          managers[family].editExternalAddressScope({
            ...common,
            previousScope: address.scope,
            newScope,
            // Rotated by the identifier step when it ran first.
            identifier: newIdentifier ?? identifierOf(address),
            hmacRest: previous?.hmacRest ?? address.hmacRest,
          }),
        store.onEditScope,
      ),
    );
  }
  if (steps.length === 0) return undefined;
  return { kind: "app", appName: CONTACTS_FAMILIES[family].appName, steps };
}

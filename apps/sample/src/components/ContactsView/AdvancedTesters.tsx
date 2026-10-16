import React, { useEffect, useMemo } from "react";
import {
  type EditExternalAddressIdentifierOutput,
  type EditExternalAddressScopeOutput,
  type RegisterExternalAddressOutput,
  type RenameContactOutput,
} from "@ledgerhq/device-contacts-kit";
import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { Flex, Tag, Text } from "@ledgerhq/react-ui";

import { useAddressBookStore } from "@/components/ContactsView/AddressBookStore";
import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import {
  ADDRESS_BOOK_STORAGE_KEY,
  chainIdForFamily,
  CONTACTS_FAMILY_OPTIONS,
  type ContactsFamily,
  findGroupById,
  formatIdentifier,
  parseHexField,
  parseIdentifier,
  toContactsFamily,
} from "@/lib/contacts/addressBook";
import { displayAddress } from "@/lib/contacts/validation";
import { useContactsManagers } from "@/providers/ContactsProvider";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

/**
 * The raw testers for the four Contacts operations: every device field is
 * editable (hex proofs, arbitrary group handles), and the raw output is shown.
 * Meant for firmware / kit debugging; the Contacts page is the Ledger
 * Wallet-like flow over the same address book.
 */

const hexOrEmpty = (bytes: Uint8Array | undefined): string =>
  bytes ? bufferToHexaString(bytes, false) : "";

// Example first-account Ethereum address (no 0x prefix).
const DEFAULT_IDENTIFIER = "de0b295669a9fd93d5f28d9ec85e40f4cb697bae";

// A distinct Ethereum address used as the default replacement for the
// edit-identifier form, so the edit visibly changes the entry's identifier.
const DEFAULT_NEW_IDENTIFIER = "70997970c51812dc3a010c7d01b50e0d17dc79c8";

// A distinct scope used as the default replacement for the edit-scope form, so
// the edit visibly changes the entry's scope.
const DEFAULT_NEW_SCOPE = "Eth cold";

function last<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

// Family is a dropdown on every app-owned operation: it selects both the
// BLOCKCHAIN_FAMILY byte and the embedded app the operation runs in.
const familyValueSelector = { blockchainFamily: CONTACTS_FAMILY_OPTIONS };

// --- output views -----------------------------------------------------------
//
// Each view folds its device output into the address book on success (once, when
// the output arrives) and renders the returned proof material.

const SavedProofRows: React.FC<{ rows: Array<[string, string]> }> = ({
  rows,
}) => (
  <Flex flexDirection="column" rowGap={3}>
    <Flex columnGap={2} alignItems="center">
      <Tag active type="opacity">
        Saved to address book
      </Tag>
      <Text variant="small" color="neutral.c70">
        key: {ADDRESS_BOOK_STORAGE_KEY}
      </Text>
    </Flex>
    {rows.map(([label, value]) => (
      <Flex key={label} flexDirection="column">
        <Text variant="tiny" color="neutral.c70">
          {label}
        </Text>
        <Text variant="paragraph" style={{ wordBreak: "break-all" }}>
          {value}
        </Text>
      </Flex>
    ))}
  </Flex>
);

const RegisterExternalAddressOutputView: React.FC<{
  output: RegisterExternalAddressOutput;
}> = ({ output }) => {
  const { onRegister } = useAddressBookStore();
  useEffect(() => {
    onRegister(output);
  }, [output, onRegister]);

  const rows: Array<[string, string]> = [
    ["mode", output.mode],
    ["contactName", output.contactName],
    ["scope", output.scope],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    [
      "identifier",
      formatIdentifier(output.blockchainFamily, output.identifier),
    ],
    ["groupHandle", bufferToHexaString(output.groupHandle, false)],
    ["hmacProof", bufferToHexaString(output.hmacProof, false)],
    ["hmacRest", bufferToHexaString(output.hmacRest, false)],
  ];

  return <SavedProofRows rows={rows} />;
};

const RenameContactOutputView: React.FC<{
  output: RenameContactOutput;
}> = ({ output }) => {
  const { onRename } = useAddressBookStore();
  useEffect(() => {
    onRename(output);
  }, [output, onRename]);

  const rows: Array<[string, string]> = [
    ["previousContactName", output.previousContactName],
    ["contactName", output.contactName],
    ["groupHandle", bufferToHexaString(output.groupHandle, false)],
    ["hmacProof", bufferToHexaString(output.hmacProof, false)],
  ];

  return <SavedProofRows rows={rows} />;
};

const EditExternalAddressIdentifierOutputView: React.FC<{
  output: EditExternalAddressIdentifierOutput;
}> = ({ output }) => {
  const { onEditIdentifier } = useAddressBookStore();
  useEffect(() => {
    onEditIdentifier(output);
  }, [output, onEditIdentifier]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["scope", output.scope],
    [
      "previousIdentifier",
      formatIdentifier(output.blockchainFamily, output.previousIdentifier),
    ],
    [
      "identifier",
      formatIdentifier(output.blockchainFamily, output.identifier),
    ],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bufferToHexaString(output.groupHandle, false)],
    ["hmacProof", bufferToHexaString(output.hmacProof, false)],
    ["hmacRest", bufferToHexaString(output.hmacRest, false)],
  ];

  return <SavedProofRows rows={rows} />;
};

const EditExternalAddressScopeOutputView: React.FC<{
  output: EditExternalAddressScopeOutput;
}> = ({ output }) => {
  const { onEditScope } = useAddressBookStore();
  useEffect(() => {
    onEditScope(output);
  }, [output, onEditScope]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["previousScope", output.previousScope],
    ["scope", output.scope],
    [
      "identifier",
      formatIdentifier(output.blockchainFamily, output.identifier),
    ],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bufferToHexaString(output.groupHandle, false)],
    ["hmacProof", bufferToHexaString(output.hmacProof, false)],
    ["hmacRest", bufferToHexaString(output.hmacRest, false)],
  ];

  return <SavedProofRows rows={rows} />;
};

// --- form input types -------------------------------------------------------

type RegisterInput = {
  contactName: string;
  scope: string;
  identifier: string;
  blockchainFamily: ContactsFamily;
  chainId: string;
  existingGroupHandle: string;
  existingHmacProof: string;
  skipOpenApp: boolean;
};

type RenameContactInputForm = {
  previousContactName: string;
  newContactName: string;
  groupHandle: string;
  hmacProof: string;
};

type EditExternalAddressIdentifierInputForm = {
  contactName: string;
  scope: string;
  previousIdentifier: string;
  newIdentifier: string;
  blockchainFamily: ContactsFamily;
  chainId: string;
  groupHandle: string;
  hmacProof: string;
  hmacRest: string;
  skipOpenApp: boolean;
};

type EditExternalAddressScopeInputForm = {
  contactName: string;
  previousScope: string;
  newScope: string;
  identifier: string;
  blockchainFamily: ContactsFamily;
  chainId: string;
  groupHandle: string;
  hmacProof: string;
  hmacRest: string;
  skipOpenApp: boolean;
};

export const AdvancedTesters: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const contactsManagers = useContactsManagers();
  const { book } = useAddressBookStore();

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  // Pre-fill the rename / edit forms from the most recent persisted entries, so
  // a registered contact can be renamed or edited end-to-end. The forms capture
  // these values when a row is opened, so re-selecting a row after a successful
  // operation reflects the updated book.
  const lastGroup = last(book.contactGroups);
  const lastAddress = last(book.externalAddresses);
  const lastAddressGroup = lastAddress
    ? findGroupById(book, lastAddress.contactGroupId)
    : undefined;

  // The Contacts view lists actions with different input/output shapes, so the
  // list is typed loosely (mirroring the signer sample views).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Register External Address",
        description:
          "Register an external address on the device — creating a new contact group, or adding the address to an existing one by providing its group handle and name proof. The family selects the embedded app the operation runs in (Ethereum, Tron or Solana). Identifier: hex for Ethereum, a base58 T… address for Tron, a base58 wallet public key for Solana. chainId is sent for Ethereum only.",
        executeDeviceAction: ({
          contactName,
          scope,
          identifier,
          blockchainFamily,
          chainId,
          existingGroupHandle,
          existingHmacProof,
          skipOpenApp,
        }: RegisterInput) => {
          if (!contactsManagers) {
            throw new Error("Contacts manager not initialized");
          }
          const existingContactGroup =
            existingGroupHandle.trim().length > 0 &&
            existingHmacProof.trim().length > 0
              ? {
                  groupHandle: parseHexField(
                    existingGroupHandle,
                    "existingGroupHandle",
                  ),
                  hmacProof: parseHexField(
                    existingHmacProof,
                    "existingHmacProof",
                  ),
                }
              : undefined;

          return contactsManagers[blockchainFamily].registerExternalAddress({
            contactName,
            scope,
            identifier: parseIdentifier(
              blockchainFamily,
              identifier,
              "identifier",
            ),
            blockchainFamily,
            chainId: chainIdForFamily(blockchainFamily, chainId),
            existingContactGroup,
            skipOpenApp,
          });
        },
        validateValues: ({ contactName, scope, identifier }: RegisterInput) =>
          contactName.trim().length > 0 &&
          scope.trim().length > 0 &&
          identifier.trim().length > 0,
        initialValues: {
          contactName: "Alice",
          scope: "Eth main",
          identifier: DEFAULT_IDENTIFIER,
          blockchainFamily: "ethereum",
          chainId: "1",
          // Pre-fill the "link to existing group" fields from the latest group,
          // so adding a second address to it is one click away.
          existingGroupHandle: hexOrEmpty(lastGroup?.groupHandle),
          existingHmacProof: hexOrEmpty(lastGroup?.hmacProof),
          skipOpenApp: false,
        },
        valueSelector: familyValueSelector,
        OutputComponent: RegisterExternalAddressOutputView,
        deviceModelId,
      },
      {
        title: "Rename Contact",
        description:
          "Rename a contact group on the device dashboard (EDIT CONTACT NAME). Pre-filled from the most recently registered external-address contact; returns the replacement name proof.",
        executeDeviceAction: ({
          previousContactName,
          newContactName,
          groupHandle,
          hmacProof,
        }: RenameContactInputForm) => {
          if (!contactsManagers) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManagers.ethereum.renameContact({
            previousContactName,
            newContactName,
            groupHandle: parseHexField(groupHandle, "groupHandle"),
            hmacProof: parseHexField(hmacProof, "hmacProof"),
          });
        },
        validateValues: ({
          previousContactName,
          newContactName,
          groupHandle,
          hmacProof,
        }: RenameContactInputForm) =>
          previousContactName.trim().length > 0 &&
          newContactName.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0,
        initialValues: {
          previousContactName: lastGroup?.contactName ?? "Alice",
          newContactName: "Bob",
          groupHandle: hexOrEmpty(lastGroup?.groupHandle),
          hmacProof: hexOrEmpty(lastGroup?.hmacProof),
        },
        OutputComponent: RenameContactOutputView,
        deviceModelId,
      },
      {
        title: "Edit External Address Identifier",
        description:
          "Replace an entry's address within an existing contact group (EDIT IDENTIFIER). Pre-filled from the most recently registered external-address contact; rotates and returns the address-level proof (hmacRest) while the group name proof passes through unchanged.",
        executeDeviceAction: ({
          contactName,
          scope,
          previousIdentifier,
          newIdentifier,
          blockchainFamily,
          chainId,
          groupHandle,
          hmacProof,
          hmacRest,
          skipOpenApp,
        }: EditExternalAddressIdentifierInputForm) => {
          if (!contactsManagers) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManagers[
            blockchainFamily
          ].editExternalAddressIdentifier({
            contactName,
            scope,
            previousIdentifier: parseIdentifier(
              blockchainFamily,
              previousIdentifier,
              "previousIdentifier",
            ),
            newIdentifier: parseIdentifier(
              blockchainFamily,
              newIdentifier,
              "newIdentifier",
            ),
            blockchainFamily,
            chainId: chainIdForFamily(blockchainFamily, chainId),
            groupHandle: parseHexField(groupHandle, "groupHandle"),
            hmacProof: parseHexField(hmacProof, "hmacProof"),
            hmacRest: parseHexField(hmacRest, "hmacRest"),
            skipOpenApp,
          });
        },
        validateValues: ({
          contactName,
          scope,
          previousIdentifier,
          newIdentifier,
          groupHandle,
          hmacProof,
          hmacRest,
        }: EditExternalAddressIdentifierInputForm) =>
          contactName.trim().length > 0 &&
          scope.trim().length > 0 &&
          previousIdentifier.trim().length > 0 &&
          newIdentifier.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0 &&
          hmacRest.trim().length > 0,
        initialValues: {
          contactName: lastAddressGroup?.contactName ?? "Alice",
          scope: lastAddress?.scope ?? "Eth main",
          previousIdentifier: lastAddress
            ? displayAddress(lastAddress)
            : DEFAULT_IDENTIFIER,
          newIdentifier: DEFAULT_NEW_IDENTIFIER,
          blockchainFamily: toContactsFamily(lastAddress?.blockchainFamily),
          chainId: lastAddress?.chainId?.toString() ?? "1",
          groupHandle: lastAddress
            ? bufferToHexaString(lastAddress.groupHandle, false)
            : "",
          hmacProof: hexOrEmpty(lastAddressGroup?.hmacProof),
          hmacRest: lastAddress
            ? bufferToHexaString(lastAddress.hmacRest, false)
            : "",
          skipOpenApp: false,
        },
        valueSelector: familyValueSelector,
        OutputComponent: EditExternalAddressIdentifierOutputView,
        deviceModelId,
      },
      {
        title: "Edit External Address Scope",
        description:
          "Replace an entry's scope within an existing contact group (EDIT SCOPE), keeping the same contact name and identifier. Pre-filled from the most recently registered external-address contact; rotates and returns the address-level proof (hmacRest) while the group name proof passes through unchanged.",
        executeDeviceAction: ({
          contactName,
          previousScope,
          newScope,
          identifier,
          blockchainFamily,
          chainId,
          groupHandle,
          hmacProof,
          hmacRest,
          skipOpenApp,
        }: EditExternalAddressScopeInputForm) => {
          if (!contactsManagers) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManagers[blockchainFamily].editExternalAddressScope({
            contactName,
            previousScope,
            newScope,
            identifier: parseIdentifier(
              blockchainFamily,
              identifier,
              "identifier",
            ),
            blockchainFamily,
            chainId: chainIdForFamily(blockchainFamily, chainId),
            groupHandle: parseHexField(groupHandle, "groupHandle"),
            hmacProof: parseHexField(hmacProof, "hmacProof"),
            hmacRest: parseHexField(hmacRest, "hmacRest"),
            skipOpenApp,
          });
        },
        validateValues: ({
          contactName,
          previousScope,
          newScope,
          identifier,
          groupHandle,
          hmacProof,
          hmacRest,
        }: EditExternalAddressScopeInputForm) =>
          contactName.trim().length > 0 &&
          previousScope.trim().length > 0 &&
          newScope.trim().length > 0 &&
          identifier.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0 &&
          hmacRest.trim().length > 0,
        initialValues: {
          contactName: lastAddressGroup?.contactName ?? "Alice",
          previousScope: lastAddress?.scope ?? "Eth main",
          newScope: DEFAULT_NEW_SCOPE,
          identifier: lastAddress
            ? displayAddress(lastAddress)
            : DEFAULT_IDENTIFIER,
          blockchainFamily: toContactsFamily(lastAddress?.blockchainFamily),
          chainId: lastAddress?.chainId?.toString() ?? "1",
          groupHandle: lastAddress
            ? bufferToHexaString(lastAddress.groupHandle, false)
            : "",
          hmacProof: hexOrEmpty(lastAddressGroup?.hmacProof),
          hmacRest: lastAddress
            ? bufferToHexaString(lastAddress.hmacRest, false)
            : "",
          skipOpenApp: false,
        },
        valueSelector: familyValueSelector,
        OutputComponent: EditExternalAddressScopeOutputView,
        deviceModelId,
      },
    ],
    [contactsManagers, deviceModelId, lastGroup, lastAddress, lastAddressGroup],
  );

  return (
    <Flex flex={1} overflow="hidden">
      <DeviceActionsList
        title="Contacts (advanced)"
        deviceActions={deviceActions}
      />
    </Flex>
  );
};

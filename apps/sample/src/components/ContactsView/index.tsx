import React, { useEffect, useMemo } from "react";
import {
  type EditExternalAddressIdentifierDAOutput,
  type EditExternalAddressScopeDAOutput,
  type RegisterExternalAddressDAOutput,
  type RenameContactDAOutput,
} from "@ledgerhq/device-contacts-kit";
import { Flex, Tag, Text } from "@ledgerhq/react-ui";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useContactsManager } from "@/providers/ContactsProvider";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const CONTACTS_STORAGE_KEY = "dmk-sample-contacts";

// Example first-account Ethereum address (no 0x prefix).
const DEFAULT_IDENTIFIER = "de0b295669a9fd93d5f28d9ec85e40f4cb697bae";

// A distinct Ethereum address used as the default replacement for the
// edit-identifier form, so the edit visibly changes the entry's identifier.
const DEFAULT_NEW_IDENTIFIER = "70997970c51812dc3a010c7d01b50e0d17dc79c8";

// A distinct scope used as the default replacement for the edit-scope form, so
// the edit visibly changes the entry's scope.
const DEFAULT_NEW_SCOPE = "Eth cold";

function hexToBytes(hex: string): Uint8Array {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (raw.length % 2 !== 0) {
    throw new Error(`Hex value has an odd length: "${hex}"`);
  }
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) {
    bytes[i / 2] = parseInt(raw.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type PersistedContactEntry = {
  mode: RegisterExternalAddressDAOutput["mode"];
  contactName: string;
  scope: string;
  blockchainFamily: string;
  chainId?: string;
  identifierHex: string;
  groupHandleHex: string;
  hmacProofHex: string;
  hmacRestHex: string;
  registeredAt: string;
};

function loadEntries(): PersistedContactEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PersistedContactEntry[]) : [];
}

function persistProofs(output: RegisterExternalAddressDAOutput): void {
  if (typeof window === "undefined") return;
  const entry: PersistedContactEntry = {
    mode: output.mode,
    contactName: output.contactName,
    scope: output.scope,
    blockchainFamily: output.blockchainFamily,
    chainId: output.chainId?.toString(),
    identifierHex: bytesToHex(output.identifier),
    groupHandleHex: bytesToHex(output.groupHandle),
    hmacProofHex: bytesToHex(output.hmacProof),
    hmacRestHex: bytesToHex(output.hmacRest),
    registeredAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    CONTACTS_STORAGE_KEY,
    JSON.stringify([...loadEntries(), entry]),
  );
}

/** The most recently persisted contact, if any — used to pre-fill the rename
 * form so the playground can rename a persisted contact end-to-end. */
function loadLatestContact(): PersistedContactEntry | null {
  const entries = loadEntries();
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

/** After a successful rename, update the matching persisted contact in place —
 * new name + rotated (replacement) proof — so a subsequent rename round-trips. */
function applyRename(output: RenameContactDAOutput): void {
  if (typeof window === "undefined") return;
  const groupHandleHex = bytesToHex(output.groupHandle);
  const newHmacProofHex = bytesToHex(output.hmacProof);
  const updated = loadEntries().map((entry) =>
    entry.groupHandleHex === groupHandleHex
      ? {
          ...entry,
          contactName: output.contactName,
          hmacProofHex: newHmacProofHex,
        }
      : entry,
  );
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(updated));
}

/** After a successful identifier edit, update the matching persisted entry in
 * place — matched by group handle and the pre-edit identifier — with the new
 * identifier and the rotated address-level proof (`hmacRest`). The group-level
 * `hmacProof` is unchanged by an edit, so it passes through untouched and a
 * subsequent edit round-trips. */
function applyEditIdentifier(
  output: EditExternalAddressIdentifierDAOutput,
): void {
  if (typeof window === "undefined") return;
  const groupHandleHex = bytesToHex(output.groupHandle);
  const previousIdentifierHex = bytesToHex(output.previousIdentifier);
  const newIdentifierHex = bytesToHex(output.identifier);
  const newHmacRestHex = bytesToHex(output.hmacRest);
  const updated = loadEntries().map((entry) =>
    entry.groupHandleHex === groupHandleHex &&
    entry.identifierHex === previousIdentifierHex
      ? {
          ...entry,
          identifierHex: newIdentifierHex,
          hmacRestHex: newHmacRestHex,
        }
      : entry,
  );
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(updated));
}

/** After a successful scope edit, update the matching persisted entry in place —
 * matched by group handle, identifier, and the pre-edit scope — with the new
 * scope and the rotated address-level proof (`hmacRest`). The group-level
 * `hmacProof` and the identifier are unchanged by the edit, so they pass through
 * untouched and a subsequent edit round-trips. */
function applyEditScope(output: EditExternalAddressScopeDAOutput): void {
  if (typeof window === "undefined") return;
  const groupHandleHex = bytesToHex(output.groupHandle);
  const identifierHex = bytesToHex(output.identifier);
  const newHmacRestHex = bytesToHex(output.hmacRest);
  const updated = loadEntries().map((entry) =>
    entry.groupHandleHex === groupHandleHex &&
    entry.identifierHex === identifierHex &&
    entry.scope === output.previousScope
      ? {
          ...entry,
          scope: output.scope,
          hmacRestHex: newHmacRestHex,
        }
      : entry,
  );
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(updated));
}

const PersistedProofRows: React.FC<{ rows: Array<[string, string]> }> = ({
  rows,
}) => (
  <Flex flexDirection="column" rowGap={3}>
    <Flex columnGap={2} alignItems="center">
      <Tag active type="opacity">
        Persisted to localStorage
      </Tag>
      <Text variant="small" color="neutral.c70">
        key: {CONTACTS_STORAGE_KEY}
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
  output: RegisterExternalAddressDAOutput;
}> = ({ output }) => {
  // Persist every returned proof value locally as soon as it is available.
  useEffect(() => {
    persistProofs(output);
  }, [output]);

  const rows: Array<[string, string]> = [
    ["mode", output.mode],
    ["contactName", output.contactName],
    ["scope", output.scope],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["identifier", bytesToHex(output.identifier)],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <PersistedProofRows rows={rows} />;
};

const RenameContactOutputView: React.FC<{
  output: RenameContactDAOutput;
}> = ({ output }) => {
  // Update the matching persisted contact locally as soon as the proof rotates.
  useEffect(() => {
    applyRename(output);
  }, [output]);

  const rows: Array<[string, string]> = [
    ["previousContactName", output.previousContactName],
    ["contactName", output.contactName],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
  ];

  return <PersistedProofRows rows={rows} />;
};

const EditExternalAddressIdentifierOutputView: React.FC<{
  output: EditExternalAddressIdentifierDAOutput;
}> = ({ output }) => {
  // Update the matching persisted entry locally as soon as the identifier and
  // its address-level proof rotate.
  useEffect(() => {
    applyEditIdentifier(output);
  }, [output]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["scope", output.scope],
    ["previousIdentifier", bytesToHex(output.previousIdentifier)],
    ["identifier", bytesToHex(output.identifier)],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <PersistedProofRows rows={rows} />;
};

const EditExternalAddressScopeOutputView: React.FC<{
  output: EditExternalAddressScopeDAOutput;
}> = ({ output }) => {
  // Update the matching persisted entry locally as soon as the scope and its
  // address-level proof rotate.
  useEffect(() => {
    applyEditScope(output);
  }, [output]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["previousScope", output.previousScope],
    ["scope", output.scope],
    ["identifier", bytesToHex(output.identifier)],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <PersistedProofRows rows={rows} />;
};

type RegisterInput = {
  contactName: string;
  scope: string;
  identifier: string;
  blockchainFamily: string;
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
  blockchainFamily: string;
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
  blockchainFamily: string;
  chainId: string;
  groupHandle: string;
  hmacProof: string;
  hmacRest: string;
  skipOpenApp: boolean;
};

export const ContactsView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const contactsManager = useContactsManager();

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  // Pre-fill the rename form from a previously registered contact (read once on
  // mount); lets the playground rename a persisted contact end-to-end.
  const latestContact = useMemo(() => loadLatestContact(), []);

  // The Contacts view lists actions with different input/output shapes, so the
  // list is typed loosely (mirroring the signer sample views).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Register External Address",
        description:
          "Register an external address on the device — creating a new contact group, or adding the address to an existing one by providing its group handle and name proof.",
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
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }
          const existingContactGroup =
            existingGroupHandle.trim().length > 0 &&
            existingHmacProof.trim().length > 0
              ? {
                  groupHandle: hexToBytes(existingGroupHandle.trim()),
                  hmacProof: hexToBytes(existingHmacProof.trim()),
                }
              : undefined;

          return contactsManager.registerExternalAddress({
            contactName,
            scope,
            identifier: hexToBytes(identifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
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
          existingGroupHandle: "",
          existingHmacProof: "",
          skipOpenApp: false,
        },
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
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.renameContact({
            previousContactName,
            newContactName,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
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
          previousContactName: latestContact?.contactName ?? "Alice",
          newContactName: "Bob",
          groupHandle: latestContact?.groupHandleHex ?? "",
          hmacProof: latestContact?.hmacProofHex ?? "",
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
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.editExternalAddressIdentifier({
            contactName,
            scope,
            previousIdentifier: hexToBytes(previousIdentifier.trim()),
            newIdentifier: hexToBytes(newIdentifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
            hmacRest: hexToBytes(hmacRest.trim()),
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
          contactName: latestContact?.contactName ?? "Alice",
          scope: latestContact?.scope ?? "Eth main",
          previousIdentifier:
            latestContact?.identifierHex ?? DEFAULT_IDENTIFIER,
          newIdentifier: DEFAULT_NEW_IDENTIFIER,
          blockchainFamily: latestContact?.blockchainFamily ?? "ethereum",
          chainId: latestContact?.chainId ?? "1",
          groupHandle: latestContact?.groupHandleHex ?? "",
          hmacProof: latestContact?.hmacProofHex ?? "",
          hmacRest: latestContact?.hmacRestHex ?? "",
          skipOpenApp: false,
        },
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
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.editExternalAddressScope({
            contactName,
            previousScope,
            newScope,
            identifier: hexToBytes(identifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
            hmacRest: hexToBytes(hmacRest.trim()),
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
          contactName: latestContact?.contactName ?? "Alice",
          previousScope: latestContact?.scope ?? "Eth main",
          newScope: DEFAULT_NEW_SCOPE,
          identifier: latestContact?.identifierHex ?? DEFAULT_IDENTIFIER,
          blockchainFamily: latestContact?.blockchainFamily ?? "ethereum",
          chainId: latestContact?.chainId ?? "1",
          groupHandle: latestContact?.groupHandleHex ?? "",
          hmacProof: latestContact?.hmacProofHex ?? "",
          hmacRest: latestContact?.hmacRestHex ?? "",
          skipOpenApp: false,
        },
        OutputComponent: EditExternalAddressScopeOutputView,
        deviceModelId,
      },
    ],
    [contactsManager, deviceModelId, latestContact],
  );

  return <DeviceActionsList title="Contacts" deviceActions={deviceActions} />;
};

import React, { useEffect, useMemo } from "react";
import {
  type RegisterExternalAddressDAOutput,
  type RegisterLedgerAccountDAOutput,
} from "@ledgerhq/device-contacts-kit";
import { Flex, Tag, Text } from "@ledgerhq/react-ui";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { useContactsManager } from "@/providers/ContactsProvider";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

const CONTACTS_STORAGE_KEY = "dmk-sample-contacts";

// Example first-account Ethereum address (no 0x prefix).
const DEFAULT_IDENTIFIER = "de0b295669a9fd93d5f28d9ec85e40f4cb697bae";

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

type PersistedExternalAddressEntry = {
  kind: "externalAddress";
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

type PersistedLedgerAccountEntry = {
  kind: "ledgerAccount";
  accountName: string;
  derivationPath: string;
  blockchainFamily: string;
  chainId?: string;
  hmacProofHex: string;
  registeredAt: string;
};

type PersistedContactEntry =
  | PersistedExternalAddressEntry
  | PersistedLedgerAccountEntry;

function persistEntry(entry: PersistedContactEntry): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
  const existing: PersistedContactEntry[] = raw
    ? (JSON.parse(raw) as PersistedContactEntry[])
    : [];
  window.localStorage.setItem(
    CONTACTS_STORAGE_KEY,
    JSON.stringify([...existing, entry]),
  );
}

function persistProofs(output: RegisterExternalAddressDAOutput): void {
  persistEntry({
    kind: "externalAddress",
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
  });
}

function persistLedgerAccount(output: RegisterLedgerAccountDAOutput): void {
  persistEntry({
    kind: "ledgerAccount",
    accountName: output.accountName,
    derivationPath: output.derivationPath,
    blockchainFamily: output.blockchainFamily,
    chainId: output.chainId?.toString(),
    hmacProofHex: bytesToHex(output.hmacProof),
    registeredAt: new Date().toISOString(),
  });
}

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

const RegisterLedgerAccountOutputView: React.FC<{
  output: RegisterLedgerAccountDAOutput;
}> = ({ output }) => {
  // Persist the returned proof locally as soon as it is available.
  useEffect(() => {
    persistLedgerAccount(output);
  }, [output]);

  const rows: Array<[string, string]> = [
    ["accountName", output.accountName],
    ["derivationPath", output.derivationPath],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["hmacProof", bytesToHex(output.hmacProof)],
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

type RegisterLedgerAccountInputForm = {
  accountName: string;
  derivationPath: string;
  blockchainFamily: string;
  chainId: string;
  skipOpenApp: boolean;
};

export const ContactsView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const contactsManager = useContactsManager();

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

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
        title: "Register Ledger Account",
        description:
          "Register a Ledger (signer-controlled) account on the device. The account is derived on-device from the derivation path; the device returns an HMAC proof to persist.",
        executeDeviceAction: ({
          accountName,
          derivationPath,
          blockchainFamily,
          chainId,
          skipOpenApp,
        }: RegisterLedgerAccountInputForm) => {
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.registerLedgerAccount({
            accountName,
            derivationPath: derivationPath.trim(),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            skipOpenApp,
          });
        },
        validateValues: ({
          accountName,
          derivationPath,
        }: RegisterLedgerAccountInputForm) =>
          accountName.trim().length > 0 && derivationPath.trim().length > 0,
        initialValues: {
          accountName: "Alice",
          derivationPath: "m/44'/60'/0'/0/0",
          blockchainFamily: "ethereum",
          chainId: "1",
          skipOpenApp: false,
        },
        OutputComponent: RegisterLedgerAccountOutputView,
        deviceModelId,
      },
    ],
    [contactsManager, deviceModelId],
  );

  return <DeviceActionsList title="Contacts" deviceActions={deviceActions} />;
};

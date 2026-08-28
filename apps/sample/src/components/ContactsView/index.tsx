import React, { useEffect, useMemo } from "react";
import {
  type RegisterExternalAddressDAError,
  type RegisterExternalAddressDAIntermediateValue,
  type RegisterExternalAddressDAOutput,
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
  const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
  const existing: PersistedContactEntry[] = raw
    ? (JSON.parse(raw) as PersistedContactEntry[])
    : [];
  window.localStorage.setItem(
    CONTACTS_STORAGE_KEY,
    JSON.stringify([...existing, entry]),
  );
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

  return (
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

export const ContactsView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const contactsManager = useContactsManager();

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  const deviceActions: DeviceActionProps<
    RegisterExternalAddressDAOutput,
    RegisterInput,
    RegisterExternalAddressDAError,
    RegisterExternalAddressDAIntermediateValue
  >[] = useMemo(
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
        }) => {
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
        validateValues: ({ contactName, scope, identifier }) =>
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
    ],
    [contactsManager, deviceModelId],
  );

  return <DeviceActionsList title="Contacts" deviceActions={deviceActions} />;
};

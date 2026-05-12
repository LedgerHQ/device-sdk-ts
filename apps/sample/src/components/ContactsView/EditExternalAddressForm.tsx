import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Contact,
  type ContactEntry,
  ResponseType,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import {
  type EditExternalAddressDAState,
  type EditExternalAddressResult,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
  Button,
  Flex,
  Icons,
  Input,
  SelectInput,
  Text,
} from "@ledgerhq/react-ui";

import { SelectInputLabel } from "@/components/InputLabel";
import { useSignerEth } from "@/providers/SignerEthProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";
import { randomEthAddressHex } from "@/utils/crypto";

import { describeDeviceError, type FormStatus } from "./_shared";

type ContactOption = { label: string; value: string };
type EntryOption = { label: string; value: string };

function normalizeAddressHex(addressHex: string): string {
  const raw =
    addressHex.startsWith("0x") || addressHex.startsWith("0X")
      ? addressHex.slice(2)
      : addressHex;
  return raw.toLowerCase();
}

function applyEditAddress(
  wallet: Wallet,
  contactName: string,
  oldLabel: string,
  newAddressHex: string,
  result: EditExternalAddressResult,
): Wallet {
  const existing = wallet.contacts[contactName];
  if (!existing) return wallet;
  const entries: ContactEntry[] = existing.entries.map((entry) =>
    entry.scope === oldLabel
      ? {
          ...entry,
          addressHex: newAddressHex,
          hmacRestHex: result.hmacRestHex,
          lastResponseType: ResponseType.EditIdentifier,
        }
      : entry,
  );
  const updated: Contact = { ...existing, entries };
  return {
    ...wallet,
    contacts: { ...wallet.contacts, [contactName]: updated },
  };
}

export const EditExternalAddressForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const signer = useSignerEth();

  const [contactName, setContactName] = useState("");
  const [oldEntry, setOldEntry] = useState<EntryOption | null>(null);
  const [newAddressHex, setNewAddressHex] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const contactOptions = useMemo<ContactOption[]>(
    () =>
      Object.keys(wallet.contacts).map((name) => ({
        label: name,
        value: name,
      })),
    [wallet.contacts],
  );
  const selectedContact =
    contactOptions.find((opt) => opt.value === contactName) ?? null;

  const entryOptions = useMemo<EntryOption[]>(() => {
    const contact = wallet.contacts[contactName];
    if (!contact) return [];
    return contact.entries.map((entry) => ({
      label: `${entry.scope} (${entry.network})`,
      value: entry.scope,
    }));
  }, [contactName, wallet]);

  const submitDisabled = useMemo(
    () => !signer || status.kind === "running",
    [signer, status.kind],
  );

  const handleSubmit = useCallback(() => {
    if (!signer) return;

    const contact = wallet.contacts[contactName];
    if (!contact) {
      setStatus({
        kind: "error",
        message: `No contact named "${contactName}" in the contact book.`,
      });
      return;
    }
    const entry = contact.entries.find((e) => e.scope === oldEntry?.value);
    if (!entry) {
      setStatus({
        kind: "error",
        message: `"${contactName}" has no entry labelled "${oldEntry?.value ?? ""}".`,
      });
      return;
    }
    const normalizedNew = normalizeAddressHex(newAddressHex);
    if (!normalizedNew) {
      setStatus({ kind: "error", message: "New address is required." });
      return;
    }
    if (normalizedNew === entry.addressHex) {
      setStatus({
        kind: "error",
        message: "Old and new addresses are the same — nothing to edit.",
      });
      return;
    }
    if (
      contact.entries.some(
        (e) => e.addressHex === normalizedNew && e.chainId === entry.chainId,
      )
    ) {
      setStatus({
        kind: "error",
        message: `"${contactName}" already has an entry with that address on chainId ${entry.chainId}.`,
      });
      return;
    }

    setStatus({ kind: "running" });

    let observable;
    try {
      ({ observable } = signer.editExternalAddress({
        contactName,
        oldAddressHex: entry.addressHex,
        newAddressHex,
        scope: entry.scope,
        groupHandleHex: contact.groupHandleHex,
        hmacProofHex: contact.hmacNameHex,
        hmacRestHex: entry.hmacRestHex,
        derivationPath: entry.derivationPath,
        chainId: entry.chainId,
      }));
    } catch (e) {
      const message =
        e instanceof ValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Unknown validation error";
      setStatus({ kind: "error", message });
      return;
    }

    observable.subscribe({
      next: (state: EditExternalAddressDAState) => {
        if (state.status === "completed") {
          dispatch(
            setWallet(
              applyEditAddress(
                wallet,
                contactName,
                entry.scope,
                normalizedNew,
                state.output,
              ),
            ),
          );
          setStatus({
            kind: "success",
            message: `Updated "${contactName}" / "${entry.scope}" → ${normalizedNew}.`,
          });
        } else if (state.status === "error") {
          setStatus({
            kind: "error",
            message: describeDeviceError(state.error),
          });
        } else {
          setStatus({ kind: "running" });
        }
      },
      error: (err: unknown) => {
        setStatus({ kind: "error", message: describeDeviceError(err) });
      },
    });
  }, [dispatch, signer, wallet, contactName, oldEntry, newAddressHex]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      {!signer && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <Flex flexDirection="column" rowGap={1}>
        <SelectInput
          renderLeft={() => <SelectInputLabel>Contact</SelectInputLabel>}
          options={contactOptions}
          value={selectedContact}
          onChange={(opt) => {
            setContactName((opt as ContactOption | null)?.value ?? "");
            setOldEntry(null);
          }}
          isMulti={false}
          isSearchable={false}
          placeholder={
            contactOptions.length === 0
              ? "No contacts registered yet"
              : "Select a contact"
          }
          isDisabled={contactOptions.length === 0 || status.kind === "running"}
        />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <SelectInput
          options={entryOptions}
          value={oldEntry}
          onChange={(opt) => setOldEntry(opt as EntryOption | null)}
          isMulti={false}
          isSearchable={false}
          placeholder={
            entryOptions.length === 0
              ? "Pick a contact first"
              : "Pick the entry to edit (by label)"
          }
          isDisabled={entryOptions.length === 0 || status.kind === "running"}
        />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Input
          name="newAddressHex"
          value={newAddressHex}
          placeholder="New address (0x…)"
          onChange={setNewAddressHex}
          disabled={status.kind === "running"}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          renderRight={() => (
            <Flex
              alignItems="center"
              pr="8px"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Button
                variant="shade"
                outline
                iconButton
                Icon={() => <Icons.Refresh size="XS" />}
                onClick={() => setNewAddressHex(randomEthAddressHex())}
                disabled={status.kind === "running"}
                aria-label="Generate random test address"
              />
            </Flex>
          )}
        />
      </Flex>

      <Flex columnGap={3} alignItems="center">
        <Button variant="main" onClick={handleSubmit} disabled={submitDisabled}>
          Edit address
        </Button>
        {status.kind === "running" && (
          <Text variant="body" color="opacityDefault.c60">
            Awaiting device approval…
          </Text>
        )}
      </Flex>

      {status.kind === "success" && (
        <Text variant="body" color="success.c60">
          {status.message}
        </Text>
      )}
      {status.kind === "error" && (
        <Text variant="body" color="error.c60">
          {status.message}
        </Text>
      )}
    </Flex>
  );
};

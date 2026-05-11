import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Contact,
  CONTACT_NAME_BUFFER_LENGTH,
  type RenameContactDAState,
  type RenameContactResult,
  ResponseType,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import { Button, Flex, Input, Text } from "@ledgerhq/react-ui";

import { useContactsService } from "@/providers/ContactsServiceProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";

import { ContactNameInput } from "./ContactNameInput";
import {
  CharacterCounter,
  describeDeviceError,
  type FormStatus,
} from "./_shared";

const CONTACT_NAME_MAX_CHARS = CONTACT_NAME_BUFFER_LENGTH - 1;

function findDivergingPath(contact: Contact): string | null {
  if (contact.entries.length === 0) return null;
  const base = contact.entries[0].derivationPath;
  for (const entry of contact.entries) {
    if (entry.derivationPath !== base) {
      return `${base} ≠ ${entry.derivationPath}`;
    }
  }
  return null;
}

function applyRename(
  wallet: Wallet,
  oldName: string,
  newName: string,
  result: RenameContactResult,
): Wallet {
  const existing = wallet.contacts[oldName];
  if (!existing) return wallet;
  const renamed: Contact = {
    ...existing,
    name: newName,
    hmacNameHex: result.hmacNameHex,
    entries: existing.entries.map((entry) => ({
      ...entry,
      lastResponseType: ResponseType.EditContactName,
    })),
  };
  const nextContacts = { ...wallet.contacts };
  delete nextContacts[oldName];
  nextContacts[newName] = renamed;
  return { ...wallet, contacts: nextContacts };
}

export const RenameContactForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const service = useContactsService();

  const [oldName, setOldName] = useState("");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const submitDisabled = useMemo(
    () => !service || status.kind === "running",
    [service, status.kind],
  );

  const handleSubmit = useCallback(() => {
    if (!service) return;

    const existing = wallet.contacts[oldName];
    if (!existing) {
      setStatus({
        kind: "error",
        message: `No contact named "${oldName}" in the contact book.`,
      });
      return;
    }
    if (oldName === newName) {
      setStatus({
        kind: "error",
        message: "Old and new names are the same — nothing to rename.",
      });
      return;
    }
    if (wallet.contacts[newName]) {
      setStatus({
        kind: "error",
        message: `Another contact already uses the name "${newName}".`,
      });
      return;
    }
    const diverging = findDivergingPath(existing);
    if (diverging) {
      setStatus({
        kind: "error",
        message: `"${oldName}" has entries with diverging derivation paths (${diverging}). Wallet shape is corrupt — re-register the contact.`,
      });
      return;
    }

    setStatus({ kind: "running" });

    let observable;
    try {
      ({ observable } = service.renameContact({
        oldName,
        newName,
        groupHandleHex: existing.groupHandleHex,
        hmacProofHex: existing.hmacNameHex,
        derivationPath: existing.entries[0].derivationPath,
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
      next: (state: RenameContactDAState) => {
        if (state.status === "completed") {
          dispatch(setWallet(applyRename(wallet, oldName, newName, state.output)));
          setStatus({
            kind: "success",
            message: `Renamed "${oldName}" → "${newName}".`,
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
  }, [dispatch, service, wallet, oldName, newName]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Rename a contact in the contact book. Single APDU regardless of how
        many addresses the contact has — the contact-level HMAC rotates;
        per-entry proofs stay untouched.
      </Text>

      {!service && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <Flex flexDirection="column" rowGap={1}>
        <ContactNameInput
          value={oldName}
          onChange={setOldName}
          contacts={wallet.contacts}
          disabled={status.kind === "running"}
          mode="rename"
        />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Input
          name="newName"
          value={newName}
          placeholder="New name"
          onChange={setNewName}
          disabled={status.kind === "running"}
        />
        <CharacterCounter value={newName} max={CONTACT_NAME_MAX_CHARS} />
      </Flex>

      <Flex columnGap={3} alignItems="center">
        <Button variant="main" onClick={handleSubmit} disabled={submitDisabled}>
          Rename contact
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

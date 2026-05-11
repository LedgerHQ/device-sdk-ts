import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Contact,
  type ContactEntry,
  type EditExternalAddressLabelDAState,
  type EditExternalAddressLabelResult,
  ResponseType,
  SCOPE_BUFFER_LENGTH,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import { Button, Flex, Input, SelectInput, Text } from "@ledgerhq/react-ui";

import { useContactsService } from "@/providers/ContactsServiceProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";

import { ContactNameInput } from "./ContactNameInput";
import {
  CharacterCounter,
  describeDeviceError,
  type FormStatus,
} from "./_shared";

const SCOPE_MAX_CHARS = SCOPE_BUFFER_LENGTH - 1;

type LabelOption = { label: string; value: string };

function applyEditScope(
  wallet: Wallet,
  contactName: string,
  oldLabel: string,
  newLabel: string,
  result: EditExternalAddressLabelResult,
): Wallet {
  const existing = wallet.contacts[contactName];
  if (!existing) return wallet;
  const entries: ContactEntry[] = existing.entries.map((entry) =>
    entry.scope === oldLabel
      ? {
          ...entry,
          scope: newLabel,
          hmacRestHex: result.hmacRestHex,
          lastResponseType: ResponseType.EditScope,
        }
      : entry,
  );
  const updated: Contact = { ...existing, entries };
  return {
    ...wallet,
    contacts: { ...wallet.contacts, [contactName]: updated },
  };
}

export const EditExternalAddressLabelForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const service = useContactsService();

  const [contactName, setContactName] = useState("");
  const [oldLabel, setOldLabel] = useState<LabelOption | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const labelOptions = useMemo<LabelOption[]>(() => {
    const contact = wallet.contacts[contactName];
    if (!contact) return [];
    return contact.entries.map((entry) => ({
      label: entry.scope,
      value: entry.scope,
    }));
  }, [contactName, wallet]);

  const submitDisabled = useMemo(
    () => !service || status.kind === "running",
    [service, status.kind],
  );

  const handleSubmit = useCallback(() => {
    if (!service) return;

    const contact = wallet.contacts[contactName];
    if (!contact) {
      setStatus({
        kind: "error",
        message: `No contact named "${contactName}" in the contact book.`,
      });
      return;
    }
    const entry = contact.entries.find((e) => e.scope === oldLabel?.value);
    if (!entry) {
      setStatus({
        kind: "error",
        message: `"${contactName}" has no entry labelled "${oldLabel?.value ?? ""}".`,
      });
      return;
    }
    if (newLabel === entry.scope) {
      setStatus({
        kind: "error",
        message: "Old and new labels are the same — nothing to edit.",
      });
      return;
    }
    if (contact.entries.some((e) => e.scope === newLabel)) {
      setStatus({
        kind: "error",
        message: `"${contactName}" already has an entry labelled "${newLabel}". Pick a unique label.`,
      });
      return;
    }

    setStatus({ kind: "running" });

    let observable;
    try {
      ({ observable } = service.editExternalAddressLabel({
        contactName,
        oldLabel: entry.scope,
        newLabel,
        addressHex: entry.addressHex,
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
      next: (state: EditExternalAddressLabelDAState) => {
        if (state.status === "completed") {
          dispatch(
            setWallet(
              applyEditScope(
                wallet,
                contactName,
                entry.scope,
                newLabel,
                state.output,
              ),
            ),
          );
          setStatus({
            kind: "success",
            message: `Renamed "${contactName}" / "${entry.scope}" → "${newLabel}".`,
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
  }, [dispatch, service, wallet, contactName, oldLabel, newLabel]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Rename a single entry's address label. Per-entry HMAC rotates;
        contact-level proof and other entries stay untouched.
      </Text>

      {!service && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <ContactNameInput
        value={contactName}
        onChange={(name) => {
          setContactName(name);
          setOldLabel(null);
        }}
        contacts={wallet.contacts}
        disabled={status.kind === "running"}
        mode="rename"
      />

      <Flex flexDirection="column" rowGap={1}>
        <SelectInput
          options={labelOptions}
          value={oldLabel}
          onChange={(opt) => setOldLabel(opt as LabelOption | null)}
          isMulti={false}
          isSearchable={false}
          placeholder={
            labelOptions.length === 0
              ? "Pick a contact first"
              : "Pick the current label"
          }
          isDisabled={
            labelOptions.length === 0 || status.kind === "running"
          }
        />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Input
          name="newLabel"
          value={newLabel}
          placeholder="New label"
          onChange={setNewLabel}
          disabled={status.kind === "running"}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
        />
        <CharacterCounter value={newLabel} max={SCOPE_MAX_CHARS} />
      </Flex>

      <Flex columnGap={3} alignItems="center">
        <Button variant="main" onClick={handleSubmit} disabled={submitDisabled}>
          Edit label
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

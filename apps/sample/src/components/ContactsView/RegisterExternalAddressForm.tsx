import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Contact,
  CONTACT_NAME_BUFFER_LENGTH,
  type ContactEntry,
  ResponseType,
  SCOPE_BUFFER_LENGTH,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import {
  type RegisterExternalAddressDAState,
  type RegisterExternalAddressResult,
} from "@ledgerhq/device-signer-kit-ethereum";
import { Button, Flex, Icons, Input, Text } from "@ledgerhq/react-ui";

import { Form, type HintSelector } from "@/components/Form";
import { InputLabel } from "@/components/InputLabel";
import { useSignerEth } from "@/providers/SignerEthProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";
import { randomEthAddressHex } from "@/utils/crypto";

import {
  CharacterCounter,
  describeDeviceError,
  type FormStatus,
} from "./_shared";
import { ContactNameInput } from "./ContactNameInput";
import { NETWORK_OPTIONS, type NetworkName, NETWORKS } from "./networks";

// Buffer length is null-terminator-inclusive; usable text is one less.
const CONTACT_NAME_MAX_CHARS = CONTACT_NAME_BUFFER_LENGTH - 1;
const ADDRESS_LABEL_MAX_CHARS = SCOPE_BUFFER_LENGTH - 1;

// Hidden from the form — this is the BIP32 path used to derive the HMAC
// key on device, NOT an address-derivation path. Confusing to expose
// here (Register-external-address takes an address; Register-Ledger-account
// is the op that actually derives an address from a path), so it's
// hardcoded to the Ledger Live default.
const DEFAULT_DERIVATION_PATH = "44'/60'/0'/0/0";

// `contactName` and `addressHex` are rendered manually (custom combobox /
// Playground "fill with random address" icon-button) so they live outside
// FormValues. The remaining fields flow through the generic <Form />.
type FormValues = {
  addressLabel: string;
  network: string;
};

const initialFormValues: FormValues = {
  addressLabel: "",
  network: "ethereum",
};

const valueSelector = { network: NETWORK_OPTIONS };

const labelSelector = {
  addressLabel: "Address label",
  network: "Network",
};

function chainIdForNetwork(network: string): number {
  return NETWORKS[network as NetworkName] ?? NETWORKS.ethereum;
}

function normalizeAddressHex(addressHex: string): string {
  const raw =
    addressHex.startsWith("0x") || addressHex.startsWith("0X")
      ? addressHex.slice(2)
      : addressHex;
  return raw.toLowerCase();
}

function findExistingDuplicate(
  wallet: Wallet,
  normalizedAddress: string,
  chainId: number,
): { contactName: string; scope: string } | null {
  for (const [contactName, contact] of Object.entries(wallet.contacts)) {
    for (const entry of contact.entries) {
      if (entry.addressHex === normalizedAddress && entry.chainId === chainId) {
        return { contactName, scope: entry.scope };
      }
    }
  }
  return null;
}

function findScopeCollision(contact: Contact, scope: string): boolean {
  return contact.entries.some((entry) => entry.scope === scope);
}

function buildEntry(
  values: FormValues,
  addressHex: string,
  result: RegisterExternalAddressResult,
): ContactEntry {
  return {
    network: values.network,
    chainId: chainIdForNetwork(values.network),
    addressHex: normalizeAddressHex(addressHex),
    scope: values.addressLabel,
    derivationPath: DEFAULT_DERIVATION_PATH,
    hmacRestHex: result.hmacRestHex,
    lastResponseType: ResponseType.RegisterIdentity,
  };
}

function mergeFresh(
  wallet: Wallet,
  contactName: string,
  values: FormValues,
  addressHex: string,
  result: RegisterExternalAddressResult,
): Wallet {
  const newContact: Contact = {
    name: contactName,
    groupHandleHex: result.groupHandleHex,
    hmacNameHex: result.hmacNameHex,
    entries: [buildEntry(values, addressHex, result)],
  };
  return {
    ...wallet,
    contacts: { ...wallet.contacts, [contactName]: newContact },
  };
}

function mergeExtension(
  wallet: Wallet,
  values: FormValues,
  addressHex: string,
  existing: Contact,
  result: RegisterExternalAddressResult,
): Wallet {
  const updated: Contact = {
    ...existing,
    entries: [...existing.entries, buildEntry(values, addressHex, result)],
  };
  return {
    ...wallet,
    contacts: { ...wallet.contacts, [existing.name]: updated },
  };
}

export const RegisterExternalAddressForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const signer = useSignerEth();

  const [contactName, setContactName] = useState("");
  const [addressHex, setAddressHex] = useState("");
  const [values, setValues] = useState<FormValues>(initialFormValues);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  const submitDisabled = useMemo(
    () => !signer || status.kind === "running",
    [signer, status.kind],
  );

  const handleSubmit = useCallback(() => {
    if (!signer) return;

    const normalizedAddress = normalizeAddressHex(addressHex);
    const chainId = chainIdForNetwork(values.network);
    const existing = wallet.contacts[contactName];

    const dupe = findExistingDuplicate(wallet, normalizedAddress, chainId);
    if (dupe) {
      setStatus({
        kind: "error",
        message: `Address already registered to "${dupe.contactName}" / "${dupe.scope}" on ${values.network}.`,
      });
      return;
    }
    if (existing && findScopeCollision(existing, values.addressLabel)) {
      setStatus({
        kind: "error",
        message: `Contact "${contactName}" already has a "${values.addressLabel}" entry. Pick a unique label.`,
      });
      return;
    }

    const extension = existing
      ? {
          groupHandleHex: existing.groupHandleHex,
          hmacProofHex: existing.hmacNameHex,
        }
      : undefined;

    setStatus({ kind: "running" });

    let observable;
    try {
      ({ observable } = signer.registerExternalAddress({
        name: contactName,
        addressHex,
        scope: values.addressLabel,
        derivationPath: DEFAULT_DERIVATION_PATH,
        chainId,
        extension,
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
      next: (state: RegisterExternalAddressDAState) => {
        if (state.status === "completed") {
          const result = state.output;
          const merged = existing
            ? mergeExtension(wallet, values, addressHex, existing, result)
            : mergeFresh(wallet, contactName, values, addressHex, result);
          dispatch(setWallet(merged));
          setStatus({
            kind: "success",
            message: existing
              ? `Added "${values.addressLabel}" to "${contactName}".`
              : `Registered new contact "${contactName}".`,
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
  }, [dispatch, signer, contactName, addressHex, values, wallet]);

  const hintSelector: HintSelector<FormValues> = {
    addressLabel: (value) => (
      <CharacterCounter value={value} max={ADDRESS_LABEL_MAX_CHARS} />
    ),
  };

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Register a new external address as a contact.
      </Text>

      {!signer && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <Flex flexDirection="column" rowGap={1}>
        <ContactNameInput
          value={contactName}
          onChange={setContactName}
          contacts={wallet.contacts}
          disabled={status.kind === "running"}
        />
        <CharacterCounter value={contactName} max={CONTACT_NAME_MAX_CHARS} />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Input
          id="addressHex"
          renderLeft={() => <InputLabel>Address (0x…)</InputLabel>}
          value={addressHex}
          onChange={setAddressHex}
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
                onClick={() => setAddressHex(randomEthAddressHex())}
                disabled={status.kind === "running"}
                aria-label="Generate random test address"
              />
            </Flex>
          )}
        />
      </Flex>

      <Form
        initialValues={values}
        onChange={setValues}
        valueSelector={valueSelector}
        labelSelector={labelSelector}
        hintSelector={hintSelector}
        disabled={status.kind === "running"}
      />

      <Flex columnGap={3} alignItems="center">
        <Button variant="main" onClick={handleSubmit} disabled={submitDisabled}>
          Register address
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

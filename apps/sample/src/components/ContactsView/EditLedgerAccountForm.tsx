import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ACCOUNT_NAME_BUFFER_LENGTH,
  ResponseType,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import { type EditLedgerAccountDAState } from "@ledgerhq/device-signer-kit-ethereum";
import { Button, Flex, Input, SelectInput, Text } from "@ledgerhq/react-ui";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";
import { useContactsFormLogger } from "@/providers/ContactsLogs/ContactsLogsContext";
import { useSignerEth } from "@/providers/SignerEthProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";

import {
  CharacterCounter,
  describeDeviceError,
  type FormStatus,
} from "./_shared";

// Buffer length is null-terminator-inclusive; usable text is one less.
const ACCOUNT_NAME_MAX_CHARS = ACCOUNT_NAME_BUFFER_LENGTH - 1;

// Apply an approved rename: rotate the seed-bound HMAC proof, move the entry to
// its new name key, and record the response type. Mirrors the Python
// playground's `rename_account`.
function renameAccount(
  wallet: Wallet,
  oldName: string,
  newName: string,
  newHmacProofHex: string,
): Wallet {
  const prev = wallet.accounts[oldName];
  if (!prev) return wallet;
  const { [oldName]: _removed, ...rest } = wallet.accounts;
  return {
    ...wallet,
    accounts: {
      ...rest,
      [newName]: {
        ...prev,
        name: newName,
        hmacProofHex: newHmacProofHex,
        lastResponseType: ResponseType.EditLedgerAccount,
      },
    },
  };
}

export const EditLedgerAccountForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const signer = useSignerEth();
  const logFormSubmit = useContactsFormLogger();

  const accountNames = useMemo(
    () => Object.keys(wallet.accounts),
    [wallet.accounts],
  );
  const accountOptions = useMemo(
    () => accountNames.map((name) => ({ label: name, value: name })),
    [accountNames],
  );

  const [oldName, setOldName] = useState<string>(() => accountNames[0] ?? "");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  // Keep the selected account valid as the accounts map changes (e.g. after a
  // successful rename moves the entry to a new key).
  useEffect(() => {
    if (!wallet.accounts[oldName]) {
      setOldName(accountNames[0] ?? "");
    }
  }, [accountNames, oldName, wallet.accounts]);

  const selectedOption =
    accountOptions.find((opt) => opt.value === oldName) ?? null;

  const submitDisabled = useMemo(
    () => !signer || status.kind === "running" || accountNames.length === 0,
    [signer, status.kind, accountNames.length],
  );

  const handleSubmit = useCallback(() => {
    if (!signer) return;

    const account = wallet.accounts[oldName];
    if (!account) {
      setStatus({ kind: "error", message: "Select an account to rename." });
      return;
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      setStatus({ kind: "error", message: "New account name is required." });
      return;
    }
    if (trimmedName === oldName) {
      setStatus({
        kind: "error",
        message: "New name is the same as the current name.",
      });
      return;
    }
    if (wallet.accounts[trimmedName]) {
      setStatus({
        kind: "error",
        message: `Account "${trimmedName}" already exists. Pick a different name.`,
      });
      return;
    }

    setStatus({ kind: "running" });

    logFormSubmit("EditLedgerAccount", {
      oldName,
      newName: trimmedName,
      derivationPath: account.derivationPath,
      chainId: account.chainId,
    });

    let observable;
    try {
      ({ observable } = signer.editLedgerAccount({
        name: trimmedName,
        oldName,
        derivationPath: account.derivationPath,
        chainId: account.chainId,
        hmacProofHex: account.hmacProofHex,
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
      next: (state: EditLedgerAccountDAState) => {
        if (state.status === "completed") {
          dispatch(
            setWallet(
              renameAccount(
                wallet,
                oldName,
                trimmedName,
                state.output.hmacProofHex,
              ),
            ),
          );
          setStatus({
            kind: "success",
            message: `Renamed Ledger account "${oldName}" → "${trimmedName}".`,
          });
          setNewName("");
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
  }, [dispatch, signer, oldName, newName, wallet, logFormSubmit]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Rename a registered Ledger account. The device verifies the account was
        registered with the connected seed and rejects the rename (SW 0x6982)
        before showing any confirmation if it wasn&apos;t.
      </Text>

      {!signer && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      {accountNames.length === 0 ? (
        <Text variant="body" color="opacityDefault.c60">
          No registered Ledger accounts yet. Register one above first.
        </Text>
      ) : (
        <>
          <Flex flexDirection="column" alignItems="stretch">
            <SelectInput
              renderLeft={() => <SelectInputLabel>Account</SelectInputLabel>}
              isDisabled={status.kind === "running"}
              value={selectedOption}
              isMulti={false}
              onChange={(newVal) => {
                if (newVal) setOldName(newVal.value);
              }}
              options={accountOptions}
              isSearchable={false}
            />
          </Flex>

          <Flex flexDirection="column" rowGap={1}>
            <Input
              renderLeft={() => <InputLabel>New account name</InputLabel>}
              value={newName}
              onChange={setNewName}
              disabled={status.kind === "running"}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
            />
            <CharacterCounter value={newName} max={ACCOUNT_NAME_MAX_CHARS} />
          </Flex>

          <Flex columnGap={3} alignItems="center">
            <Button
              variant="main"
              onClick={handleSubmit}
              disabled={submitDisabled}
            >
              Rename account
            </Button>
            {status.kind === "running" && (
              <Text variant="body" color="opacityDefault.c60">
                Awaiting device approval…
              </Text>
            )}
          </Flex>
        </>
      )}

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

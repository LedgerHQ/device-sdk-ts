import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Account,
  ACCOUNT_NAME_BUFFER_LENGTH,
  ResponseType,
  ValidationError,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import {
  type RegisterLedgerAccountDAState,
  type RegisterLedgerAccountResult,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
  Button,
  Flex,
  Icons,
  Input,
  SelectInput,
  Text,
} from "@ledgerhq/react-ui";
import styled from "styled-components";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";
import { useSignerEth } from "@/providers/SignerEthProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";

import {
  CharacterCounter,
  describeDeviceError,
  type FormStatus,
} from "./_shared";
import { NETWORK_OPTIONS, type NetworkName, NETWORKS } from "./networks";

// Buffer length is null-terminator-inclusive; usable text is one less.
const ACCOUNT_NAME_MAX_CHARS = ACCOUNT_NAME_BUFFER_LENGTH - 1;

// EVM coin type. Ledger Live uses the Ethereum coin type for *all* EVM chains
// (Polygon, Arbitrum, Base, etc. share path m/44'/60'/...). Only the chainId
// differs across networks.
const EVM_COIN_TYPE = 60;

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function buildLedgerLivePath(accountIndex: number): string {
  return `m/44'/${EVM_COIN_TYPE}'/${accountIndex}'/0/0`;
}

// 1-indexed display name derived from the BIP32 account index. Account
// index N (0-based) → "<Capitalized network> N+1". Keeps name and path in
// lockstep so the user sees a single source of truth.
function defaultNameFor(network: NetworkName, accountIndex: number): string {
  return `${capitalize(network)} ${accountIndex + 1}`;
}

// Smart starting index for a freshly-opened form: count of already-registered
// accounts on the selected network's chainId. First time on Ethereum → 0,
// after one Ethereum account exists → 1, and so on. Approximation (we don't
// scan derivation paths for gaps), but lands on a free slot in the typical
// "register accounts one after another" flow.
function nextFreeIndex(wallet: Wallet, chainId: number): number {
  let n = 0;
  for (const account of Object.values(wallet.accounts)) {
    if (account.chainId === chainId) n += 1;
  }
  return n;
}

const StepperButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  background: transparent;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.neutral.c100};
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary.c80};
    color: ${({ theme }) => theme.colors.primary.c80};
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

function mergeAccount(wallet: Wallet, account: Account): Wallet {
  return {
    ...wallet,
    accounts: { ...wallet.accounts, [account.name]: account },
  };
}

function buildAccount(
  name: string,
  derivationPath: string,
  chainId: number,
  result: RegisterLedgerAccountResult,
): Account {
  return {
    name,
    derivationPath,
    chainId,
    hmacProofHex: result.hmacProofHex,
    addressHex: result.addressHex,
    lastResponseType: ResponseType.RegisterLedgerAccount,
  };
}

export const RegisterLedgerAccountForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const signer = useSignerEth();

  const [network, setNetwork] = useState<NetworkName>("ethereum");
  const [accountIndex, setAccountIndex] = useState(() =>
    nextFreeIndex(wallet, NETWORKS.ethereum),
  );

  const [name, setName] = useState(() =>
    defaultNameFor("ethereum", nextFreeIndex(wallet, NETWORKS.ethereum)),
  );
  const [nameTouched, setNameTouched] = useState(false);

  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  // When the network changes, jump the index to the next free slot for that
  // chain so a fresh form keeps landing on an unused account number.
  useEffect(() => {
    setAccountIndex(nextFreeIndex(wallet, NETWORKS[network]));
    // intentionally not depending on wallet: we only want this on a network
    // change, not on every wallet mutation (which would clobber a manual
    // index choice between submit and the slice update).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  // Keep the default name aligned with `network + accountIndex + 1` while the
  // user hasn't touched it. Once the user types anything, we leave their
  // value alone — even if they later change the network or step the index.
  useEffect(() => {
    if (!nameTouched) {
      setName(defaultNameFor(network, accountIndex));
    }
  }, [network, accountIndex, nameTouched]);

  const submitDisabled = useMemo(
    () => !signer || status.kind === "running",
    [signer, status.kind],
  );

  const autoPath = useMemo(
    () => buildLedgerLivePath(accountIndex),
    [accountIndex],
  );
  const chainId = NETWORKS[network];
  const selectedNetworkOption = NETWORK_OPTIONS.find(
    (opt) => opt.value === network,
  );

  const stepIndex = useCallback((delta: number) => {
    setAccountIndex((prev) => Math.max(0, prev + delta));
  }, []);

  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
    setNameTouched(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!signer) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus({ kind: "error", message: "Account name is required." });
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

    let observable;
    try {
      ({ observable } = signer.registerLedgerAccount({
        name: trimmedName,
        derivationPath: autoPath,
        chainId,
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
      next: (state: RegisterLedgerAccountDAState) => {
        if (state.status === "completed") {
          const result = state.output;
          // The use-case strips the "m/" prefix before sending to the device,
          // but storage keeps the user-facing path with the prefix.
          const account = buildAccount(trimmedName, autoPath, chainId, result);
          dispatch(setWallet(mergeAccount(wallet, account)));
          setStatus({
            kind: "success",
            message: `Registered Ledger account "${trimmedName}" — 0x${result.addressHex}.`,
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
  }, [dispatch, signer, name, autoPath, chainId, wallet]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Register a signer-controlled Ledger account on the device.
      </Text>

      {!signer && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <Flex flexDirection="column" alignItems="stretch">
        <SelectInput
          renderLeft={() => <SelectInputLabel>Network</SelectInputLabel>}
          isDisabled={status.kind === "running"}
          value={selectedNetworkOption}
          isMulti={false}
          onChange={(newVal) => {
            if (newVal) setNetwork(newVal.value as NetworkName);
          }}
          options={NETWORK_OPTIONS}
          isSearchable={false}
        />
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Flex alignItems="center" columnGap={3}>
          <InputLabel ml={0}>Account index</InputLabel>
          <Flex alignItems="center" columnGap={2}>
            <StepperButton
              type="button"
              aria-label="Decrement account index"
              onClick={() => stepIndex(-1)}
              disabled={status.kind === "running" || accountIndex === 0}
            >
              <Icons.Minus size="XS" />
            </StepperButton>
            <Text
              variant="body"
              fontWeight="medium"
              style={{ minWidth: 32, textAlign: "center" }}
            >
              {accountIndex}
            </Text>
            <StepperButton
              type="button"
              aria-label="Increment account index"
              onClick={() => stepIndex(1)}
              disabled={status.kind === "running"}
            >
              <Icons.Plus size="XS" />
            </StepperButton>
          </Flex>
        </Flex>
        <Text variant="small" color="opacityDefault.c50">
          Resolves to {autoPath}
        </Text>
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Input
          renderLeft={() => <InputLabel>Account name</InputLabel>}
          value={name}
          onChange={handleNameChange}
          disabled={status.kind === "running"}
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
        />
        <CharacterCounter value={name} max={ACCOUNT_NAME_MAX_CHARS} />
      </Flex>

      <Flex columnGap={3} alignItems="center">
        <Button variant="main" onClick={handleSubmit} disabled={submitDisabled}>
          Register account
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

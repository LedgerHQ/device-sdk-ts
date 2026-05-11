import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type Account,
  type Contact,
  type ContactEntry,
  DeviceActionStatus,
  hexaStringToBuffer,
  ResponseType,
  type Wallet,
} from "@ledgerhq/device-management-kit";
import { type Signature } from "@ledgerhq/device-signer-kit-ethereum";
import {
  Button,
  Flex,
  Icons,
  Input,
  Link,
  SelectInput,
  Switch,
  Tag,
  Text,
} from "@ledgerhq/react-ui";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import { type Observable } from "rxjs";
import styled from "styled-components";

import { InputLabel, SelectInputLabel } from "@/components/InputLabel";
import { useSignerEth } from "@/providers/SignerEthProvider";
import { selectWallet } from "@/state/contacts/selectors";
import { setWallet } from "@/state/contacts/slice";

import { describeDeviceError, type FormStatus } from "./_shared";

// Defaults mirror the playground CLI (`cli.py:710-715`). gas=21000 is the
// minimum legal value for a value-transfer; gwei=30 is the CLI's hardcoded
// default. The transaction is never broadcast (M7 is a protocol-composition
// validator), so the value is cosmetic — kept aligned to avoid reviewer
// confusion against playground traces.
const DEFAULT_GAS_LIMIT = 21000;
const DEFAULT_GAS_PRICE_GWEI = 30;
const DEFAULT_NONCE = 0;

type ToKind = "contact" | "account";

type ContactEntryRef = {
  contact: Contact;
  entry: ContactEntry;
  entryIndex: number;
};

type TraceLine = {
  kind: "info" | "ok" | "error";
  text: string;
};

type SignResult = {
  v: number;
  r: string;
  s: string;
  providedFrom: string | null;
  providedTo: string | null;
};

function formatShortAddress(addressHex: string): string {
  const hex = addressHex.startsWith("0x") ? addressHex : `0x${addressHex}`;
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

function formatNetworkName(entry: ContactEntry): string {
  return `${capitalize(entry.network)} (chainId ${entry.chainId})`;
}

function buildAccountOptionLabel(account: Account): string {
  const addr = account.addressHex
    ? formatShortAddress(account.addressHex)
    : "(no cached address)";
  return `${account.name} — ${addr} — chainId ${account.chainId}`;
}

function buildContactEntryOptionLabel(ref: ContactEntryRef): string {
  return `${ref.contact.name} / ${ref.entry.scope} — ${formatShortAddress(
    ref.entry.addressHex,
  )} — ${formatNetworkName(ref.entry)}`;
}

// Flatten contacts × entries into a single list of selectable targets. One
// row per (contact, entry) pair so the user picks an entry directly without
// drilling through a per-contact sub-menu.
function enumerateContactEntries(wallet: Wallet): ContactEntryRef[] {
  const out: ContactEntryRef[] = [];
  for (const contact of Object.values(wallet.contacts)) {
    contact.entries.forEach((entry, entryIndex) => {
      out.push({ contact, entry, entryIndex });
    });
  }
  return out;
}

function rotateAccountLastResponse(
  wallet: Wallet,
  accountName: string,
  responseType: ResponseType,
): Wallet {
  const account = wallet.accounts[accountName];
  if (!account) return wallet;
  return {
    ...wallet,
    accounts: {
      ...wallet.accounts,
      [accountName]: { ...account, lastResponseType: responseType },
    },
  };
}

function rotateContactEntryLastResponse(
  wallet: Wallet,
  contactName: string,
  entryIndex: number,
  responseType: ResponseType,
): Wallet {
  const contact = wallet.contacts[contactName];
  if (!contact) return wallet;
  const nextEntries = contact.entries.map((entry, i) =>
    i === entryIndex ? { ...entry, lastResponseType: responseType } : entry,
  );
  return {
    ...wallet,
    contacts: {
      ...wallet.contacts,
      [contactName]: { ...contact, entries: nextEntries },
    },
  };
}

// Build the unsigned RLP-encoded legacy transaction. Legacy (type=0) not
// EIP-1559 — matches the playground's `_build_eth_tx_params` shape
// (`service.py:865-906`).
function buildLegacyTxBytes(args: {
  toAddressHex: string;
  amountWei: bigint;
  gasLimit: number;
  gasPriceWei: bigint;
  nonce: number;
  chainId: number;
  dataHex: string;
}): Uint8Array {
  const toHex = args.toAddressHex.startsWith("0x")
    ? args.toAddressHex
    : `0x${args.toAddressHex}`;
  const dataHex = args.dataHex.trim();
  const tx = ethers.Transaction.from({
    type: 0,
    to: toHex,
    value: args.amountWei,
    gasLimit: args.gasLimit,
    gasPrice: args.gasPriceWei,
    nonce: args.nonce,
    chainId: args.chainId,
    data:
      dataHex.length === 0
        ? "0x"
        : dataHex.startsWith("0x")
          ? dataHex
          : `0x${dataHex}`,
  });
  const buf = hexaStringToBuffer(tx.unsignedSerialized);
  if (!buf) throw new Error("Failed to serialize legacy transaction.");
  return buf;
}

function parseHexInputAsBytes(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return new Uint8Array();
  const raw =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  if (raw.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(raw)) return null;
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) {
    bytes[i / 2] = parseInt(raw.slice(i, i + 2), 16);
  }
  return bytes;
}

// Subscribe to a device-action observable and resolve when it reaches a
// terminal status (Completed or Error). `onPending` fires every intermediate
// emission so the form can flip the "awaiting on device" status during Sign.
function awaitDeviceAction<TOutput>(
  observable: Observable<{
    status: DeviceActionStatus;
    output?: TOutput;
    error?: unknown;
  }>,
  onPending: () => void,
): Promise<TOutput> {
  return new Promise<TOutput>((resolve, reject) => {
    observable.subscribe({
      next: (state) => {
        if (state.status === DeviceActionStatus.Completed) {
          resolve(state.output as TOutput);
        } else if (state.status === DeviceActionStatus.Error) {
          reject(state.error);
        } else {
          onPending();
        }
      },
      error: (err) => reject(err),
    });
  });
}

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      });
    }
  }, [value]);
  return (
    <CopyChip type="button" onClick={handleCopy} aria-label="Copy">
      {copied ? "Copied" : "Copy"}
    </CopyChip>
  );
};

const CopyChip = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.colors.neutral.c40};
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.neutral.c100};
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.c80};
    color: ${({ theme }) => theme.colors.primary.c80};
  }
`;

const TraceRow = styled.div<{ $tone: TraceLine["kind"] }>`
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: ${({ theme, $tone }) =>
    $tone === "error"
      ? theme.colors.error.c60
      : $tone === "ok"
        ? theme.colors.success.c60
        : theme.colors.opacityDefault.c60};
  white-space: pre-wrap;
  word-break: break-all;
`;

const ResultGrid = styled.div`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  align-items: center;
  column-gap: 12px;
  row-gap: 4px;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
`;

const ResultLabel = styled.span`
  color: ${({ theme }) => theme.colors.opacityDefault.c60};
`;

const ResultValue = styled.span`
  color: ${({ theme }) => theme.colors.neutral.c100};
  word-break: break-all;
`;

export const SendToContactForm: React.FC = () => {
  const dispatch = useDispatch();
  const wallet = useSelector(selectWallet);
  const signer = useSignerEth();
  const router = useRouter();

  const accountList = useMemo(
    () => Object.values(wallet.accounts),
    [wallet.accounts],
  );
  const contactEntryList = useMemo(
    () => enumerateContactEntries(wallet),
    [wallet],
  );

  const [fromAccountName, setFromAccountName] = useState<string | null>(
    () => accountList[0]?.name ?? null,
  );
  const [toKind, setToKind] = useState<ToKind>(
    contactEntryList.length > 0 ? "contact" : "account",
  );
  const [toContactEntryKey, setToContactEntryKey] = useState<string | null>(
    () => {
      const first = contactEntryList[0];
      return first ? `${first.contact.name}#${first.entryIndex}` : null;
    },
  );
  const [toAccountName, setToAccountName] = useState<string | null>(
    () => accountList[0]?.name ?? null,
  );

  const [amountEth, setAmountEth] = useState("0.01");
  const [gasLimit, setGasLimit] = useState(String(DEFAULT_GAS_LIMIT));
  const [gasPriceGwei, setGasPriceGwei] = useState(
    String(DEFAULT_GAS_PRICE_GWEI),
  );
  const [nonce, setNonce] = useState(String(DEFAULT_NONCE));

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dataHex, setDataHex] = useState("");
  const [provideFrom, setProvideFrom] = useState(true);
  const [provideTo, setProvideTo] = useState(true);

  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [result, setResult] = useState<SignResult | null>(null);

  const fromAccount = fromAccountName
    ? (wallet.accounts[fromAccountName] ?? null)
    : null;
  const toContactEntry =
    toKind === "contact" && toContactEntryKey
      ? (contactEntryList.find(
          (ref) =>
            `${ref.contact.name}#${ref.entryIndex}` === toContactEntryKey,
        ) ?? null)
      : null;
  const toAccount =
    toKind === "account" && toAccountName
      ? (wallet.accounts[toAccountName] ?? null)
      : null;

  const fromChainId = fromAccount?.chainId ?? null;
  const toChainId =
    toKind === "contact"
      ? (toContactEntry?.entry.chainId ?? null)
      : (toAccount?.chainId ?? null);

  const chainMismatch =
    fromChainId !== null && toChainId !== null && fromChainId !== toChainId;

  const dataBytesValid = parseHexInputAsBytes(dataHex) !== null;

  const submitDisabled =
    !signer ||
    !fromAccount ||
    (toKind === "contact" ? !toContactEntry : !toAccount) ||
    chainMismatch ||
    !dataBytesValid ||
    status.kind === "running";

  const accountOptions = useMemo(
    () =>
      accountList.map((acc) => ({
        label: buildAccountOptionLabel(acc),
        value: acc.name,
      })),
    [accountList],
  );

  const contactEntryOptions = useMemo(
    () =>
      contactEntryList.map((ref) => ({
        label: buildContactEntryOptionLabel(ref),
        value: `${ref.contact.name}#${ref.entryIndex}`,
      })),
    [contactEntryList],
  );

  const appendTrace = useCallback((line: TraceLine) => {
    setTrace((prev) => [...prev, line]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!signer || !fromAccount) return;
    if (toKind === "contact" && !toContactEntry) return;
    if (toKind === "account" && !toAccount) return;
    if (chainMismatch) return;

    const amount = (() => {
      try {
        return ethers.parseEther(amountEth.trim());
      } catch {
        return null;
      }
    })();
    if (amount === null || amount < 0n) {
      setStatus({
        kind: "error",
        message: "Amount must be a non-negative decimal in ETH.",
      });
      return;
    }
    const gasLimitNum = Number.parseInt(gasLimit, 10);
    if (!Number.isFinite(gasLimitNum) || gasLimitNum <= 0) {
      setStatus({
        kind: "error",
        message: "Gas limit must be a positive integer.",
      });
      return;
    }
    const gasPriceFloat = Number.parseFloat(gasPriceGwei);
    if (!Number.isFinite(gasPriceFloat) || gasPriceFloat <= 0) {
      setStatus({
        kind: "error",
        message: "Gas price must be a positive number (gwei).",
      });
      return;
    }
    const gasPriceWei = BigInt(Math.round(gasPriceFloat * 1e9));
    const nonceNum = Number.parseInt(nonce, 10);
    if (!Number.isFinite(nonceNum) || nonceNum < 0) {
      setStatus({
        kind: "error",
        message: "Nonce must be a non-negative integer.",
      });
      return;
    }
    if (!dataBytesValid) {
      setStatus({
        kind: "error",
        message: "Data must be a valid hex string (even length).",
      });
      return;
    }

    const recipientAddressHex =
      toKind === "contact"
        ? toContactEntry!.entry.addressHex
        : toAccount!.addressHex;
    if (!recipientAddressHex) {
      setStatus({
        kind: "error",
        message:
          "Recipient account has no cached address — re-register it to refresh.",
      });
      return;
    }
    const chainId = toChainId ?? fromChainId!;

    setTrace([]);
    setResult(null);
    setStatus({ kind: "running" });

    let providedFromName: string | null = null;
    let providedToName: string | null = null;

    try {
      if (provideFrom && fromAccount) {
        appendTrace({ kind: "info", text: "→ Provide From sent…" });
        const { observable } = signer.provideLedgerAccount({
          accountName: fromAccount.name,
          hmacProofHex: fromAccount.hmacProofHex,
          derivationPath: fromAccount.derivationPath,
          chainId: fromAccount.chainId,
        });
        await awaitDeviceAction(observable, () => {});
        providedFromName = fromAccount.name;
        appendTrace({
          kind: "ok",
          text: `  0x9000 ✓ Provided "${fromAccount.name}"`,
        });
        // Sticky state-rotation: dispatch on the 0x9000 ack, not only after
        // Sign. Matches service.py:942-952.
        dispatch(
          setWallet(
            rotateAccountLastResponse(
              wallet,
              fromAccount.name,
              ResponseType.ProvideLedgerAccountContact,
            ),
          ),
        );
      }

      if (provideTo) {
        if (toKind === "contact" && toContactEntry) {
          const { contact, entry, entryIndex } = toContactEntry;
          appendTrace({ kind: "info", text: "→ Provide To sent…" });
          const { observable } = signer.provideContact({
            contactName: contact.name,
            scope: entry.scope,
            addressHex: entry.addressHex,
            groupHandleHex: contact.groupHandleHex,
            hmacNameHex: contact.hmacNameHex,
            hmacRestHex: entry.hmacRestHex,
            derivationPath: entry.derivationPath,
            chainId: entry.chainId,
          });
          await awaitDeviceAction(observable, () => {});
          providedToName = `${contact.name} / ${entry.scope}`;
          appendTrace({
            kind: "ok",
            text: `  0x9000 ✓ Provided "${providedToName}"`,
          });
          dispatch(
            setWallet(
              rotateContactEntryLastResponse(
                wallet,
                contact.name,
                entryIndex,
                ResponseType.ProvideContact,
              ),
            ),
          );
        } else if (toKind === "account" && toAccount) {
          appendTrace({ kind: "info", text: "→ Provide To sent…" });
          const { observable } = signer.provideLedgerAccount({
            accountName: toAccount.name,
            hmacProofHex: toAccount.hmacProofHex,
            derivationPath: toAccount.derivationPath,
            chainId: toAccount.chainId,
          });
          await awaitDeviceAction(observable, () => {});
          providedToName = toAccount.name;
          appendTrace({
            kind: "ok",
            text: `  0x9000 ✓ Provided "${toAccount.name}"`,
          });
          dispatch(
            setWallet(
              rotateAccountLastResponse(
                wallet,
                toAccount.name,
                ResponseType.ProvideLedgerAccountContact,
              ),
            ),
          );
        }
      }

      const txBytes = buildLegacyTxBytes({
        toAddressHex: recipientAddressHex,
        amountWei: amount,
        gasLimit: gasLimitNum,
        gasPriceWei,
        nonce: nonceNum,
        chainId,
        dataHex,
      });

      appendTrace({
        kind: "info",
        text: "→ Sign sent — awaiting approval on device…",
      });

      const { observable } = signer.signTransaction(
        fromAccount.derivationPath,
        txBytes,
        {},
      );
      const signature: Signature = await awaitDeviceAction(observable, () => {
        // Keep status as "running"; the form copy already reads "Awaiting…".
      });

      appendTrace({ kind: "ok", text: "  ✓ Sign approved" });
      setResult({
        v: signature.v,
        r: signature.r,
        s: signature.s,
        providedFrom: providedFromName,
        providedTo: providedToName,
      });
      setStatus({
        kind: "success",
        message: "Transaction signed (v/r/s below).",
      });
    } catch (err) {
      // State-rotation is sticky on Sign-reject — the dispatches above are
      // NOT rolled back here. The wallet records what the device knows.
      appendTrace({ kind: "error", text: `  ✗ ${describeDeviceError(err)}` });
      setStatus({ kind: "error", message: describeDeviceError(err) });
    }
  }, [
    signer,
    fromAccount,
    toKind,
    toContactEntry,
    toAccount,
    chainMismatch,
    amountEth,
    gasLimit,
    gasPriceGwei,
    nonce,
    dataHex,
    dataBytesValid,
    provideFrom,
    provideTo,
    toChainId,
    fromChainId,
    wallet,
    dispatch,
    appendTrace,
  ]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Compose an ETH transfer to a contact entry or a Ledger account. Up to
        three APDUs run in order — Provide From, Provide To, Sign — but the
        device only prompts once (Sign). The two Provides return 0x9000 silently
        because firmware trusts the HMAC chain authorised at Register time. The
        Sign review shows both friendly names.
      </Text>

      {!signer && (
        <Text variant="body" color="warning.c60">
          No active device session. Connect a device on the home page to enable
          submission.
        </Text>
      )}

      <Flex flexDirection="column" rowGap={1}>
        <SelectInput
          renderLeft={() => (
            <SelectInputLabel>From (Ledger account)</SelectInputLabel>
          )}
          isDisabled={status.kind === "running" || accountList.length === 0}
          value={
            fromAccountName
              ? (accountOptions.find((opt) => opt.value === fromAccountName) ??
                null)
              : null
          }
          isMulti={false}
          onChange={(newVal) => {
            if (newVal) setFromAccountName(newVal.value as string);
          }}
          options={accountOptions}
          isSearchable={false}
        />
        {accountList.length === 0 && (
          <Text variant="small" color="warning.c60">
            No Ledger accounts registered.{" "}
            <Link
              onClick={() => router.push("/services/contacts/ledger-accounts")}
            >
              Register one first.
            </Link>
          </Text>
        )}
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Flex columnGap={2} alignItems="center">
          <InputLabel ml={0}>To</InputLabel>
          <Tag
            type={toKind === "contact" ? "plain" : "outlinedOpacity"}
            active={toKind === "contact"}
            onClick={() =>
              status.kind === "running" ? undefined : setToKind("contact")
            }
            style={{
              cursor: status.kind === "running" ? "not-allowed" : "pointer",
            }}
          >
            Contact entry
          </Tag>
          <Tag
            type={toKind === "account" ? "plain" : "outlinedOpacity"}
            active={toKind === "account"}
            onClick={() =>
              status.kind === "running" ? undefined : setToKind("account")
            }
            style={{
              cursor: status.kind === "running" ? "not-allowed" : "pointer",
            }}
          >
            Ledger account
          </Tag>
        </Flex>

        {toKind === "contact" ? (
          contactEntryList.length === 0 ? (
            <Text variant="small" color="warning.c60">
              No contact entries registered.{" "}
              <Link
                onClick={() =>
                  router.push("/services/contacts/external-addresses")
                }
              >
                Register one first.
              </Link>
            </Text>
          ) : (
            <SelectInput
              renderLeft={() => <SelectInputLabel>Entry</SelectInputLabel>}
              isDisabled={status.kind === "running"}
              value={
                toContactEntryKey
                  ? (contactEntryOptions.find(
                      (opt) => opt.value === toContactEntryKey,
                    ) ?? null)
                  : null
              }
              isMulti={false}
              onChange={(newVal) => {
                if (newVal) setToContactEntryKey(newVal.value as string);
              }}
              options={contactEntryOptions}
              isSearchable={false}
            />
          )
        ) : accountList.length === 0 ? (
          <Text variant="small" color="warning.c60">
            No Ledger accounts registered.{" "}
            <Link
              onClick={() => router.push("/services/contacts/ledger-accounts")}
            >
              Register one first.
            </Link>
          </Text>
        ) : (
          <SelectInput
            renderLeft={() => <SelectInputLabel>Account</SelectInputLabel>}
            isDisabled={status.kind === "running"}
            value={
              toAccountName
                ? (accountOptions.find((opt) => opt.value === toAccountName) ??
                  null)
                : null
            }
            isMulti={false}
            onChange={(newVal) => {
              if (newVal) setToAccountName(newVal.value as string);
            }}
            options={accountOptions}
            isSearchable={false}
          />
        )}
      </Flex>

      {chainMismatch && (
        <Text variant="body" color="error.c60">
          Chain mismatch: From is chainId {fromChainId}, To is chainId{" "}
          {toChainId}. Cross-chain Sends aren&apos;t supported — pick a matching
          target.
        </Text>
      )}

      <Flex columnGap={3} flexWrap="wrap" rowGap={3}>
        <Flex flexDirection="column" rowGap={1} flex="1 1 180px">
          <Input
            renderLeft={() => <InputLabel>Amount (ETH)</InputLabel>}
            value={amountEth}
            onChange={setAmountEth}
            disabled={status.kind === "running"}
            autoComplete="off"
          />
        </Flex>
        <Flex flexDirection="column" rowGap={1} flex="1 1 120px">
          <Input
            renderLeft={() => <InputLabel>Gas</InputLabel>}
            value={gasLimit}
            onChange={setGasLimit}
            disabled={status.kind === "running"}
            autoComplete="off"
          />
        </Flex>
        <Flex flexDirection="column" rowGap={1} flex="1 1 140px">
          <Input
            renderLeft={() => <InputLabel>Gas price (gwei)</InputLabel>}
            value={gasPriceGwei}
            onChange={setGasPriceGwei}
            disabled={status.kind === "running"}
            autoComplete="off"
          />
        </Flex>
        <Flex flexDirection="column" rowGap={1} flex="1 1 120px">
          <Input
            renderLeft={() => <InputLabel>Nonce</InputLabel>}
            value={nonce}
            onChange={setNonce}
            disabled={status.kind === "running"}
            autoComplete="off"
          />
        </Flex>
      </Flex>

      <Flex flexDirection="column" rowGap={2}>
        <Flex
          alignItems="center"
          columnGap={2}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          {advancedOpen ? (
            <Icons.ChevronDown size="S" />
          ) : (
            <Icons.ChevronRight size="S" />
          )}
          <Text variant="body" fontWeight="medium">
            Advanced
          </Text>
        </Flex>
        {advancedOpen && (
          <Flex flexDirection="column" rowGap={3} pl={5}>
            <Flex flexDirection="column" rowGap={1}>
              <Input
                renderLeft={() => <InputLabel>Data (hex)</InputLabel>}
                value={dataHex}
                onChange={setDataHex}
                disabled={status.kind === "running"}
                autoComplete="off"
              />
              {!dataBytesValid && (
                <Text variant="small" color="error.c60">
                  Data must be a valid hex string (0x-prefix optional, even
                  number of hex chars).
                </Text>
              )}
            </Flex>
            <Switch
              name="provideFrom"
              checked={provideFrom}
              onChange={() => setProvideFrom((prev) => !prev)}
              disabled={status.kind === "running"}
              label="Provide From — off → device review shows raw sender address."
            />
            <Switch
              name="provideTo"
              checked={provideTo}
              onChange={() => setProvideTo((prev) => !prev)}
              disabled={status.kind === "running"}
              label="Provide To — off → device review shows raw recipient address. A previously-Provided name may linger on device until the Eth app closes."
            />
          </Flex>
        )}
      </Flex>

      <Flex columnGap={3} alignItems="center">
        <Button
          variant="main"
          onClick={() => void handleSubmit()}
          disabled={submitDisabled}
        >
          Send &amp; sign
        </Button>
        {status.kind === "running" && (
          <Text variant="body" color="opacityDefault.c60">
            Awaiting device approval…
          </Text>
        )}
      </Flex>

      {trace.length > 0 && (
        <Flex flexDirection="column" rowGap={1}>
          {trace.map((line, i) => (
            <TraceRow key={i} $tone={line.kind}>
              {line.text}
            </TraceRow>
          ))}
        </Flex>
      )}

      {status.kind === "error" && (
        <Text variant="body" color="error.c60">
          {status.message}
        </Text>
      )}

      {result && (
        <Flex flexDirection="column" rowGap={2}>
          <Text variant="body" fontWeight="medium" color="success.c60">
            Signed.
          </Text>
          <ResultGrid>
            <ResultLabel>Provided From:</ResultLabel>
            <ResultValue>
              {result.providedFrom ? `✓ ${result.providedFrom}` : "skipped"}
            </ResultValue>
            <span />
            <ResultLabel>Provided To:</ResultLabel>
            <ResultValue>
              {result.providedTo ? `✓ ${result.providedTo}` : "skipped"}
            </ResultValue>
            <span />
            <ResultLabel>Signed:</ResultLabel>
            <ResultValue>✓</ResultValue>
            <span />
            <ResultLabel>v:</ResultLabel>
            <ResultValue>{result.v}</ResultValue>
            <CopyButton value={String(result.v)} />
            <ResultLabel>r:</ResultLabel>
            <ResultValue>{result.r}</ResultValue>
            <CopyButton value={result.r} />
            <ResultLabel>s:</ResultLabel>
            <ResultValue>{result.s}</ResultValue>
            <CopyButton value={result.s} />
          </ResultGrid>
        </Flex>
      )}
    </Flex>
  );
};

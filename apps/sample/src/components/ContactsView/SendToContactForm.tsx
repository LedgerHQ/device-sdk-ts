import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
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
  Input,
  Link,
  SelectInput,
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
import { NETWORK_OPTIONS, type NetworkName, NETWORKS } from "./networks";

// Tx-shape defaults mirror the playground CLI (`cli.py:710-715`). gas=21000
// is the minimum legal value for a value-transfer; gwei=30 is the CLI's
// hardcoded default. The transaction is never broadcast — value is cosmetic,
// kept aligned to avoid reviewer confusion against playground traces.
const DEFAULT_GAS_LIMIT = 21000;
const DEFAULT_GAS_PRICE_GWEI = 30;
const DEFAULT_NONCE = 0;

// When the user leaves the From field blank, sign with the Ledger Live
// default path. No Provide From APDU fires; the device review shows the
// raw derived address with no friendly name. Matches the CLI's
// `--no-provide-from` behaviour at `service.py:965-968`.
const NO_FROM_VALUE = "__no_decoration__";
const DEFAULT_FROM_PATH = "m/44'/60'/0'/0/0";

type ToKind = "hex" | "contact" | "self";

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

// Flat (contact, entry) rows so the user picks an entry directly without
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

// Build the unsigned RLP-encoded legacy transaction. Legacy (type=0), not
// EIP-1559 — matches the playground's `_build_eth_tx_params`
// (`service.py:865-906`).
function buildLegacyTxBytes(args: {
  toAddressHex: string;
  amountWei: bigint;
  gasLimit: number;
  gasPriceWei: bigint;
  nonce: number;
  chainId: number;
}): Uint8Array {
  const toHex = args.toAddressHex.startsWith("0x")
    ? args.toAddressHex
    : `0x${args.toAddressHex}`;
  const tx = ethers.Transaction.from({
    type: 0,
    to: toHex,
    value: args.amountWei,
    gasLimit: args.gasLimit,
    gasPrice: args.gasPriceWei,
    nonce: args.nonce,
    chainId: args.chainId,
    data: "0x",
  });
  const buf = hexaStringToBuffer(tx.unsignedSerialized);
  if (!buf) throw new Error("Failed to serialize legacy transaction.");
  return buf;
}

function normalizeAddressHex(value: string): string {
  const trimmed = value.trim();
  const raw =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed.slice(2)
      : trimmed;
  return raw.toLowerCase();
}

function isValidEthAddressHex(value: string): boolean {
  const raw = normalizeAddressHex(value);
  return raw.length === 40 && /^[0-9a-f]{40}$/.test(raw);
}

// `signer.signTransaction` flows the derivationPath straight into
// `GetAddressCommand` (via `SignTransactionDeviceAction.GetAddress`), whose
// `getApdu()` calls `DerivationPathUtils.splitPath` — and splitPath chokes
// on the "m/" prefix because `parseInt("m") === NaN`. Other signer-eth use
// cases (RegisterExternalAddress, EditExternalAddress, RegisterLedgerAccount)
// strip the prefix in their use-case layer, but `SignTransactionUseCase`
// does not — so callers must strip it themselves. Stored
// `account.derivationPath` carries the "m/" prefix (see M6
// `RegisterLedgerAccountForm.buildLedgerLivePath`), so we strip here.
function stripMPrefix(path: string): string {
  if (path.startsWith("m/") || path.startsWith("M/")) return path.slice(2);
  return path;
}

type ProgressState = {
  status: DeviceActionStatus;
  intermediateValue?: {
    step?: unknown;
    requiredUserInteraction?: unknown;
  };
};

// Subscribe to a device-action observable and resolve when it reaches a
// terminal status (Completed or Error). `onPending` fires for every
// intermediate emission so the caller can surface step / interaction
// progress in the trace.
function awaitDeviceAction<TOutput>(
  observable: Observable<
    ProgressState & {
      output?: TOutput;
      error?: unknown;
    }
  >,
  onPending: (state: ProgressState) => void,
): Promise<TOutput> {
  return new Promise<TOutput>((resolve, reject) => {
    observable.subscribe({
      next: (state) => {
        if (state.status === DeviceActionStatus.Completed) {
          resolve(state.output as TOutput);
        } else if (state.status === DeviceActionStatus.Error) {
          reject(state.error);
        } else {
          onPending(state);
        }
      },
      error: (err) => reject(err),
    });
  });
}

// Diagnostic: walk an arbitrary error-shaped value into a JSON-safe form
// so it lands legibly in the form's trace block. Captures the constructor
// name, message, and all own-enumerable properties (skipping `stack` and
// functions). Handles circular refs and caps recursion depth. Used to
// surface DMK error shapes that `describeDeviceError` can't unwrap (i.e.
// when it falls back to the generic "Device action failed").
function debugError(error: unknown): string {
  if (error === null || error === undefined) return "(no error object)";
  const seen = new WeakSet<object>();
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 4) return "[max depth]";
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value as object)) return "[circular]";
    seen.add(value as object);
    const cls =
      (value as { constructor?: { name?: string } }).constructor?.name ??
      "Object";
    const result: Record<string, unknown> = { __class: cls };
    if (value instanceof Error && value.message) {
      result.message = value.message;
    }
    for (const key of Object.getOwnPropertyNames(value)) {
      if (key === "stack" || key === "constructor") continue;
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === "function") continue;
      result[key] = walk(v, depth + 1);
    }
    return result;
  };
  try {
    return JSON.stringify(walk(error, 0), null, 2);
  } catch {
    return String(error);
  }
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

  const [fromAccountName, setFromAccountName] = useState<string>(
    () => accountList[0]?.name ?? NO_FROM_VALUE,
  );
  const [toKind, setToKind] = useState<ToKind>(
    contactEntryList.length > 0 ? "contact" : "hex",
  );
  const [toContactEntryKey, setToContactEntryKey] = useState<string | null>(
    () => {
      const first = contactEntryList[0];
      return first ? `${first.contact.name}#${first.entryIndex}` : null;
    },
  );
  const [toSelfAccountName, setToSelfAccountName] = useState<string | null>(
    () => accountList[0]?.name ?? null,
  );
  const [toHexAddress, setToHexAddress] = useState("");
  const [toHexNetwork, setToHexNetwork] = useState<NetworkName>("ethereum");

  const [amountEth, setAmountEth] = useState("0.01");
  const [gasLimit, setGasLimit] = useState(String(DEFAULT_GAS_LIMIT));
  const [gasPriceGwei, setGasPriceGwei] = useState(
    String(DEFAULT_GAS_PRICE_GWEI),
  );
  const [nonce, setNonce] = useState(String(DEFAULT_NONCE));

  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [result, setResult] = useState<SignResult | null>(null);

  const fromAccount =
    fromAccountName !== NO_FROM_VALUE
      ? (wallet.accounts[fromAccountName] ?? null)
      : null;
  const toContactEntry =
    toKind === "contact" && toContactEntryKey
      ? (contactEntryList.find(
          (ref) =>
            `${ref.contact.name}#${ref.entryIndex}` === toContactEntryKey,
        ) ?? null)
      : null;
  const toSelfAccount =
    toKind === "self" && toSelfAccountName
      ? (wallet.accounts[toSelfAccountName] ?? null)
      : null;

  // Recipient address resolved from the active To kind. null = not yet valid.
  const recipientAddressHex: string | null = useMemo(() => {
    if (toKind === "contact") {
      return toContactEntry?.entry.addressHex ?? null;
    }
    if (toKind === "self") {
      return toSelfAccount?.addressHex ?? null;
    }
    return isValidEthAddressHex(toHexAddress)
      ? normalizeAddressHex(toHexAddress)
      : null;
  }, [toKind, toContactEntry, toSelfAccount, toHexAddress]);

  const recipientChainId: number | null = useMemo(() => {
    if (toKind === "contact") return toContactEntry?.entry.chainId ?? null;
    if (toKind === "self") return toSelfAccount?.chainId ?? null;
    return NETWORKS[toHexNetwork];
  }, [toKind, toContactEntry, toSelfAccount, toHexNetwork]);

  // Hard-block cross-chain Sends only when the user *picked* a From account;
  // a blank From means "no decoration, default path", so chainId is taken
  // unilaterally from the recipient side.
  const chainMismatch =
    fromAccount !== null &&
    recipientChainId !== null &&
    fromAccount.chainId !== recipientChainId;

  // Self-transfer is "between any two accounts you own" — sender and
  // recipient may be the same account or different ones. Disabled only
  // when no Ledger accounts are registered.
  const selfTransferDisabled = accountList.length === 0;

  const submitDisabled =
    !signer ||
    recipientAddressHex === null ||
    recipientChainId === null ||
    (toKind === "self" && selfTransferDisabled) ||
    chainMismatch ||
    status.kind === "running";

  // From options: sentinel "(none)" entry always at the top, then each
  // registered account with just its name as the label.
  const fromOptions = useMemo(
    () => [
      {
        label: "(No decoration — device shows raw sender)",
        value: NO_FROM_VALUE,
      },
      ...accountList.map((acc) => ({ label: acc.name, value: acc.name })),
    ],
    [accountList],
  );

  // Plain account dropdown options (for the Self-transfer recipient).
  // Label = account name only.
  const accountOptions = useMemo(
    () => accountList.map((acc) => ({ label: acc.name, value: acc.name })),
    [accountList],
  );

  // Contact-entry options labelled as "<contact name> / <address label>".
  const contactEntryOptions = useMemo(
    () =>
      contactEntryList.map((ref) => ({
        label: `${ref.contact.name} / ${ref.entry.scope}`,
        value: `${ref.contact.name}#${ref.entryIndex}`,
      })),
    [contactEntryList],
  );

  const appendTrace = useCallback((line: TraceLine) => {
    setTrace((prev) => [...prev, line]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!signer) return;
    if (recipientAddressHex === null) return;
    if (recipientChainId === null) return;
    if (toKind === "self" && (selfTransferDisabled || toSelfAccount === null))
      return;
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

    setTrace([]);
    setResult(null);
    setStatus({ kind: "running" });

    let providedFromName: string | null = null;
    let providedToName: string | null = null;

    try {
      // Provide From: fires whenever the user picked a real account.
      // Blank From → no decoration, signed with the default Ledger Live
      // path. Matches CLI semantics at service.py:965-968.
      if (fromAccount !== null) {
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
        // Sticky state-rotation: dispatch on each 0x9000 ack, not only
        // after Sign. Matches service.py:942-952.
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

      // Provide To: branches on the active To kind.
      //   contact     → provideContact (CLA=0xb0 P1=0x20)
      //   self        → provideLedgerAccount on the From account
      //   hex address → no Provide; device review shows raw recipient hex
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
      } else if (toKind === "self" && toSelfAccount !== null) {
        appendTrace({ kind: "info", text: "→ Provide To sent…" });
        const { observable } = signer.provideLedgerAccount({
          accountName: toSelfAccount.name,
          hmacProofHex: toSelfAccount.hmacProofHex,
          derivationPath: toSelfAccount.derivationPath,
          chainId: toSelfAccount.chainId,
        });
        await awaitDeviceAction(observable, () => {});
        providedToName = toSelfAccount.name;
        appendTrace({
          kind: "ok",
          text: `  0x9000 ✓ Provided "${toSelfAccount.name}"`,
        });
        // If toSelfAccount === fromAccount the dispatch is a redundant
        // identity update (Redux state unchanged), so guarding here would
        // be premature optimisation. Idempotent on device too.
        dispatch(
          setWallet(
            rotateAccountLastResponse(
              wallet,
              toSelfAccount.name,
              ResponseType.ProvideLedgerAccountContact,
            ),
          ),
        );
      }

      const txBytes = buildLegacyTxBytes({
        toAddressHex: recipientAddressHex,
        amountWei: amount,
        gasLimit: gasLimitNum,
        gasPriceWei,
        nonce: nonceNum,
        chainId: recipientChainId,
      });

      appendTrace({
        kind: "info",
        text: "→ Sign sent — awaiting approval on device…",
      });

      // Let signTransaction run its own OpenApp. We previously tried
      // `skipOpenApp: true` here as a latency optimisation when the
      // Provides had already opened the ETH app, but hardware smoke
      // (apex_p, 2026-05-11) failed with a generic "Device action
      // failed" after both Provides landed cleanly — the SignTransaction
      // state machine evidently relies on something OpenApp does on the
      // way through (not just the "is the app open?" guard). OpenApp is
      // idempotent when the app is already open
      // (OpenAppDeviceAction.ts:296 short-circuits), so the cost is one
      // device round-trip — well worth the correctness.
      const signingPath = stripMPrefix(
        fromAccount?.derivationPath ?? DEFAULT_FROM_PATH,
      );
      // Diagnostic: log the unsigned tx bytes so we can confirm the RLP
      // we're handing the device parses as we expect.
      appendTrace({
        kind: "info",
        text: `    tx (hex, ${txBytes.length} B): ${Buffer.from(txBytes).toString("hex")}`,
      });
      appendTrace({
        kind: "info",
        text: `    signing path: ${signingPath}`,
      });
      const { observable } = signer.signTransaction(signingPath, txBytes, {});
      // Diagnostic: track which SignTransactionDeviceAction sub-step is
      // running. Each intermediate emission tells us the current state in
      // the OpenApp → GetAppConfig → ParseTransaction → GetAddress →
      // BuildContexts → ProvideContexts → SignTransaction ladder. If the
      // observable errors before resolving, the last-seen step tells us
      // where SignTransactionDeviceAction was when it died.
      let lastSignStep: unknown = undefined;
      let lastInteraction: unknown = undefined;
      const signature: Signature = await awaitDeviceAction(observable, (s) => {
        const step = s.intermediateValue?.step;
        if (step !== undefined && step !== lastSignStep) {
          lastSignStep = step;
          appendTrace({ kind: "info", text: `    step: ${String(step)}` });
        }
        const interaction = s.intermediateValue?.requiredUserInteraction;
        if (interaction !== undefined && interaction !== lastInteraction) {
          lastInteraction = interaction;
          appendTrace({
            kind: "info",
            text: `    requiredUserInteraction: ${String(interaction)}`,
          });
        }
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
      // Diagnostic: dump the raw error structure into the trace so we can
      // see what kind of failure this is when describeDeviceError falls
      // back to the generic message (no SW / no `errorCode` / no
      // `originalError` it knows how to unwrap).
      appendTrace({
        kind: "error",
        text: `    raw error:\n${debugError(err)}`,
      });
      setStatus({ kind: "error", message: describeDeviceError(err) });
    }
  }, [
    signer,
    fromAccount,
    toKind,
    toContactEntry,
    toSelfAccount,
    recipientAddressHex,
    recipientChainId,
    chainMismatch,
    selfTransferDisabled,
    amountEth,
    gasLimit,
    gasPriceGwei,
    nonce,
    wallet,
    dispatch,
    appendTrace,
  ]);

  return (
    <Flex flexDirection="column" rowGap={4}>
      <Text variant="paragraph" color="opacityDefault.c60">
        Compose an ETH transfer. Up to three APDUs run in order — Provide From,
        Provide To, Sign — but the device only prompts once (Sign). The two
        Provides return 0x9000 silently because firmware trusts the HMAC chain
        authorised at Register time. The Sign review shows the friendly names
        you provided.
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
          isDisabled={status.kind === "running"}
          value={
            fromOptions.find((opt) => opt.value === fromAccountName) ?? null
          }
          isMulti={false}
          onChange={(newVal) => {
            if (newVal) setFromAccountName(newVal.value as string);
          }}
          options={fromOptions}
          isSearchable={false}
        />
        {fromAccount === null && (
          <Text variant="small" color="opacityDefault.c50">
            Signing with default path {DEFAULT_FROM_PATH}. No friendly name for
            the sender on the device review.
          </Text>
        )}
        {accountList.length === 0 && (
          <Text variant="small" color="opacityDefault.c50">
            <Link
              onClick={() => router.push("/services/contacts/ledger-accounts")}
            >
              Register a Ledger account
            </Link>{" "}
            to provide a friendly From name.
          </Text>
        )}
      </Flex>

      <Flex flexDirection="column" rowGap={1}>
        <Flex columnGap={2} alignItems="center" flexWrap="wrap">
          <InputLabel ml={0}>To</InputLabel>
          <Tag
            type={toKind === "hex" ? "plain" : "outlinedOpacity"}
            active={toKind === "hex"}
            onClick={() =>
              status.kind === "running" ? undefined : setToKind("hex")
            }
            style={{
              cursor: status.kind === "running" ? "not-allowed" : "pointer",
            }}
          >
            Hex address
          </Tag>
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
            Contact
          </Tag>
          <Tag
            type={toKind === "self" ? "plain" : "outlinedOpacity"}
            active={toKind === "self"}
            onClick={() => {
              if (status.kind === "running" || selfTransferDisabled) return;
              setToKind("self");
            }}
            style={{
              cursor:
                status.kind === "running" || selfTransferDisabled
                  ? "not-allowed"
                  : "pointer",
              opacity: selfTransferDisabled ? 0.5 : 1,
            }}
          >
            Self-transfer
          </Tag>
        </Flex>

        {toKind === "hex" && (
          <Flex flexDirection="column" rowGap={2}>
            <Flex flexDirection="column" rowGap={1}>
              <Input
                renderLeft={() => <InputLabel>Address (0x…)</InputLabel>}
                value={toHexAddress}
                onChange={setToHexAddress}
                disabled={status.kind === "running"}
                autoComplete="off"
              />
              {toHexAddress.trim().length > 0 &&
                !isValidEthAddressHex(toHexAddress) && (
                  <Text variant="small" color="error.c60">
                    Enter a 20-byte hex address (40 hex chars, 0x-prefix
                    optional).
                  </Text>
                )}
            </Flex>
            <SelectInput
              renderLeft={() => <SelectInputLabel>Network</SelectInputLabel>}
              isDisabled={status.kind === "running"}
              value={
                NETWORK_OPTIONS.find((opt) => opt.value === toHexNetwork) ??
                null
              }
              isMulti={false}
              onChange={(newVal) => {
                if (newVal) setToHexNetwork(newVal.value as NetworkName);
              }}
              options={NETWORK_OPTIONS}
              isSearchable={false}
            />
          </Flex>
        )}

        {toKind === "contact" &&
          (contactEntryList.length === 0 ? (
            <Text variant="small" color="warning.c60">
              No contacts registered.{" "}
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
              renderLeft={() => <SelectInputLabel>Contact</SelectInputLabel>}
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
          ))}

        {toKind === "self" &&
          (selfTransferDisabled ? (
            <Text variant="small" color="warning.c60">
              No Ledger accounts registered.{" "}
              <Link
                onClick={() =>
                  router.push("/services/contacts/ledger-accounts")
                }
              >
                Register one first.
              </Link>
            </Text>
          ) : (
            <Flex flexDirection="column" rowGap={1}>
              <SelectInput
                renderLeft={() => (
                  <SelectInputLabel>To account</SelectInputLabel>
                )}
                isDisabled={status.kind === "running"}
                value={
                  toSelfAccountName
                    ? (accountOptions.find(
                        (opt) => opt.value === toSelfAccountName,
                      ) ?? null)
                    : null
                }
                isMulti={false}
                onChange={(newVal) => {
                  if (newVal) setToSelfAccountName(newVal.value as string);
                }}
                options={accountOptions}
                isSearchable={false}
              />
              {toSelfAccount?.addressHex && (
                <Text variant="small" color="opacityDefault.c50">
                  {formatShortAddress(toSelfAccount.addressHex)}
                </Text>
              )}
            </Flex>
          ))}
      </Flex>

      {chainMismatch && (
        <Text variant="body" color="error.c60">
          Chain mismatch: From is chainId {fromAccount?.chainId}, To is chainId{" "}
          {recipientChainId}. Cross-chain Sends aren&apos;t supported — pick a
          matching target.
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

      <Flex columnGap={3} alignItems="center">
        <Button
          variant="main"
          onClick={() => void handleSubmit()}
          disabled={submitDisabled}
        >
          Send
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

import React, { useCallback, useMemo, useRef } from "react";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigDAError,
  type GetAppConfigDAIntermediateValue,
  type GetAppConfigDAOutput,
  type GetFullViewingKeyDAError,
  type GetFullViewingKeyDAIntermediateValue,
  type GetFullViewingKeyDAOutput,
  type GetTrustedInputDAError,
  type GetTrustedInputDAIntermediateValue,
  type GetTrustedInputDAOutput,
  type LegacyCreateTransactionArg,
  type LegacyTransaction,
  type PcztBip32Derivation,
  type PcztGlobal,
  type PcztOrchardAction,
  type PcztOrchardBundle,
  type PcztTransaction,
  type PcztTransparentInput,
  type PcztTransparentOutput,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  type SignPcztTransactionDAError,
  type SignPcztTransactionDAIntermediateValue,
  type SignPcztTransactionDAOutput,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
  type ZcashFullViewingKeyMode,
} from "@ledgerhq/device-signer-kit-zcash";
import { Flex } from "@ledgerhq/react-ui";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { type ValueSelector } from "@/components/Form";
import { Form } from "@/components/Form";
import { InputHeader } from "@/components/InputHeader";
import { ResizableTextArea } from "@/components/ResizableTextArea";
import { type FieldType } from "@/hooks/useForm";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSignerZcash } from "@/providers/SignerZcashProvider";

const fullViewingKeyModeOptions: ValueSelector<FieldType>["mode"] = [
  { label: "UFVK (string, P2=0x00)", value: "ufvk" },
  { label: "Orchard FVK (96 raw bytes, P2=0x01)", value: "orchardFvk" },
];

const normalizeHex = (value: string): string =>
  value.replace(/^0x/i, "").replace(/\s+/g, "");

const parseHexBytes = (value: string, fieldName: string): Uint8Array => {
  const normalized = normalizeHex(value);
  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  const parsed = hexaStringToBuffer(normalized);
  if (!parsed) {
    throw new Error(`Invalid hex value for ${fieldName}`);
  }
  return parsed;
};

const parseOptionalHexBytes = (value: string): Uint8Array | undefined => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    return undefined;
  }
  return parseHexBytes(normalized, "optional hex");
};

const parsePreviousTransaction = (value: string): LegacyTransaction => {
  try {
    const parsed = JSON.parse(value) as {
      version: string;
      inputs: Array<{
        prevout: string;
        script: string;
        sequence: string;
        tree?: string;
      }>;
      outputs?: Array<{ amount: string; script: string }>;
      locktime?: string;
      timestamp?: string;
      nVersionGroupId?: string;
      nExpiryHeight?: string;
      extraData?: string;
      consensusBranchId?: string;
      /** Full Zcash v5 wire hex for GET_TRUSTED_INPUT (same as Ledger `splitTransaction.transactionHex`). */
      serializedPreviousTransactionOverrideHex?: string;
    };

    const serializedPreviousTransactionOverride =
      parsed.serializedPreviousTransactionOverrideHex &&
      normalizeHex(parsed.serializedPreviousTransactionOverrideHex).length > 0
        ? parseHexBytes(
            parsed.serializedPreviousTransactionOverrideHex,
            "previousTx.serializedPreviousTransactionOverrideHex",
          )
        : undefined;

    return {
      version: parseHexBytes(parsed.version, "previousTx.version"),
      inputs: parsed.inputs.map((input, inputIndex) => ({
        prevout: parseHexBytes(
          input.prevout,
          `previousTx.inputs[${inputIndex}].prevout`,
        ),
        script: parseOptionalHexBytes(input.script) ?? new Uint8Array(),
        sequence: parseHexBytes(
          input.sequence,
          `previousTx.inputs[${inputIndex}].sequence`,
        ),
        tree: parseOptionalHexBytes(input.tree ?? ""),
      })),
      outputs: parsed.outputs?.map((output, outputIndex) => ({
        amount: parseHexBytes(
          output.amount,
          `previousTx.outputs[${outputIndex}].amount`,
        ),
        script: parseHexBytes(
          output.script,
          `previousTx.outputs[${outputIndex}].script`,
        ),
      })),
      locktime: parseOptionalHexBytes(parsed.locktime ?? ""),
      timestamp: parseOptionalHexBytes(parsed.timestamp ?? ""),
      nVersionGroupId: parseOptionalHexBytes(parsed.nVersionGroupId ?? ""),
      nExpiryHeight: parseOptionalHexBytes(parsed.nExpiryHeight ?? ""),
      extraData: parseOptionalHexBytes(parsed.extraData ?? ""),
      consensusBranchId: parseOptionalHexBytes(parsed.consensusBranchId ?? ""),
      ...(serializedPreviousTransactionOverride
        ? { serializedPreviousTransactionOverride }
        : {}),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid previous transaction JSON: ${error.message}`);
    }
    throw new Error("Invalid previous transaction JSON");
  }
};

type SignTransactionInput = {
  associatedKeysetsCsv: string;
  outputScriptHex: string;
  changePath: string;
  additionalsCsv: string;
  lockTime: number;
  blockHeight: number;
  sigHashType: number;
  useExpiryHeight: boolean;
  expiryHeightHex: string;
  skipOpenApp: boolean;
  input1Enabled: boolean;
  input1PreviousTxJson: string;
  input1OutputIndex: number;
  input1ScriptHex: string;
  input1Sequence: number;
  input1UseBranchHeight: boolean;
  input1BranchHeight: number;
  input1SerializedPreviousTxOverrideHex: string;
  input2Enabled: boolean;
  input2PreviousTxJson: string;
  input2OutputIndex: number;
  input2ScriptHex: string;
  input2Sequence: number;
  input2UseBranchHeight: boolean;
  input2BranchHeight: number;
  input2SerializedPreviousTxOverrideHex: string;
  input3Enabled: boolean;
  input3PreviousTxJson: string;
  input3OutputIndex: number;
  input3ScriptHex: string;
  input3Sequence: number;
  input3UseBranchHeight: boolean;
  input3BranchHeight: number;
  input3SerializedPreviousTxOverrideHex: string;
};

const SIGN_TX_FORM_KEYS: (keyof SignTransactionInput)[] = [
  "associatedKeysetsCsv",
  "outputScriptHex",
  "changePath",
  "additionalsCsv",
  "lockTime",
  "blockHeight",
  "sigHashType",
  "useExpiryHeight",
  "expiryHeightHex",
  "skipOpenApp",
  "input1Enabled",
  "input1OutputIndex",
  "input1ScriptHex",
  "input1Sequence",
  "input1UseBranchHeight",
  "input1BranchHeight",
  "input2Enabled",
  "input2OutputIndex",
  "input2ScriptHex",
  "input2Sequence",
  "input2UseBranchHeight",
  "input2BranchHeight",
  "input3Enabled",
  "input3OutputIndex",
  "input3ScriptHex",
  "input3Sequence",
  "input3UseBranchHeight",
  "input3BranchHeight",
];

const sampleSignTransactionFormInitialValues: SignTransactionInput = {
  associatedKeysetsCsv: "",
  outputScriptHex: "",
  changePath: "",
  additionalsCsv: "",
  lockTime: 0,
  blockHeight: 0,
  sigHashType: 0,
  useExpiryHeight: false,
  expiryHeightHex: "",
  skipOpenApp: false,
  input1Enabled: false,
  input1PreviousTxJson: "",
  input1OutputIndex: 0,
  input1ScriptHex: "",
  input1Sequence: 0,
  input1UseBranchHeight: false,
  input1BranchHeight: 0,
  input1SerializedPreviousTxOverrideHex: "",
  input2Enabled: false,
  input2PreviousTxJson: "",
  input2OutputIndex: 0,
  input2ScriptHex: "",
  input2Sequence: 0,
  input2UseBranchHeight: false,
  input2BranchHeight: 0,
  input2SerializedPreviousTxOverrideHex: "",
  input3Enabled: false,
  input3PreviousTxJson: "",
  input3OutputIndex: 0,
  input3ScriptHex: "",
  input3Sequence: 0,
  input3UseBranchHeight: false,
  input3BranchHeight: 0,
  input3SerializedPreviousTxOverrideHex: "",
};

const SignTransactionForm = ({
  initialValues,
  onChange,
  disabled,
}: {
  initialValues: SignTransactionInput;
  onChange: (values: SignTransactionInput) => void;
  disabled?: boolean;
}) => {
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  const formValues = Object.fromEntries(
    SIGN_TX_FORM_KEYS.map((key) => [key, initialValues[key]]),
  ) as Pick<SignTransactionInput, (typeof SIGN_TX_FORM_KEYS)[number]>;

  const handleFormChange = useCallback(
    (values: typeof formValues) =>
      onChange({
        ...initialValuesRef.current,
        ...values,
      }),
    [onChange],
  );

  const handlePreviousTxChange = useCallback(
    (
      key:
        | "input1PreviousTxJson"
        | "input2PreviousTxJson"
        | "input3PreviousTxJson",
      value: string,
    ) =>
      onChange({
        ...initialValuesRef.current,
        [key]: value,
      }),
    [onChange],
  );

  const handleSerializedOverrideChange = useCallback(
    (
      key:
        | "input1SerializedPreviousTxOverrideHex"
        | "input2SerializedPreviousTxOverrideHex"
        | "input3SerializedPreviousTxOverrideHex",
      value: string,
    ) =>
      onChange({
        ...initialValuesRef.current,
        [key]: value,
      }),
    [onChange],
  );

  return (
    <Flex flexDirection="column" rowGap={5}>
      <Form
        initialValues={formValues}
        onChange={handleFormChange}
        disabled={disabled}
      />

      {initialValues.input1Enabled && (
        <Flex flexDirection="column" rowGap={2}>
          <InputHeader hint='JSON of the source transaction. Required fields: "version", "inputs". Hex-encode all byte fields. You may add "serializedPreviousTransactionOverrideHex" instead of using the separate raw hex field below.'>
            Trusted input #1 previous transaction
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input1PreviousTxJson}
            onChange={(value) =>
              handlePreviousTxChange("input1PreviousTxJson", value)
            }
            initialHeight={180}
            disabled={disabled}
          />
          <InputHeader hint="Optional. Full Zcash v5 previous-transaction hex for GET_TRUSTED_INPUT (Ledger Wallet splitTransaction.transactionHex). Overrides transparent-only serialization when non-empty.">
            Trusted input #1 raw previous tx hex (optional)
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input1SerializedPreviousTxOverrideHex}
            onChange={(value) =>
              handleSerializedOverrideChange(
                "input1SerializedPreviousTxOverrideHex",
                value,
              )
            }
            initialHeight={72}
            disabled={disabled}
          />
        </Flex>
      )}

      {initialValues.input2Enabled && (
        <Flex flexDirection="column" rowGap={2}>
          <InputHeader hint='JSON of the source transaction. Required fields: "version", "inputs". Hex-encode all byte fields. You may add "serializedPreviousTransactionOverrideHex" instead of using the separate raw hex field below.'>
            Trusted input #2 previous transaction
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input2PreviousTxJson}
            onChange={(value) =>
              handlePreviousTxChange("input2PreviousTxJson", value)
            }
            initialHeight={180}
            disabled={disabled}
          />
          <InputHeader hint="Optional. Full Zcash v5 previous-transaction hex for GET_TRUSTED_INPUT (Ledger Wallet splitTransaction.transactionHex). Required when the previous tx includes Sapling/Orchard data not described in the JSON above.">
            Trusted input #2 raw previous tx hex (optional)
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input2SerializedPreviousTxOverrideHex}
            onChange={(value) =>
              handleSerializedOverrideChange(
                "input2SerializedPreviousTxOverrideHex",
                value,
              )
            }
            initialHeight={120}
            disabled={disabled}
          />
        </Flex>
      )}

      {initialValues.input3Enabled && (
        <Flex flexDirection="column" rowGap={2}>
          <InputHeader hint='JSON of the source transaction. Required fields: "version", "inputs". Hex-encode all byte fields. You may add "serializedPreviousTransactionOverrideHex" instead of using the separate raw hex field below.'>
            Trusted input #3 previous transaction
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input3PreviousTxJson}
            onChange={(value) =>
              handlePreviousTxChange("input3PreviousTxJson", value)
            }
            initialHeight={180}
            disabled={disabled}
          />
          <InputHeader hint="Optional. Full Zcash v5 previous-transaction hex for GET_TRUSTED_INPUT (Ledger Wallet splitTransaction.transactionHex).">
            Trusted input #3 raw previous tx hex (optional)
          </InputHeader>
          <ResizableTextArea
            value={initialValues.input3SerializedPreviousTxOverrideHex}
            onChange={(value) =>
              handleSerializedOverrideChange(
                "input3SerializedPreviousTxOverrideHex",
                value,
              )
            }
            initialHeight={72}
            disabled={disabled}
          />
        </Flex>
      )}
    </Flex>
  );
};

const buildSignTransactionArg = (
  values: SignTransactionInput,
): LegacyCreateTransactionArg => {
  const inputs: LegacyCreateTransactionArg["inputs"] = [];
  const addInput = ({
    previousTxJson,
    serializedPreviousTxOverrideHex,
    outputIndex,
    scriptHexRaw,
    sequence,
    useBranchHeight,
    branchHeight,
  }: {
    previousTxJson: string;
    serializedPreviousTxOverrideHex: string;
    outputIndex: number;
    scriptHexRaw: string;
    sequence: number;
    useBranchHeight: boolean;
    branchHeight: number;
  }): void => {
    let previousTx = parsePreviousTransaction(previousTxJson);
    const overrideHex = normalizeHex(serializedPreviousTxOverrideHex.trim());
    if (overrideHex.length > 0) {
      previousTx = {
        ...previousTx,
        serializedPreviousTransactionOverride: parseHexBytes(
          overrideHex,
          "serializedPreviousTxOverrideHex",
        ),
      };
    }
    const inputTuple: LegacyCreateTransactionArg["inputs"][number] = [
      previousTx,
      Number(outputIndex),
      scriptHexRaw ? normalizeHex(scriptHexRaw) : undefined,
      Number(sequence),
      useBranchHeight ? Number(branchHeight) : undefined,
    ];
    inputs.push(inputTuple);
  };

  if (values.input1Enabled) {
    addInput({
      previousTxJson: values.input1PreviousTxJson,
      serializedPreviousTxOverrideHex:
        values.input1SerializedPreviousTxOverrideHex,
      outputIndex: values.input1OutputIndex,
      scriptHexRaw: values.input1ScriptHex.trim(),
      sequence: values.input1Sequence,
      useBranchHeight: values.input1UseBranchHeight,
      branchHeight: values.input1BranchHeight,
    });
  }
  if (values.input2Enabled) {
    addInput({
      previousTxJson: values.input2PreviousTxJson,
      serializedPreviousTxOverrideHex:
        values.input2SerializedPreviousTxOverrideHex,
      outputIndex: values.input2OutputIndex,
      scriptHexRaw: values.input2ScriptHex.trim(),
      sequence: values.input2Sequence,
      useBranchHeight: values.input2UseBranchHeight,
      branchHeight: values.input2BranchHeight,
    });
  }
  if (values.input3Enabled) {
    addInput({
      previousTxJson: values.input3PreviousTxJson,
      serializedPreviousTxOverrideHex:
        values.input3SerializedPreviousTxOverrideHex,
      outputIndex: values.input3OutputIndex,
      scriptHexRaw: values.input3ScriptHex.trim(),
      sequence: values.input3Sequence,
      useBranchHeight: values.input3UseBranchHeight,
      branchHeight: values.input3BranchHeight,
    });
  }
  if (inputs.length === 0) {
    throw new Error("At least one trusted input must be enabled");
  }

  const associatedKeysets = values.associatedKeysetsCsv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (associatedKeysets.length === 0) {
    throw new Error("At least one associated keyset is required");
  }
  const normalizedAssociatedKeysets =
    associatedKeysets.length === 1 && inputs.length > 1
      ? Array.from({ length: inputs.length }, () => associatedKeysets[0]!)
      : associatedKeysets;
  if (normalizedAssociatedKeysets.length !== inputs.length) {
    throw new Error(
      "associatedKeysetsCsv must provide one keyset per enabled input (or exactly one keyset to reuse)",
    );
  }

  const additionals = values.additionalsCsv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (additionals.length === 0) {
    throw new Error("At least one additional is required (for example: zcash)");
  }

  return {
    inputs,
    associatedKeysets: normalizedAssociatedKeysets,
    changePath: values.changePath.trim() ? values.changePath.trim() : undefined,
    outputScriptHex: normalizeHex(values.outputScriptHex),
    lockTime: Number(values.lockTime),
    blockHeight: Number(values.blockHeight),
    sigHashType: Number(values.sigHashType),
    additionals,
    expiryHeight: values.useExpiryHeight
      ? parseHexBytes(values.expiryHeightHex, "expiryHeightHex")
      : undefined,
  };
};

// --- PCZT (Orchard shielded) signing ---------------------------------------

type SignPcztInput = {
  pcztJson: string;
  skipOpenApp: boolean;
};

const fillHex = (length: number, fill: number): string =>
  fill.toString(16).padStart(2, "0").repeat(length);

/**
 * Default PCZT payload: the real Orchard→transparent vector from app-zcash
 * `tests/standalone/test_pczt.py::test_pczt_sign_tx_v5_orchard_to_transparent_simple`
 * (one Orchard spend into one transparent output). Unlike synthetic fill-byte
 * fixtures — which the device accepts on the transparent path but rejects on the
 * Orchard path (`0x6a80`, the Orchard notes are cryptographically validated) —
 * this vector signs successfully on a real/Speculos device. With Speculos run as
 * the functional tests do (`--deterministic-rng zcash-standalone-tests`), the
 * returned `spendAuthSig` is exactly
 * `c9c9c463…0820`.
 */
const DEFAULT_PCZT_JSON = JSON.stringify(
  {
    global: {
      txVersion: 5,
      versionGroupId: 0x26a7270a,
      consensusBranchId: 0xc2d6d0b4,
      fallbackLockTime: 0,
      expiryHeight: 0,
      coinType: 133,
      txModifiable: 0,
    },
    transparentInputs: [],
    transparentOutputs: [
      {
        value: "290000",
        scriptPubKey: "76a914424242424242424242424242424242424242424288ac",
        derivation: null,
      },
    ],
    orchardBundle: {
      actions: [
        {
          cvNet:
            "24631b59abdde690d7e6b62cfeac6619efb7753dc873d9dbfdd4af58f0c50e98",
          nullifier:
            "2e552e9315c89ecbf8016a8dfaa325ef90dedc59df4b0a42e5ff5cee0bbed821",
          // rk consistent with alpha = (1).to_bytes(32, "little")
          rk: "e95982b73ab0c2137ec354cce448a75ef39ec0cbdf6907be6df3495297834f89",
          spendRecipient:
            "4a6414bb6f09e4a89469663a081fc2646c083708f552597d524b2f1812272e472d2b28f7414ece124ddf02",
          spendValue: "300000",
          spendRho:
            "0400000000000000000000000000000000000000000000000000000000000000",
          spendRseed:
            "1800000000000000000000000000000000000000000000000000000000000000",
          alpha:
            "0100000000000000000000000000000000000000000000000000000000000000",
          signingPath: "32'/133'/0'",
          seedFingerprint: fillHex(32, 0x00),
          cmx: "f4f6493954ecd47be87e5fdebb99db614dfaf1825717f23c4b0438688d831a04",
          ephemeralKey: fillHex(32, 0x00),
          encCiphertext: fillHex(580, 0x00),
          outCiphertext: fillHex(80, 0x00),
          recipient:
            "ede3d2ce08c11d8c5c7bfe6814cedafd96c160c3d879cb270946f1ab6fdf442a15648d7c0b3c9fd052e20a",
          value: "0",
          rseed:
            "2c00000000000000000000000000000000000000000000000000000000000000",
          rcv: "4000000000000000000000000000000000000000000000000000000000000000",
        },
      ],
      flags: 3,
      valueBalance: "300000",
      anchor:
        "699c780066f179ff12b26a5ec5b1af3d418eb0eadec3d3b18f10c91d97b33109",
    },
  },
  null,
  2,
);

const parseBigint = (value: string | number, fieldName: string): bigint => {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid integer for ${fieldName}`);
  }
};

const parseRequiredNumber = (
  value: number | string | undefined | null,
  fieldName: string,
): number => {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`);
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${fieldName}: ${String(value)}`);
  }
  return n;
};

const toNumberOrNull = (value: number | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

const parseDerivation = (
  raw: { signingPath: string; pubkey: string; seedFingerprint?: string },
  prefix: string,
): PcztBip32Derivation => ({
  signingPath: raw.signingPath,
  pubkey: parseHexBytes(raw.pubkey, `${prefix}.pubkey`),
  ...(raw.seedFingerprint
    ? {
        seedFingerprint: parseHexBytes(
          raw.seedFingerprint,
          `${prefix}.seedFingerprint`,
        ),
      }
    : {}),
});

type RawPcztDerivation = {
  signingPath: string;
  pubkey: string;
  seedFingerprint?: string;
};

type RawPcztTransparentInput = {
  prevoutTxid: string;
  prevoutIndex: number | string;
  sequence?: number | null;
  value: number | string;
  scriptPubKey: string;
  sighashType: number | string;
  derivation: RawPcztDerivation;
};

type RawPcztTransparentOutput = {
  value: number | string;
  scriptPubKey: string;
  derivation?: RawPcztDerivation | null;
};

type RawPcztOrchardAction = {
  cvNet: string;
  nullifier: string;
  rk: string;
  spendRecipient: string;
  spendValue: number | string;
  spendRho: string;
  spendRseed: string;
  alpha: string;
  signingPath: string;
  seedFingerprint?: string;
  cmx: string;
  ephemeralKey: string;
  encCiphertext: string;
  outCiphertext: string;
  recipient: string;
  value: number | string;
  rseed: string;
  rcv: string;
};

type RawPcztJson = {
  global?: {
    txVersion?: number | string;
    versionGroupId?: number | string;
    consensusBranchId?: number | string;
    fallbackLockTime?: number | null;
    expiryHeight?: number | string;
    coinType?: number | string;
    txModifiable?: number | string;
  };
  transparentInputs?: RawPcztTransparentInput[];
  transparentOutputs?: RawPcztTransparentOutput[];
  orchardBundle?: {
    actions?: RawPcztOrchardAction[];
    flags: number | string;
    valueBalance: number | string;
    anchor: string;
  } | null;
};

const parsePcztTransaction = (value: string): PcztTransaction => {
  let parsed: RawPcztJson;
  try {
    parsed = JSON.parse(value) as RawPcztJson;
  } catch (error) {
    throw new Error(
      `Invalid PCZT JSON: ${
        error instanceof Error ? error.message : "parse error"
      }`,
    );
  }

  const g = parsed.global ?? {};
  const global: PcztGlobal = {
    txVersion: parseRequiredNumber(g.txVersion, "global.txVersion"),
    versionGroupId: parseRequiredNumber(
      g.versionGroupId,
      "global.versionGroupId",
    ),
    consensusBranchId: parseRequiredNumber(
      g.consensusBranchId,
      "global.consensusBranchId",
    ),
    fallbackLockTime: toNumberOrNull(g.fallbackLockTime),
    expiryHeight: parseRequiredNumber(g.expiryHeight, "global.expiryHeight"),
    coinType: parseRequiredNumber(g.coinType, "global.coinType"),
    txModifiable: parseRequiredNumber(g.txModifiable, "global.txModifiable"),
  };

  const transparentInputs: PcztTransparentInput[] = (
    parsed.transparentInputs ?? []
  ).map((input, i) => ({
    prevoutTxid: parseHexBytes(
      input.prevoutTxid,
      `transparentInputs[${i}].prevoutTxid`,
    ),
    prevoutIndex: parseRequiredNumber(
      input.prevoutIndex,
      `transparentInputs[${i}].prevoutIndex`,
    ),
    sequence: toNumberOrNull(input.sequence),
    value: parseBigint(input.value, `transparentInputs[${i}].value`),
    scriptPubKey: parseHexBytes(
      input.scriptPubKey,
      `transparentInputs[${i}].scriptPubKey`,
    ),
    sighashType: parseRequiredNumber(
      input.sighashType,
      `transparentInputs[${i}].sighashType`,
    ),
    derivation: parseDerivation(
      input.derivation,
      `transparentInputs[${i}].derivation`,
    ),
  }));

  const transparentOutputs: PcztTransparentOutput[] = (
    parsed.transparentOutputs ?? []
  ).map((output, i) => ({
    value: parseBigint(output.value, `transparentOutputs[${i}].value`),
    scriptPubKey: parseHexBytes(
      output.scriptPubKey,
      `transparentOutputs[${i}].scriptPubKey`,
    ),
    derivation: output.derivation
      ? parseDerivation(
          output.derivation,
          `transparentOutputs[${i}].derivation`,
        )
      : null,
  }));

  const orchardBundle: PcztOrchardBundle | null = parsed.orchardBundle
    ? {
        actions: (parsed.orchardBundle.actions ?? []).map(
          (action, i): PcztOrchardAction => ({
            cvNet: parseHexBytes(action.cvNet, `orchard[${i}].cvNet`),
            nullifier: parseHexBytes(
              action.nullifier,
              `orchard[${i}].nullifier`,
            ),
            rk: parseHexBytes(action.rk, `orchard[${i}].rk`),
            spendRecipient: parseHexBytes(
              action.spendRecipient,
              `orchard[${i}].spendRecipient`,
            ),
            spendValue: parseBigint(
              action.spendValue,
              `orchard[${i}].spendValue`,
            ),
            spendRho: parseHexBytes(action.spendRho, `orchard[${i}].spendRho`),
            spendRseed: parseHexBytes(
              action.spendRseed,
              `orchard[${i}].spendRseed`,
            ),
            alpha: parseHexBytes(action.alpha, `orchard[${i}].alpha`),
            signingPath: action.signingPath,
            ...(action.seedFingerprint
              ? {
                  seedFingerprint: parseHexBytes(
                    action.seedFingerprint,
                    `orchard[${i}].seedFingerprint`,
                  ),
                }
              : {}),
            cmx: parseHexBytes(action.cmx, `orchard[${i}].cmx`),
            ephemeralKey: parseHexBytes(
              action.ephemeralKey,
              `orchard[${i}].ephemeralKey`,
            ),
            encCiphertext: parseHexBytes(
              action.encCiphertext,
              `orchard[${i}].encCiphertext`,
            ),
            outCiphertext: parseHexBytes(
              action.outCiphertext,
              `orchard[${i}].outCiphertext`,
            ),
            recipient: parseHexBytes(
              action.recipient,
              `orchard[${i}].recipient`,
            ),
            value: parseBigint(action.value, `orchard[${i}].value`),
            rseed: parseHexBytes(action.rseed, `orchard[${i}].rseed`),
            rcv: parseHexBytes(action.rcv, `orchard[${i}].rcv`),
          }),
        ),
        flags: parseRequiredNumber(
          parsed.orchardBundle.flags,
          "orchardBundle.flags",
        ),
        valueBalance: parseBigint(
          parsed.orchardBundle.valueBalance,
          "orchardBundle.valueBalance",
        ),
        anchor: parseHexBytes(
          parsed.orchardBundle.anchor,
          "orchardBundle.anchor",
        ),
      }
    : null;

  return { global, transparentInputs, transparentOutputs, orchardBundle };
};

const SIGN_PCZT_FORM_KEYS: (keyof SignPcztInput)[] = ["skipOpenApp"];

const SignPcztForm = ({
  initialValues,
  onChange,
  disabled,
}: {
  initialValues: SignPcztInput;
  onChange: (values: SignPcztInput) => void;
  disabled?: boolean;
}) => {
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  const formValues = Object.fromEntries(
    SIGN_PCZT_FORM_KEYS.map((key) => [key, initialValues[key]]),
  ) as Pick<SignPcztInput, (typeof SIGN_PCZT_FORM_KEYS)[number]>;

  return (
    <Flex flexDirection="column" rowGap={5}>
      <Form
        initialValues={formValues}
        onChange={(values) =>
          onChange({ ...initialValuesRef.current, ...values })
        }
        disabled={disabled}
      />
      <Flex flexDirection="column" rowGap={2}>
        <InputHeader hint="Structured PCZT as JSON. Byte fields are hex strings; value/spendValue/valueBalance are decimal strings (zatoshis). Set orchardBundle to null for transparent-only. Defaults to the app-zcash public→private test fixture.">
          PCZT (JSON)
        </InputHeader>
        <ResizableTextArea
          value={initialValues.pcztJson}
          onChange={(value) =>
            onChange({ ...initialValuesRef.current, pcztJson: value })
          }
          initialHeight={260}
          disabled={disabled}
        />
      </Flex>
    </Flex>
  );
};

export const SignerZcashView = ({ sessionId }: { sessionId: string }) => {
  const dmk = useDmk();
  const signer = useSignerZcash();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Get App Config",
        description: "Get the app configuration from the device",
        executeDeviceAction: () => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAppConfig();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigDAOutput,
        Record<string, never>,
        GetAppConfigDAError,
        GetAppConfigDAIntermediateValue
      >,
      {
        title: "Get Address",
        description: "Get an address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "",
          checkOnDevice: false,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAddressDAOutput,
        {
          derivationPath: string;
          checkOnDevice?: boolean;
          skipOpenApp?: boolean;
        },
        GetAddressDAError,
        GetAddressDAIntermediateValue
      >,
      {
        title: "Get Full Viewing Key",
        description:
          "Exports a full viewing key (UFVK/FVK) from the device. It does not spend funds, but it allows watching shielded balance and activity for this derivation — treat it as highly sensitive secret material. Do not share, log, or commit sample output; use only for local SDK testing.",
        executeDeviceAction: ({ derivationPath, mode, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const resolvedMode: ZcashFullViewingKeyMode =
            mode === "orchardFvk" ? "orchardFvk" : "ufvk";
          return signer.getFullViewingKey(derivationPath, {
            mode: resolvedMode,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: "32'/133'/0'",
          mode: "ufvk",
          skipOpenApp: false,
        },
        valueSelector: { mode: fullViewingKeyModeOptions },
        labelSelector: {
          mode: "Export mode (GET_VK P2)",
          derivationPath: "Derivation path",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetFullViewingKeyDAOutput,
        {
          derivationPath: string;
          mode: ZcashFullViewingKeyMode;
          skipOpenApp?: boolean;
        },
        GetFullViewingKeyDAError,
        GetFullViewingKeyDAIntermediateValue
      >,
      {
        title: "Sign Transaction",
        description: "Craft and sign a transaction with up to 3 trusted inputs",
        executeDeviceAction: (values) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const args = buildSignTransactionArg(values);
          return signer.signTransaction(args, {
            skipOpenApp: values.skipOpenApp,
          });
        },
        initialValues: sampleSignTransactionFormInitialValues,
        validateValues: (values) => {
          try {
            buildSignTransactionArg(values);
            return true;
          } catch {
            return false;
          }
        },
        InputValuesComponent: SignTransactionForm,
        labelSelector: {
          associatedKeysetsCsv: "Associated keysets (comma-separated)",
          outputScriptHex: "Output script hex",
          changePath: "Change derivation path",
          additionalsCsv: "Additionals (comma-separated)",
          lockTime: "Lock time",
          blockHeight: "Block height",
          sigHashType: "SigHash type",
          useExpiryHeight: "Use expiry height",
          expiryHeightHex: "Expiry height hex (4 bytes)",
          skipOpenApp: "Skip open app",
          input1Enabled: "Enable trusted input #1",
          input1PreviousTxJson: "Trusted input #1 previous tx JSON",
          input1OutputIndex: "Trusted input #1 output index",
          input1ScriptHex: "Trusted input #1 script override (hex)",
          input1Sequence: "Trusted input #1 sequence",
          input1UseBranchHeight: "Trusted input #1 use branch height",
          input1BranchHeight: "Trusted input #1 branch height",
          input1SerializedPreviousTxOverrideHex:
            "Trusted input #1 raw previous tx hex (optional)",
          input2Enabled: "Enable trusted input #2",
          input2PreviousTxJson: "Trusted input #2 previous tx JSON",
          input2OutputIndex: "Trusted input #2 output index",
          input2ScriptHex: "Trusted input #2 script override (hex)",
          input2Sequence: "Trusted input #2 sequence",
          input2UseBranchHeight: "Trusted input #2 use branch height",
          input2BranchHeight: "Trusted input #2 branch height",
          input2SerializedPreviousTxOverrideHex:
            "Trusted input #2 raw previous tx hex (optional)",
          input3Enabled: "Enable trusted input #3",
          input3PreviousTxJson: "Trusted input #3 previous tx JSON",
          input3OutputIndex: "Trusted input #3 output index",
          input3ScriptHex: "Trusted input #3 script override (hex)",
          input3Sequence: "Trusted input #3 sequence",
          input3UseBranchHeight: "Trusted input #3 use branch height",
          input3BranchHeight: "Trusted input #3 branch height",
          input3SerializedPreviousTxOverrideHex:
            "Trusted input #3 raw previous tx hex (optional)",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        SignTransactionInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Get Trusted Input",
        description: "Call GET_TRUSTED_INPUT command on the device",
        executeDeviceAction: ({
          transaction,
          useIndexLookup,
          indexLookup,
          skipOpenApp,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const txBytes = hexaStringToBuffer(transaction);
          if (!txBytes) {
            throw new Error("Invalid transaction hex string");
          }

          return signer.getTrustedInput(txBytes, {
            indexLookup: useIndexLookup ? indexLookup : undefined,
            skipOpenApp,
          });
        },
        initialValues: {
          transaction: "",
          useIndexLookup: true,
          indexLookup: 0,
          skipOpenApp: false,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GetTrustedInputDAOutput,
        {
          transaction: string;
          useIndexLookup: boolean;
          indexLookup: number;
          skipOpenApp?: boolean;
        },
        GetTrustedInputDAError,
        GetTrustedInputDAIntermediateValue
      >,
      {
        title: "Sign Message",
        description: "Sign a message with the device",
        executeDeviceAction: ({ derivationPath, message }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          return signer.signMessage(derivationPath, message);
        },
        initialValues: {
          derivationPath: "",
          message: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          derivationPath: string;
          message: string;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
      {
        title: "Sign PCZT Transaction",
        description:
          "Sign an Orchard shielded (PCZT) transaction. Returns one spendAuthSig per Orchard action plus one signature per transparent input; the binding signature and final assembly are host-side.",
        executeDeviceAction: ({ pcztJson, skipOpenApp }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          const transaction = parsePcztTransaction(pcztJson);
          return signer.signPcztTransaction(transaction, { skipOpenApp });
        },
        initialValues: {
          pcztJson: DEFAULT_PCZT_JSON,
          skipOpenApp: false,
        },
        validateValues: (values) => {
          try {
            parsePcztTransaction(values.pcztJson);
            return true;
          } catch {
            return false;
          }
        },
        InputValuesComponent: SignPcztForm,
        labelSelector: {
          pcztJson: "PCZT (JSON)",
          skipOpenApp: "Skip open app",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignPcztTransactionDAOutput,
        SignPcztInput,
        SignPcztTransactionDAError,
        SignPcztTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, signer],
  );

  return (
    <DeviceActionsList title="Signer Zcash" deviceActions={deviceActions} />
  );
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  base64StringToBuffer,
  isBase64String,
} from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  type GetAppConfigurationDAError,
  type GetAppConfigurationDAIntermediateValue,
  type GetAppConfigurationDAOutput,
  SignerSolanaBuilder,
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
  SignMessageVersion,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-solana";
import { Flex, Icons, Text } from "@ledgerhq/react-ui";
import {
  type CraftTransactionDAError,
  type CraftTransactionDAIntermediateValue,
  type CraftTransactionDAOutput,
  type GenerateTransactionDAError,
  type GenerateTransactionDAIntermediateValue,
  type GenerateTransactionDAOutput,
  SolanaToolsBuilder,
} from "@ledgerhq/solana-tools";
import bs58 from "bs58";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import { Form } from "@/components/Form";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import {
  selectCalConfig,
  selectDatasourceConfig,
  selectMetadataServiceConfig,
  selectOriginToken,
  selectReporterConfig,
  selectWeb3ChecksConfig,
} from "@/state/settings/selectors";

const DEFAULT_DERIVATION_PATH = "44'/501'/0'/0'";

type SignTransactionInput = {
  derivationPath: string;
  transaction: string;
  skipOpenApp: boolean;
  delayed: boolean;
  templateId: string;
  tokenAddress: string;
  tokenInternalId: string;
  createATAAddress: string;
  createATAMintAddress: string;
};

const MAIN_KEYS: (keyof SignTransactionInput)[] = [
  "derivationPath",
  "transaction",
  "skipOpenApp",
  "delayed",
];

const CONTEXT_KEYS: (keyof SignTransactionInput)[] = [
  "templateId",
  "tokenAddress",
  "tokenInternalId",
  "createATAAddress",
  "createATAMintAddress",
];

const SignTransactionForm: React.FC<{
  initialValues: SignTransactionInput;
  onChange: (values: SignTransactionInput) => void;
  disabled?: boolean;
}> = ({ initialValues, onChange, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;

  const mainValues = Object.fromEntries(
    MAIN_KEYS.map((k) => [k, initialValues[k]]),
  ) as Pick<SignTransactionInput, (typeof MAIN_KEYS)[number]>;

  const contextValues = Object.fromEntries(
    CONTEXT_KEYS.map((k) => [k, initialValues[k]]),
  ) as Pick<SignTransactionInput, (typeof CONTEXT_KEYS)[number]>;

  const handleMainChange = useCallback(
    (vals: typeof mainValues) =>
      onChange({ ...initialValuesRef.current, ...vals }),
    [onChange],
  );

  const handleContextChange = useCallback(
    (vals: typeof contextValues) =>
      onChange({ ...initialValuesRef.current, ...vals }),
    [onChange],
  );

  return (
    <Flex flexDirection="column" rowGap={5}>
      <Form
        initialValues={mainValues}
        onChange={handleMainChange}
        disabled={disabled}
      />
      <Flex
        flexDirection="row"
        alignItems="center"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded((v) => !v)}
        columnGap={2}
      >
        {expanded ? (
          <Icons.ChevronDown size="XS" />
        ) : (
          <Icons.ChevronRight size="XS" />
        )}
        <Text variant="small" color="neutral.c70">
          Transaction Resolution Context
        </Text>
      </Flex>
      {expanded && (
        <Form
          initialValues={contextValues}
          onChange={handleContextChange}
          disabled={disabled}
        />
      )}
    </Flex>
  );
};

const signMessageVersionOptions = Object.values(SignMessageVersion).map(
  (value) => ({
    label: value,
    value,
  }),
);

export const SignerSolanaView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const dmk = useDmk();
  const calConfig = useSelector(selectCalConfig);
  const web3ChecksConfig = useSelector(selectWeb3ChecksConfig);
  const metadataServiceConfig = useSelector(selectMetadataServiceConfig);
  const reporterConfig = useSelector(selectReporterConfig);
  const originToken = useSelector(selectOriginToken);
  const datasourceConfig = useSelector(selectDatasourceConfig);

  const signer = useMemo(() => {
    const contextModule = new ContextModuleBuilder({
      originToken,
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setCalConfig(calConfig)
      .setWeb3ChecksConfig(web3ChecksConfig)
      .setMetadataServiceConfig(metadataServiceConfig)
      .setReporterConfig(reporterConfig)
      .setDatasourceConfig(datasourceConfig)
      .setAppSource("device-management-kit-playground")
      .setChain(ContextModuleChainID.Solana)
      .build();

    return new SignerSolanaBuilder({
      dmk,
      sessionId,
      originToken,
      solanaRPCURL: "https://solana.coin.ledger.com",
    })
      .withContextModule(contextModule)
      .build();
  }, [
    dmk,
    sessionId,
    calConfig,
    web3ChecksConfig,
    metadataServiceConfig,
    reporterConfig,
    originToken,
    datasourceConfig,
  ]);
  const solanaTools = new SolanaToolsBuilder({
    dmk,
    sessionId,
  }).build();

  const deviceModelId = dmk.getConnectedDevice({
    sessionId,
  }).modelId;

  const deviceActions = useMemo<DeviceActionProps<any, any, any, any>[]>(
    () => [
      {
        title: "Get address",
        description:
          "Perform all the actions necessary to get a Solana address from the device",
        executeDeviceAction: ({
          derivationPath,
          checkOnDevice,
          skipOpenApp,
        }) => {
          return signer.getAddress(derivationPath, {
            checkOnDevice,
            skipOpenApp,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
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
        title: "Sign transaction",
        description:
          "Perform all the actions necessary to sign a Solana transaction with the device",
        executeDeviceAction: ({
          derivationPath,
          transaction,
          delayed,
          templateId,
          tokenAddress,
          tokenInternalId,
          createATAAddress,
          createATAMintAddress,
        }) => {
          const serializedTransaction =
            base64StringToBuffer(transaction) ?? new Uint8Array();

          const createATA =
            createATAAddress && createATAMintAddress
              ? { address: createATAAddress, mintAddress: createATAMintAddress }
              : undefined;

          const hasResolutionContext =
            templateId || tokenAddress || tokenInternalId || createATA;

          return signer.signTransaction(derivationPath, serializedTransaction, {
            ...(hasResolutionContext && {
              transactionResolutionContext: {
                templateId: templateId || undefined,
                tokenAddress: tokenAddress || undefined,
                tokenInternalId: tokenInternalId || undefined,
                createATA,
              },
            }),
            delayed,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          transaction: "",
          skipOpenApp: false,
          delayed: false,
          templateId: "",
          tokenAddress: "",
          tokenInternalId: "",
          createATAAddress: "",
          createATAMintAddress: "",
        },
        InputValuesComponent: SignTransactionForm,
        validateValues: ({ transaction }) =>
          isBase64String(transaction) && transaction.length > 0,
        deviceModelId,
      } satisfies DeviceActionProps<
        SignTransactionDAOutput,
        SignTransactionInput,
        SignTransactionDAError,
        SignTransactionDAIntermediateValue
      >,
      {
        title: "Sign off chain message",
        description:
          "Perform all the actions necessary to sign a solana off-chain message from the device",
        executeDeviceAction: ({
          derivationPath,
          message,
          version,
          skipOpenApp,
          appDomain,
          signers,
        }) => {
          if (!signer) {
            throw new Error("Signer not initialized");
          }
          let payload: string | Uint8Array = message;
          if (version === SignMessageVersion.Raw) {
            const hex = message.replace(/\s/g, "");
            if (!/^([0-9a-fA-F]{2})*$/.test(hex)) {
              throw new Error(
                "Raw mode requires a valid hex string (pairs of hex digits)",
              );
            }
            payload = Uint8Array.from(
              hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
            );
          }
          const parsedSigners =
            version === SignMessageVersion.V1 && signers.trim()
              ? signers
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => bs58.decode(s))
              : undefined;
          return signer.signMessage(derivationPath, payload, {
            version,
            skipOpenApp,
            appDomain:
              version === SignMessageVersion.V0 && appDomain
                ? appDomain
                : undefined,
            signers: parsedSigners,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          message: "Hello World",
          version: SignMessageVersion.V0,
          skipOpenApp: false,
          appDomain: "",
          signers: "",
        },
        valueSelector: {
          version: signMessageVersionOptions,
        },
        labelSelector: {
          derivationPath: "Derivation path",
          message: "Message (hex bytes for Raw mode)",
          version: "Signing mode",
          skipOpenApp: "Skip open app",
          appDomain: "App domain (V0 only)",
          signers: "Additional signers, comma-separated base58 (V1 only)",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        SignMessageDAOutput,
        {
          derivationPath: string;
          message: string;
          version: SignMessageVersion;
          skipOpenApp: boolean;
          appDomain: string;
          signers: string;
        },
        SignMessageDAError,
        SignMessageDAIntermediateValue
      >,
      {
        title: "Get app configuration",
        description:
          "Perform all the actions necessary to get the Solana app configuration from the device",
        executeDeviceAction: () => {
          return signer.getAppConfiguration();
        },
        initialValues: {},
        deviceModelId,
      } satisfies DeviceActionProps<
        GetAppConfigurationDAOutput,
        Record<string, never>,
        GetAppConfigurationDAError,
        GetAppConfigurationDAIntermediateValue
      >,
      {
        title: "Generate transaction",
        description:
          "Perform all the actions necessary to generate a transaction to test the Solana signer",
        executeDeviceAction: ({ derivationPath }) => {
          return solanaTools.generateTransaction(derivationPath);
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        GenerateTransactionDAOutput,
        {
          derivationPath: string;
        },
        GenerateTransactionDAError,
        GenerateTransactionDAIntermediateValue
      >,
      {
        title: "Craft a Solana transaction",
        description:
          "Craft a Solana transaction with your public key as the fee payer. Provide either a serialised transaction (base64) or a transaction signature to fetch from the network.",
        executeDeviceAction: ({
          derivationPath,
          serialisedTransaction,
          transactionSignature,
          rpcUrl,
        }) => {
          return solanaTools.craftTransaction({
            derivationPath,
            serialisedTransaction: serialisedTransaction || undefined,
            transactionSignature: transactionSignature || undefined,
            rpcUrl: rpcUrl || undefined,
          });
        },
        initialValues: {
          derivationPath: DEFAULT_DERIVATION_PATH,
          serialisedTransaction: "",
          transactionSignature: "",
          rpcUrl: "",
        },
        deviceModelId,
      } satisfies DeviceActionProps<
        CraftTransactionDAOutput,
        {
          derivationPath: string;
          serialisedTransaction: string;
          transactionSignature: string;
          rpcUrl: string;
        },
        CraftTransactionDAError,
        CraftTransactionDAIntermediateValue
      >,
    ],
    [deviceModelId, solanaTools, signer],
  );

  return (
    <DeviceActionsList title="Solana Signer" deviceActions={deviceActions} />
  );
};

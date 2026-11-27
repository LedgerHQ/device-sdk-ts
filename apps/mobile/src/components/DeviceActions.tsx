import React from "react";
import { type DeviceActionProps } from "_common/types";
import {
  type DeviceManagementKit,
  type DeviceModelId,
  type GetDeviceStatusDAError,
  type GetDeviceStatusDAInput,
  type GetDeviceStatusDAIntermediateValue,
  type GetDeviceStatusDAOutput,
  GetDeviceStatusDeviceAction,
  type GoToDashboardDAError,
  type GoToDashboardDAInput,
  type GoToDashboardDAIntermediateValue,
  type GoToDashboardDAOutput,
  GoToDashboardDeviceAction,
  hexaStringToBuffer,
  type InstallAppDAError,
  type InstallAppDAInput,
  type InstallAppDAIntermediateValue,
  type InstallAppDAOutput,
  InstallAppDeviceAction,
  type ListAppsDAError,
  type ListAppsDAInput,
  type ListAppsDAIntermediateValue,
  type ListAppsDAOutput,
  ListAppsDeviceAction,
  type ListAppsWithMetadataDAError,
  type ListAppsWithMetadataDAInput,
  type ListAppsWithMetadataDAIntermediateValue,
  type ListAppsWithMetadataDAOutput,
  ListAppsWithMetadataDeviceAction,
  type OpenAppDAError,
  type OpenAppDAInput,
  type OpenAppDAIntermediateValue,
  type OpenAppDAOutput,
  OpenAppDeviceAction,
  type UninstallAppDAError,
  type UninstallAppDAInput,
  type UninstallAppDAIntermediateValue,
  type UninstallAppDAOutput,
  UninstallAppDeviceAction,
} from "@ledgerhq/device-management-kit";
import {
  type GetAddressDAError,
  type GetAddressDAIntermediateValue,
  type GetAddressDAOutput,
  SignerEthBuilder,
  type SignTransactionDAError,
  type SignTransactionDAIntermediateValue,
  type SignTransactionDAOutput,
} from "@ledgerhq/device-signer-kit-ethereum";
import { Flex, LegendInput } from "@ledgerhq/native-ui";

const UNLOCK_TIMEOUT = 60 * 1000; // 1 minute
const ETH_DERIVATION_PATH = "44'/60'/0'/0/0";

export const getDeviceActions = (
  dmk: DeviceManagementKit,
  sessionId: string,
  deviceModelId: DeviceModelId,
) => [
  {
    id: "open_app",
    title: "Open app",
    description:
      "Perform all the actions necessary to open an app on the device",
    executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
      const deviceAction = new OpenAppDeviceAction({
        input: { appName, unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: {
      appName: "",
      unlockTimeout: UNLOCK_TIMEOUT,
    },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="App name"
          value={values.appName}
          onChange={appName => setValue("appName", appName)}
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    OpenAppDAOutput,
    OpenAppDAInput,
    OpenAppDAError,
    OpenAppDAIntermediateValue
  >,
  {
    id: "get_device_status",
    title: "Get device status",
    description: "Perform various checks on the device to determine its status",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new GetDeviceStatusDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    GetDeviceStatusDAOutput,
    GetDeviceStatusDAInput,
    GetDeviceStatusDAError,
    GetDeviceStatusDAIntermediateValue
  >,
  {
    id: "go_to_dashboard",
    title: "Go to dashboard",
    description: "Navigate to the dashboard",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new GoToDashboardDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    GoToDashboardDAOutput,
    GoToDashboardDAInput,
    GoToDashboardDAError,
    GoToDashboardDAIntermediateValue
  >,
  {
    id: "list_apps",
    title: "List apps",
    description: "List all applications installed on the device",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new ListAppsDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    ListAppsDAOutput,
    ListAppsDAInput,
    ListAppsDAError,
    ListAppsDAIntermediateValue
  >,
  {
    id: "list_apps_with_metadata",
    title: "List apps with metadata",
    description:
      "List all applications installed on the device with additional metadata",
    executeDeviceAction: ({ unlockTimeout }, inspect) => {
      const deviceAction = new ListAppsWithMetadataDeviceAction({
        input: { unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: () => null,
  } satisfies DeviceActionProps<
    ListAppsWithMetadataDAOutput,
    ListAppsWithMetadataDAInput,
    ListAppsWithMetadataDAError,
    ListAppsWithMetadataDAIntermediateValue
  >,
  {
    id: "install_app",
    title: "Install App",
    description:
      "Perform all the actions necessary to install an app on the device by name",
    executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
      const deviceAction = new InstallAppDeviceAction({
        input: { appName, unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="App name"
          value={values.appName}
          onChange={appName => setValue("appName", appName)}
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    InstallAppDAOutput,
    InstallAppDAInput,
    InstallAppDAError,
    InstallAppDAIntermediateValue
  >,
  {
    id: "uninstall_app",
    title: "Uninstall App",
    description:
      "Perform all the actions necessary to uninstall an app on the device by name",
    executeDeviceAction: ({ appName, unlockTimeout }, inspect) => {
      const deviceAction = new UninstallAppDeviceAction({
        input: { appName, unlockTimeout },
        inspect,
      });
      return dmk.executeDeviceAction({
        sessionId,
        deviceAction,
      });
    },
    initialValues: { appName: "", unlockTimeout: UNLOCK_TIMEOUT },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="App name"
          value={values.appName}
          onChange={appName => setValue("appName", appName)}
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    UninstallAppDAOutput,
    UninstallAppDAInput,
    UninstallAppDAError,
    UninstallAppDAIntermediateValue
  >,
  {
    id: "eth_get_address",
    title: "Ethereum: Get address",
    description: "Get the Ethereum address of a derivation path",
    executeDeviceAction: ({ derivationPath }) =>
      new SignerEthBuilder({ dmk, sessionId })
        .build()
        .getAddress(derivationPath),
    initialValues: { derivationPath: ETH_DERIVATION_PATH },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="Derivation path"
          value={values.derivationPath}
          onChange={derivationPath =>
            setValue("derivationPath", derivationPath)
          }
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    GetAddressDAOutput,
    { derivationPath: string },
    GetAddressDAError,
    GetAddressDAIntermediateValue
  >,
  {
    id: "eth_sign_transaction",
    title: "Ethereum: Sign transaction",
    description: "Sign a serialized unsigned Ethereum transaction (hex)",
    executeDeviceAction: ({ derivationPath, transaction }) => {
      const tx = hexaStringToBuffer(transaction);
      if (!tx) {
        throw new Error("Invalid transaction hex");
      }
      return new SignerEthBuilder({ dmk, sessionId })
        .build()
        .signTransaction(derivationPath, tx);
    },
    initialValues: { derivationPath: ETH_DERIVATION_PATH, transaction: "" },
    deviceModelId,
    FormComponent: ({ values, setValue }) => (
      <Flex>
        <LegendInput
          legend="Derivation path"
          value={values.derivationPath}
          onChange={derivationPath =>
            setValue("derivationPath", derivationPath)
          }
        />
        <LegendInput
          testID="eth-transaction-input"
          legend="Transaction (hex)"
          value={values.transaction}
          onChange={transaction => setValue("transaction", transaction)}
        />
      </Flex>
    ),
  } satisfies DeviceActionProps<
    SignTransactionDAOutput,
    { derivationPath: string; transaction: string },
    SignTransactionDAError,
    SignTransactionDAIntermediateValue
  >,
];

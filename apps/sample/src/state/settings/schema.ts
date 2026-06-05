import {
  type ContextModuleCalBranch,
  type ContextModuleCalConfig,
  type ContextModuleCalMode,
  type ContextModuleDatasourceConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleReporterConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";
import { DeviceModelId } from "@ledgerhq/device-management-kit";

import { DEFAULT_SPECULOS_URL, DEFAULT_SPECULOS_VNC_URL } from "@/utils/const";

export type CalMode = ContextModuleCalMode;
export type CalBranch = ContextModuleCalBranch;
export type DatasourceProxy = NonNullable<
  ContextModuleDatasourceConfig["proxy"]
>;

export type TransportConfig = {
  speculos: { url: string; deviceModelId: DeviceModelId } | null;
  mockServer: { url: string } | null;
};

type TransportFlags = {
  speculosEnabled: boolean;
  mockServerEnabled: boolean;
};

function getInitialTransportFlags(): TransportFlags {
  const envTransport = process.env.DMK_CONFIG_TRANSPORT;
  const enabled = (envTransport ?? "").split(",").map((value) => value.trim());
  const isTest = enabled.includes("test") || enabled.includes("both");
  return {
    speculosEnabled: isTest || enabled.includes("speculos"),
    mockServerEnabled: isTest || enabled.includes("mockserver"),
  };
}

export type SettingsState = {
  // Transport settings
  speculosEnabled: boolean;
  mockServerEnabled: boolean;
  mockServerUrl: string;
  speculosUrl: string;
  speculosVncUrl: string;
  speculosDeviceModel: DeviceModelId;

  // DMK settings
  appProvider: number;
  pollingInterval: number;
  bypassIntentQueue: boolean;

  // Context module config
  calConfig: ContextModuleCalConfig;
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  metadataServiceConfig: ContextModuleMetadataServiceConfig;
  reporterConfig: ContextModuleReporterConfig;
  originToken: string;
  datasourceConfig: ContextModuleDatasourceConfig;
};

const initialTransportFlags = getInitialTransportFlags();

export const initialState: SettingsState = {
  // Transport settings
  speculosEnabled: initialTransportFlags.speculosEnabled,
  mockServerEnabled: initialTransportFlags.mockServerEnabled,
  mockServerUrl: "http://127.0.0.1:8080/",
  speculosUrl: DEFAULT_SPECULOS_URL,
  speculosVncUrl: DEFAULT_SPECULOS_VNC_URL,
  speculosDeviceModel: DeviceModelId.STAX,

  // DMK settings
  appProvider: 1,
  pollingInterval: 1000,
  bypassIntentQueue: false,

  // Context module config objects
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  web3ChecksConfig: {
    url: "https://web3checks-backend.api.ledger.com/v3",
  },
  metadataServiceConfig: {
    url: "https://nft.api.live.ledger.com",
  },
  reporterConfig: {
    url: "https://blind-signing.api.ledger.com/ingest/v1",
  },
  originToken: process.env.NEXT_PUBLIC_GATING_TOKEN || "origin-token",
  datasourceConfig: {
    proxy: "default",
  },
};

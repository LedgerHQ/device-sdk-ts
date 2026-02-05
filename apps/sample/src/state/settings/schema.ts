import {
  type ContextModuleCalBranch,
  type ContextModuleCalConfig,
  type ContextModuleCalMode,
  type ContextModuleDatasourceConfig,
  type ContextModuleMetadataServiceConfig,
  type ContextModuleWeb3ChecksConfig,
} from "@ledgerhq/context-module";

import { DEFAULT_SPECULOS_URL, DEFAULT_SPECULOS_VNC_URL } from "@/utils/const";

export type CalMode = ContextModuleCalMode;
export type CalBranch = ContextModuleCalBranch;
export type DatasourceProxy = NonNullable<
  ContextModuleDatasourceConfig["proxy"]
>;

export type TransportType = "default" | "speculos" | "mockserver";

export type TransportConfig =
  | { type: "default" }
  | { type: "speculos"; url: string }
  | { type: "mockserver"; url: string };

function getInitialTransportType(): TransportType {
  const envTransport = process.env.DMK_CONFIG_TRANSPORT;
  if (envTransport === "speculos" || envTransport === "mockserver") {
    return envTransport;
  }
  return "default";
}

export type SettingsState = {
  // Transport settings
  transportType: TransportType;
  mockServerUrl: string;
  speculosUrl: string;
  speculosVncUrl: string;

  // DMK settings
  appProvider: number;
  pollingInterval: number;

  // Context module config
  calConfig: ContextModuleCalConfig;
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  metadataServiceConfig: ContextModuleMetadataServiceConfig;
  originToken: string;
  datasourceConfig: ContextModuleDatasourceConfig;
};

export const initialState: SettingsState = {
  // Transport settings
  transportType: getInitialTransportType(),
  mockServerUrl: "http://127.0.0.1:8080/",
  speculosUrl: DEFAULT_SPECULOS_URL,
  speculosVncUrl: DEFAULT_SPECULOS_VNC_URL,

  // DMK settings
  appProvider: 1,
  pollingInterval: 1000,

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
  originToken: process.env.NEXT_PUBLIC_GATING_TOKEN || "origin-token",
  datasourceConfig: {
    proxy: "default",
  },
};
